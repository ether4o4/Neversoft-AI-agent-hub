import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel.d.ts";

type StreamContext = {
  conversation: Doc<"conversations">;
  provider: Doc<"providers">;
  messages: Doc<"messages">[];
};

export const getStreamContext = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<StreamContext | null> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();
    if (!user) return null;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) return null;

    let provider: Doc<"providers"> | null = null;
    if (conversation.providerId) {
      const p = await ctx.db.get(conversation.providerId as Doc<"providers">["_id"]);
      if (p && p.isEnabled) provider = p;
    }
    if (!provider) {
      const all = await ctx.db
        .query("providers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      provider =
        all.find((p) => p.isDefault && p.isEnabled) ??
        all.find((p) => p.isEnabled) ??
        null;
    }
    if (!provider) return null;

    const messages = (
      await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
        .order("asc")
        .collect()
    ).filter((m) => m.content.trim() !== "");

    return { conversation, provider, messages };
  },
});

export const testProvider = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    providerId: v.id("providers"),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();
    if (!user) return { ok: false, error: "Not authenticated" };

    const provider = await ctx.db.get(args.providerId);
    if (!provider || provider.userId !== user._id) return { ok: false, error: "Provider not found" };

    const hasKey = !!provider.apiKeyEncrypted;
    const needsKey = !["ollama", "openai_compatible", "webllm"].includes(provider.type);
    if (needsKey && !hasKey) return { ok: false, error: "No API key configured" };

    return { ok: true };
  },
});

export const getProviderForUser = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    providerId: v.id("providers"),
  },
  handler: async (ctx, args): Promise<Doc<"providers"> | null> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();
    if (!user) return null;

    const provider = await ctx.db.get(args.providerId);
    if (!provider || provider.userId !== user._id) return null;
    return provider;
  },
});
