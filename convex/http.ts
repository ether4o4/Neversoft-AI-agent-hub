import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function resolveApiKey(raw: string): string {
  return raw === "__HERCULES_GATEWAY__" ? (process.env.HERCULES_API_KEY ?? "") : raw;
}

function getProviderBaseUrl(type: string): string {
  const urls: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    google: "https://generativelanguage.googleapis.com/v1beta/openai",
    mistral: "https://api.mistral.ai/v1",
    groq: "https://api.groq.com/openai/v1",
    openrouter: "https://openrouter.ai/api/v1",
    ollama: "http://localhost:11434/v1",
  };
  return urls[type] ?? "http://localhost:11434/v1";
}

function getDefaultModel(type: string): string {
  const models: Record<string, string> = {
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-haiku-20241022",
    google: "gemini-2.0-flash",
    mistral: "mistral-small-latest",
    groq: "llama-3.1-8b-instant",
    openrouter: "openai/gpt-4o-mini",
    ollama: "llama3.2",
    openai_compatible: "openai/gpt-4o-mini",
  };
  return models[type] ?? "gpt-4o-mini";
}

const http = httpRouter();

for (const path of ["/api/chat/stream", "/api/providers/test", "/api/providers/models", "/api/ollama/tags"]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
  });
}

http.route({
  path: "/api/chat/stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });

    let body: { conversationId: string };
    try {
      body = await request.json() as { conversationId: string };
    } catch {
      return new Response("Bad Request", { status: 400, headers: CORS_HEADERS });
    }

    const context = await ctx.runQuery(internal.chat.getStreamContext, {
      tokenIdentifier: identity.tokenIdentifier,
      conversationId: body.conversationId as Id<"conversations">,
    });

    if (!context) {
      return new Response(
        JSON.stringify({ error: "No provider configured or conversation not found." }),
        { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { provider, conversation, messages } = context;
    const apiKey = resolveApiKey(provider.apiKeyEncrypted ?? "");
    const baseUrl = provider.baseUrl ?? getProviderBaseUrl(provider.type);
    const model = conversation.modelId ?? provider.models?.[0] ?? getDefaultModel(provider.type);
    const systemPrompt = conversation.systemPrompt;
    const temp = conversation.temperature ?? 0.7;
    const maxTokens = conversation.maxTokens ?? 4096;
    const topP = conversation.topP ?? 1;

    const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
    let endpoint: string;
    let reqBody: unknown;

    if (provider.type === "anthropic") {
      endpoint = `${baseUrl}/messages`;
      reqHeaders["x-api-key"] = apiKey;
      reqHeaders["anthropic-version"] = "2023-06-01";
      const anthropicMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
      reqBody = {
        model, max_tokens: maxTokens,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: anthropicMessages, stream: true, temperature: temp,
      };
    } else {
      endpoint = `${baseUrl}/chat/completions`;
      reqHeaders["Authorization"] = `Bearer ${apiKey}`;
      if (provider.type === "openrouter") {
        reqHeaders["HTTP-Referer"] = "https://neversoft.ai";
        reqHeaders["X-Title"] = "NeverSoft AI Container";
      }
      const chatMessages = [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      reqBody = { model, messages: chatMessages, stream: true, temperature: temp, max_tokens: maxTokens, top_p: topP };
    }

    let llmRes: Response;
    try {
      llmRes = await fetch(endpoint, { method: "POST", headers: reqHeaders, body: JSON.stringify(reqBody) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return new Response(JSON.stringify({ error: msg }), {
        status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      return new Response(errText, { status: llmRes.status, headers: { ...CORS_HEADERS, "Content-Type": "text/plain" } });
    }

    return new Response(llmRes.body, {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
    });
  }),
});

http.route({
  path: "/api/providers/test",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });

    const { providerId } = await request.json() as { providerId: string };
    const testResult = await ctx.runQuery(internal.chat.testProvider, {
      tokenIdentifier: identity.tokenIdentifier,
      providerId: providerId as Id<"providers">,
    });
    return new Response(JSON.stringify(testResult), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }),
});

http.route({
  path: "/api/providers/models",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });

    const { providerId } = await request.json() as { providerId: string };
    const providerData = await ctx.runQuery(internal.chat.getProviderForUser, {
      tokenIdentifier: identity.tokenIdentifier,
      providerId: providerId as Id<"providers">,
    });
    if (!providerData) return new Response("Not found", { status: 404, headers: CORS_HEADERS });

    const baseUrl = providerData.baseUrl ?? getProviderBaseUrl(providerData.type);
    const apiKey = resolveApiKey(providerData.apiKeyEncrypted ?? "");

    try {
      const res = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!res.ok) {
        return new Response(JSON.stringify({ error: await res.text() }), {
          status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const data = await res.json() as { data?: Array<{ id: string }> };
      const modelIds = (data.data ?? []).map((m) => m.id).sort();
      return new Response(JSON.stringify({ models: modelIds }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    } catch (err: unknown) {
      return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error" }), {
        status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/ollama/tags",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });

    const { baseUrl } = await request.json() as { baseUrl: string };
    if (!baseUrl) return new Response("baseUrl required", { status: 400, headers: CORS_HEADERS });

    const ollamaRoot = baseUrl.replace(/\/v1\/?$/, "");

    try {
      const res = await fetch(`${ollamaRoot}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        return new Response(JSON.stringify({ error: `Ollama returned ${res.status}` }), {
          status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const data = await res.json() as { models?: Array<{ name: string }> };
      const models = (data.models ?? []).map((m) => m.name);
      return new Response(JSON.stringify({ models, connected: true }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cannot reach Ollama";
      return new Response(JSON.stringify({ error: msg, connected: false }), {
        status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;
