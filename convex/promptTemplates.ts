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
      .query("promptTemplates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await ctx.db.insert("promptTemplates", {
      userId: user._id,
      title: args.title,
      content: args.content,
      category: args.category,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("promptTemplates"),
    title: v.string(),
    content: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const t = await ctx.db.get(args.id);
    if (!t || t.userId !== user._id)
      throw new ConvexError({ message: "Not found", code: "NOT_FOUND" });
    await ctx.db.patch(args.id, { title: args.title, content: args.content, category: args.category });
  },
});

export const remove = mutation({
  args: { id: v.id("promptTemplates") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const t = await ctx.db.get(args.id);
    if (!t || t.userId !== user._id)
      throw new ConvexError({ message: "Not found", code: "NOT_FOUND" });
    await ctx.db.delete(args.id);
  },
});
