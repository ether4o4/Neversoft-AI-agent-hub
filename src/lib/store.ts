/**
 * Local-first application store.
 *
 * The NeverSoft container runs fully on-device: conversations, messages,
 * providers (including API keys) and prompt templates all live in the browser's
 * localStorage. There is no server round-trip, which is what lets the packaged
 * APK work offline and without any backend deployment. The Convex functions in
 * /convex remain available for a hosted deployment, but the shipped app talks to
 * LLM providers directly from the device.
 */

import { useSyncExternalStore } from "react";
import { uid } from "./id";
import type { Conversation, Message, Provider, PromptTemplate } from "./models";

const STORAGE_KEY = "neversoft-ai/state/v1";

export type AppState = {
  conversations: Conversation[];
  messages: Message[];
  providers: Provider[];
  templates: PromptTemplate[];
  settings: {
    defaultSystemPrompt: string;
    streaming: boolean;
    sendOnEnter: boolean;
  };
};

const DEFAULT_STATE: AppState = {
  conversations: [],
  messages: [],
  providers: [],
  templates: [
    {
      id: uid(),
      title: "Concise assistant",
      content:
        "You are a concise, helpful assistant. Prefer short, direct answers and use code blocks for code.",
      category: "General",
    },
    {
      id: uid(),
      title: "Code reviewer",
      content:
        "You are a senior engineer. Review the code the user shares for correctness, edge cases and clarity. Be specific and cite line numbers where possible.",
      category: "Coding",
    },
  ],
  settings: {
    defaultSystemPrompt: "",
    streaming: true,
    sendOnEnter: true,
  },
};

function load(): AppState {
  if (typeof localStorage === "undefined")
    return structuredClone(DEFAULT_STATE);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      settings: { ...DEFAULT_STATE.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota errors are non-fatal; the in-memory state stays authoritative.
  }
}

function set(update: (prev: AppState) => AppState) {
  state = update(state);
  persist();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

/** Subscribe a component to the whole store (rarely needed directly). */
export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Select a derived slice; recomputed on every render (cheap for this app). */
export function useSelector<T>(selector: (s: AppState) => T): T {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return selector(snap);
}

/* ------------------------------- Providers ------------------------------- */

export const providersApi = {
  upsert(provider: Omit<Provider, "id"> & { id?: string }): string {
    const id = provider.id ?? uid();
    set((s) => {
      const exists = s.providers.some((p) => p.id === id);
      const next: Provider = { ...provider, id };
      let providers = exists
        ? s.providers.map((p) => (p.id === id ? next : p))
        : [...s.providers, next];
      // Only one default at a time.
      if (next.isDefault) {
        providers = providers.map((p) =>
          p.id === id ? p : { ...p, isDefault: false },
        );
      }
      return { ...s, providers };
    });
    return id;
  },
  remove(id: string) {
    set((s) => ({ ...s, providers: s.providers.filter((p) => p.id !== id) }));
  },
  setDefault(id: string) {
    set((s) => ({
      ...s,
      providers: s.providers.map((p) => ({ ...p, isDefault: p.id === id })),
    }));
  },
  markTested(id: string, status: "ok" | "error") {
    set((s) => ({
      ...s,
      providers: s.providers.map((p) =>
        p.id === id
          ? {
              ...p,
              lastTestStatus: status,
              lastTestedAt: new Date().toISOString(),
            }
          : p,
      ),
    }));
  },
};

/* ----------------------------- Conversations ----------------------------- */

export const conversationsApi = {
  create(init?: Partial<Conversation>): string {
    const id = uid();
    const now = Date.now();
    set((s) => {
      const defaultProvider =
        s.providers.find((p) => p.isDefault && p.isEnabled) ??
        s.providers.find((p) => p.isEnabled);
      const conv: Conversation = {
        id,
        title: init?.title ?? "New chat",
        systemPrompt:
          init?.systemPrompt ?? (s.settings.defaultSystemPrompt || undefined),
        providerId: init?.providerId ?? defaultProvider?.id,
        modelId: init?.modelId ?? defaultProvider?.models?.[0],
        temperature: init?.temperature,
        maxTokens: init?.maxTokens,
        topP: init?.topP,
        createdAt: now,
        updatedAt: now,
      };
      return { ...s, conversations: [conv, ...s.conversations] };
    });
    return id;
  },
  update(id: string, patch: Partial<Conversation>) {
    set((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
      ),
    }));
  },
  togglePin(id: string) {
    set((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === id
          ? { ...c, pinnedAt: c.pinnedAt ? undefined : Date.now() }
          : c,
      ),
    }));
  },
  remove(id: string) {
    set((s) => ({
      ...s,
      conversations: s.conversations.filter((c) => c.id !== id),
      messages: s.messages.filter((m) => m.conversationId !== id),
    }));
  },
  clearAll() {
    set((s) => ({ ...s, conversations: [], messages: [] }));
  },
};

/* -------------------------------- Messages ------------------------------- */

export const messagesApi = {
  add(
    msg: Omit<Message, "id" | "createdAt"> & {
      id?: string;
      createdAt?: number;
    },
  ): string {
    const id = msg.id ?? uid();
    const createdAt = msg.createdAt ?? Date.now();
    set((s) => ({
      ...s,
      messages: [...s.messages, { ...msg, id, createdAt }],
      conversations: s.conversations.map((c) =>
        c.id === msg.conversationId ? { ...c, updatedAt: createdAt } : c,
      ),
    }));
    return id;
  },
  update(id: string, patch: Partial<Message>) {
    set((s) => ({
      ...s,
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  },
  remove(id: string) {
    set((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== id) }));
  },
  clear(conversationId: string) {
    set((s) => ({
      ...s,
      messages: s.messages.filter((m) => m.conversationId !== conversationId),
    }));
  },
};

/* ------------------------------- Templates ------------------------------- */

export const templatesApi = {
  upsert(t: Omit<PromptTemplate, "id"> & { id?: string }): string {
    const id = t.id ?? uid();
    set((s) => {
      const exists = s.templates.some((x) => x.id === id);
      const next = { ...t, id };
      return {
        ...s,
        templates: exists
          ? s.templates.map((x) => (x.id === id ? next : x))
          : [...s.templates, next],
      };
    });
    return id;
  },
  remove(id: string) {
    set((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }));
  },
};

/* -------------------------------- Settings ------------------------------- */

export const settingsApi = {
  update(patch: Partial<AppState["settings"]>) {
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
};

/* ------------------------------ Import/Export ---------------------------- */

export function exportState(): string {
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as Partial<AppState>;
    set((s) => ({
      ...s,
      ...parsed,
      settings: { ...s.settings, ...(parsed.settings ?? {}) },
    }));
    return true;
  } catch {
    return false;
  }
}
