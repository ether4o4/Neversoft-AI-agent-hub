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
      .query("providers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("providers")),
    name: v.string(),
    type: v.union(
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google"),
      v.literal("mistral"),
      v.literal("groq"),
      v.literal("openrouter"),
      v.literal("ollama"),
      v.literal("openai_compatible"),
      v.literal("webllm"),
    ),
    baseUrl: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    isEnabled: v.boolean(),
    models: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { id, apiKey, ...rest } = args;
    const data = {
      ...rest,
      userId: user._id,
      apiKeyEncrypted: apiKey ?? undefined,
    };
    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing || existing.userId !== user._id)
        throw new ConvexError({ message: "Not found", code: "NOT_FOUND" });
      await ctx.db.patch(id, data);
      return id;
    }
    return await ctx.db.insert("providers", data);
  },
});

export const remove = mutation({
  args: { id: v.id("providers") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const p = await ctx.db.get(args.id);
    if (!p || p.userId !== user._id)
      throw new ConvexError({ message: "Not found", code: "NOT_FOUND" });
    await ctx.db.delete(args.id);
  },
});

export const setDefault = mutation({
  args: { id: v.id("providers") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const all = await ctx.db
      .query("providers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const p of all) {
      await ctx.db.patch(p._id, { isDefault: p._id === args.id });
    }
  },
});
