import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

const GATEWAY_SENTINEL = "__HERCULES_GATEWAY__";
const GATEWAY_URL = "https://ai-gateway.hercules.app/v1";

async function seedDefaultProvider(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("providers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (existing.length === 0) {
    await ctx.db.insert("providers", {
      userId,
      name: "NeverSoft AI (Built-in)",
      type: "openai_compatible",
      baseUrl: GATEWAY_URL,
      apiKeyEncrypted: GATEWAY_SENTINEL,
      isDefault: true,
      isEnabled: true,
      models: [
        "openai/gpt-4o-mini",
        "openai/gpt-4o",
        "anthropic/claude-sonnet-4-5-20250929",
        "anthropic/claude-3-5-haiku-20241022",
      ],
    });
  }
}

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: identity.name,
        email: identity.email,
        avatar: identity.profileUrl,
      });
      await seedDefaultProvider(ctx, existing._id);
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name,
      email: identity.email,
      avatar: identity.profileUrl,
    });

    await seedDefaultProvider(ctx, userId);
    return userId;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
  },
});
