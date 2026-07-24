import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  return user;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conv = await ctx.db.get(args.id);
    if (!conv || conv.userId !== user._id) return null;
    return conv;
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    modelId: v.optional(v.string()),
    providerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await ctx.db.insert("conversations", {
      userId: user._id,
      title: args.title ?? "New Conversation",
      systemPrompt: args.systemPrompt,
      modelId: args.modelId,
      providerId: args.providerId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("conversations"),
    title: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    modelId: v.optional(v.string()),
    providerId: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    topP: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { id, ...rest } = args;
    const conv = await ctx.db.get(id);
    if (!conv || conv.userId !== user._id)
      throw new ConvexError({ message: "Not found", code: "NOT_FOUND" });
    await ctx.db.patch(id, rest);
  },
});

export const remove = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conv = await ctx.db.get(args.id);
    if (!conv || conv.userId !== user._id)
      throw new ConvexError({ message: "Not found", code: "NOT_FOUND" });
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.id))
      .collect();
    for (const m of msgs) await ctx.db.delete(m._id);
    await ctx.db.delete(args.id);
  },
});
