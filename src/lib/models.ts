/**
 * Domain types and provider catalogue shared by the local store, the chat
 * transport and the settings UI.
 */

export const PROVIDER_TYPES = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "groq",
  "openrouter",
  "ollama",
  "openai_compatible",
  "webllm",
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export type Provider = {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  isDefault?: boolean;
  isEnabled: boolean;
  models?: string[];
  lastTestedAt?: string;
  lastTestStatus?: "ok" | "error";
};

export type Role = "user" | "assistant" | "system";

export type Message = {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  modelId?: string;
  providerId?: string;
  durationMs?: number;
  error?: string;
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  systemPrompt?: string;
  modelId?: string;
  providerId?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  pinnedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type PromptTemplate = {
  id: string;
  title: string;
  content: string;
  category?: string;
};

type ProviderMeta = {
  label: string;
  /** Blank for providers whose endpoint is user-supplied. */
  baseUrl: string;
  /** Whether a key must be present before the provider can be used. */
  needsApiKey: boolean;
  /** Seeded into the model picker before a live model list is fetched. */
  models: string[];
  docsHint: string;
};

export const PROVIDER_CATALOG: Record<ProviderType, ProviderMeta> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    needsApiKey: true,
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "o4-mini"],
    docsHint: "API key from platform.openai.com",
  },
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    needsApiKey: true,
    models: [
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
      "claude-3-5-haiku-20241022",
    ],
    docsHint: "API key from console.anthropic.com",
  },
  google: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    needsApiKey: true,
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
    docsHint: "API key from aistudio.google.com",
  },
  mistral: {
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    needsApiKey: true,
    models: ["mistral-small-latest", "mistral-large-latest"],
    docsHint: "API key from console.mistral.ai",
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    needsApiKey: true,
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    docsHint: "API key from console.groq.com",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    needsApiKey: true,
    models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"],
    docsHint: "API key from openrouter.ai/keys",
  },
  ollama: {
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    needsApiKey: false,
    models: ["llama3.2", "qwen2.5", "phi4"],
    docsHint:
      "Point at your machine's LAN address, e.g. http://192.168.1.10:11434/v1",
  },
  openai_compatible: {
    label: "OpenAI-compatible",
    baseUrl: "",
    needsApiKey: false,
    models: [],
    docsHint: "Any server exposing /chat/completions",
  },
  webllm: {
    label: "In-browser (WebLLM)",
    baseUrl: "",
    needsApiKey: false,
    models: [
      "Llama-3.2-1B-Instruct-q4f32_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    ],
    docsHint: "Runs fully offline on-device, requires WebGPU",
  },
};

export function providerBaseUrl(provider: Provider): string {
  return provider.baseUrl?.trim() || PROVIDER_CATALOG[provider.type].baseUrl;
}

export function providerDefaultModel(provider: Provider): string {
  return (
    provider.models?.[0] ?? PROVIDER_CATALOG[provider.type].models[0] ?? ""
  );
}

/** A provider is usable once it has an endpoint and, if required, a key. */
export function providerIsUsable(provider: Provider): boolean {
  if (!provider.isEnabled) return false;
  if (provider.type === "webllm") return true;
  if (!providerBaseUrl(provider)) return false;
  if (PROVIDER_CATALOG[provider.type].needsApiKey && !provider.apiKey?.trim()) {
    return false;
  }
  return true;
}

export function providerMissingReason(provider: Provider): string | null {
  if (!provider.isEnabled) return "Disabled";
  if (provider.type === "webllm") return null;
  if (!providerBaseUrl(provider)) return "No base URL set";
  if (PROVIDER_CATALOG[provider.type].needsApiKey && !provider.apiKey?.trim()) {
    return "No API key set";
  }
  return null;
}
