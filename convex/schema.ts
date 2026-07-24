import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatar: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    systemPrompt: v.optional(v.string()),
    modelId: v.optional(v.string()),
    providerId: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    topP: v.optional(v.number()),
    pinnedAt: v.optional(v.string()),
  })
    .index("by_user", ["userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    modelId: v.optional(v.string()),
    providerId: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    finishReason: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  }).index("by_conversation", ["conversationId"]),

  providers: defineTable({
    userId: v.id("users"),
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
    apiKeyEncrypted: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    isEnabled: v.boolean(),
    models: v.optional(v.array(v.string())),
    lastTestedAt: v.optional(v.string()),
    lastTestStatus: v.optional(v.union(v.literal("ok"), v.literal("error"))),
  }).index("by_user", ["userId"]),

  promptTemplates: defineTable({
    userId: v.id("users"),
    title: v.string(),
    content: v.string(),
    category: v.optional(v.string()),
  }).index("by_user", ["userId"]),
});
