/**
 * Direct-to-provider streaming chat transport.
 *
 * Runs entirely on the device: it opens an HTTPS request straight to the
 * configured provider and streams the response back. Both the OpenAI-style
 * `/chat/completions` SSE format and Anthropic's `/messages` event stream are
 * supported; every other catalogued provider (Google, Groq, Mistral,
 * OpenRouter, Ollama, OpenAI-compatible) speaks the OpenAI dialect.
 *
 * WebLLM (fully in-browser inference) is handled separately in ./webllm.
 */

import { providerBaseUrl, type Message, type Provider } from "./models";

export type ChatParams = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
};

export type ChatRequest = {
  provider: Provider;
  model: string;
  system?: string;
  messages: Pick<Message, "role" | "content">[];
  params?: ChatParams;
  signal?: AbortSignal;
};

export type ChatCallbacks = {
  onToken: (delta: string) => void;
  onDone: (full: string) => void;
  onError: (message: string) => void;
};

function trimBase(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Parse a text/event-stream body, invoking `onData` for each `data:` payload. */
async function readEventStream(
  res: Response,
  signal: AbortSignal | undefined,
  onData: (payload: string) => void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Response has no readable body");
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      break;
    }
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line; a single event may hold several
    // `data:` lines which concatenate.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of rawEvent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
          onData(trimmed.slice(5).trim());
        }
      }
    }
  }
}

async function extractError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const json = JSON.parse(text) as { error?: { message?: string } | string };
    if (typeof json.error === "string") return json.error;
    if (json.error?.message) return json.error.message;
  } catch {
    // fall through to raw text
  }
  return text || `Request failed with status ${res.status}`;
}

async function streamOpenAI(
  req: ChatRequest,
  cb: ChatCallbacks,
): Promise<void> {
  const base = trimBase(providerBaseUrl(req.provider));
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (req.provider.apiKey) {
    headers["Authorization"] = `Bearer ${req.provider.apiKey}`;
  }
  if (req.provider.type === "openrouter") {
    headers["HTTP-Referer"] = "https://neversoft.ai";
    headers["X-Title"] = "NeverSoft AI Container";
  }

  const body = {
    model: req.model,
    messages: [
      ...(req.system ? [{ role: "system", content: req.system }] : []),
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: true,
    temperature: req.params?.temperature ?? 0.7,
    ...(req.params?.maxTokens ? { max_tokens: req.params.maxTokens } : {}),
    top_p: req.params?.topP ?? 1,
  };

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: req.signal,
  });

  if (!res.ok) {
    cb.onError(await extractError(res));
    return;
  }

  let full = "";
  await readEventStream(res, req.signal, (payload) => {
    if (payload === "[DONE]") return;
    try {
      const json = JSON.parse(payload) as {
        choices?: { delta?: { content?: string } }[];
      };
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        cb.onToken(delta);
      }
    } catch {
      // Ignore keep-alive comments / partial frames.
    }
  });
  cb.onDone(full);
}

async function streamAnthropic(
  req: ChatRequest,
  cb: ChatCallbacks,
): Promise<void> {
  const base = trimBase(providerBaseUrl(req.provider));
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
    // Required for calling the API directly from a browser / WebView origin.
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (req.provider.apiKey) headers["x-api-key"] = req.provider.apiKey;

  const body = {
    model: req.model,
    max_tokens: req.params?.maxTokens ?? 4096,
    ...(req.system ? { system: req.system } : {}),
    messages: req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    stream: true,
    temperature: req.params?.temperature ?? 0.7,
  };

  const res = await fetch(`${base}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: req.signal,
  });

  if (!res.ok) {
    cb.onError(await extractError(res));
    return;
  }

  let full = "";
  await readEventStream(res, req.signal, (payload) => {
    try {
      const json = JSON.parse(payload) as {
        type?: string;
        delta?: { text?: string };
      };
      if (json.type === "content_block_delta" && json.delta?.text) {
        full += json.delta.text;
        cb.onToken(json.delta.text);
      }
    } catch {
      // Ignore non-JSON events (ping, etc.).
    }
  });
  cb.onDone(full);
}

/** Stream a completion for the given request, dispatching by provider dialect. */
export async function streamChat(
  req: ChatRequest,
  cb: ChatCallbacks,
): Promise<void> {
  try {
    if (req.provider.type === "anthropic") {
      await streamAnthropic(req, cb);
    } else {
      await streamOpenAI(req, cb);
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      cb.onDone("");
      return;
    }
    const msg =
      err instanceof Error
        ? err.message
        : "Network error — check the provider URL, your connection and CORS.";
    cb.onError(msg);
  }
}

/** Fetch the live model list from an OpenAI-compatible `/models` endpoint. */
export async function fetchModels(provider: Provider): Promise<string[]> {
  const base = trimBase(providerBaseUrl(provider));
  const headers: Record<string, string> = {};
  if (provider.apiKey) headers["Authorization"] = `Bearer ${provider.apiKey}`;

  if (provider.type === "anthropic") {
    headers["x-api-key"] = provider.apiKey ?? "";
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  }

  const res = await fetch(`${base}/models`, { headers });
  if (!res.ok) throw new Error(await extractError(res));
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id).sort();
}

/** Probe an Ollama server for its locally installed models. */
export async function fetchOllamaTags(baseUrl: string): Promise<string[]> {
  const root = trimBase(baseUrl).replace(/\/v1$/, "");
  const res = await fetch(`${root}/api/tags`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = (await res.json()) as { models?: { name: string }[] };
  return (data.models ?? []).map((m) => m.name);
}
