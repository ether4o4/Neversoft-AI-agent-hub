import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./message-bubble";
import { Composer } from "./composer";
import { ModelPicker } from "./model-picker";
import { ConversationSettings } from "./conversation-settings";
import { conversationsApi, messagesApi, useSelector } from "@/lib/store";
import { streamChat, type ChatCallbacks } from "@/lib/chat";
import { streamWebLLM } from "@/lib/webllm";
import {
  providerIsUsable,
  providerMissingReason,
  type Message,
  type Provider,
} from "@/lib/models";
import { toast } from "sonner";

type StreamState = {
  messageId: string;
  text: string;
  progress?: string;
} | null;

export function ChatView({
  conversationId,
  onOpenSidebar,
}: {
  conversationId: string;
  onOpenSidebar: () => void;
}) {
  const conversation = useSelector((s) =>
    s.conversations.find((c) => c.id === conversationId),
  );
  const messages = useSelector((s) =>
    s.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt - b.createdAt),
  );
  const providers = useSelector((s) => s.providers);
  const settings = useSelector((s) => s.settings);

  const [stream, setStream] = useState<StreamState>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeProvider: Provider | undefined = conversation?.providerId
    ? providers.find((p) => p.id === conversation.providerId)
    : (providers.find((p) => p.isDefault && p.isEnabled) ??
      providers.find((p) => p.isEnabled));

  const providerReady = activeProvider
    ? providerIsUsable(activeProvider)
    : false;

  // Keep the newest message in view while streaming.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: stream ? "auto" : "smooth" });
  }, [messages.length, stream?.text, stream]);

  const runCompletion = useCallback(
    (history: Pick<Message, "role" | "content">[], assistantId: string) => {
      if (!conversation || !activeProvider) return;
      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = Date.now();

      const callbacks: ChatCallbacks = {
        onToken: (delta) =>
          setStream((prev) =>
            prev && prev.messageId === assistantId
              ? { ...prev, text: prev.text + delta }
              : prev,
          ),
        onDone: (full) => {
          messagesApi.update(assistantId, {
            content: full,
            durationMs: Date.now() - startedAt,
          });
          setStream(null);
          abortRef.current = null;
        },
        onError: (message) => {
          messagesApi.update(assistantId, { content: "", error: message });
          setStream(null);
          abortRef.current = null;
          toast.error(message);
        },
      };

      const req = {
        provider: activeProvider,
        model: conversation.modelId ?? activeProvider.models?.[0] ?? "",
        system: conversation.systemPrompt || undefined,
        messages: history,
        params: {
          temperature: conversation.temperature,
          maxTokens: conversation.maxTokens,
          topP: conversation.topP,
        },
        signal: controller.signal,
      };

      if (activeProvider.type === "webllm") {
        void streamWebLLM(req, callbacks, (report) =>
          setStream((prev) =>
            prev && prev.messageId === assistantId
              ? { ...prev, progress: report.text }
              : prev,
          ),
        );
      } else {
        void streamChat(req, callbacks);
      }
    },
    [conversation, activeProvider],
  );

  const handleSend = useCallback(
    (text: string) => {
      if (!conversation || !activeProvider) return;

      const history: Pick<Message, "role" | "content">[] = messages
        .filter((m) => !m.error && m.content.trim() !== "")
        .map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: text });

      messagesApi.add({
        conversationId,
        role: "user",
        content: text,
      });

      // Name the conversation from its first user turn.
      if (
        conversation.title === "New chat" &&
        messages.filter((m) => m.role === "user").length === 0
      ) {
        conversationsApi.update(conversationId, {
          title: text.slice(0, 48) + (text.length > 48 ? "…" : ""),
        });
      }

      const assistantId = messagesApi.add({
        conversationId,
        role: "assistant",
        content: "",
        providerId: activeProvider.id,
        modelId: conversation.modelId,
      });
      setStream({ messageId: assistantId, text: "" });
      runCompletion(history, assistantId);
    },
    [conversation, activeProvider, messages, conversationId, runCompletion],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (stream) {
      messagesApi.update(stream.messageId, { content: stream.text });
    }
    setStream(null);
  }, [stream]);

  const handleRetry = useCallback(
    (assistantMessage: Message) => {
      if (!conversation || !activeProvider) return;
      const priorHistory = messages
        .filter(
          (m) =>
            m.createdAt < assistantMessage.createdAt &&
            !m.error &&
            m.content.trim() !== "",
        )
        .map((m) => ({ role: m.role, content: m.content }));
      messagesApi.update(assistantMessage.id, {
        content: "",
        error: undefined,
      });
      setStream({ messageId: assistantMessage.id, text: "" });
      runCompletion(priorHistory, assistantMessage.id);
    },
    [conversation, activeProvider, messages, runCompletion],
  );

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Select or start a conversation.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border px-3 pt-safe">
        <div className="flex h-12 w-full items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={onOpenSidebar}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <ModelPicker conversation={conversation} />
          </div>
          <ConversationSettings conversation={conversation}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Conversation settings"
            >
              <Settings2 className="size-4" />
            </Button>
          </ConversationSettings>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-base font-medium">How can I help?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {providerReady
                  ? "Send a message to start the conversation."
                  : activeProvider
                    ? `Provider not ready: ${providerMissingReason(activeProvider)}.`
                    : "Add an AI provider in Settings to begin."}
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl py-2">
            {messages.map((m) => {
              const isStreamingThis = stream?.messageId === m.id;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  streamingText={isStreamingThis ? stream.text : undefined}
                  isStreaming={isStreamingThis}
                  onRetry={
                    m.role === "assistant" && !stream
                      ? () => handleRetry(m)
                      : undefined
                  }
                  onDelete={
                    !stream ? () => messagesApi.remove(m.id) : undefined
                  }
                />
              );
            })}
            {stream?.progress && (
              <p className="px-4 pb-2 text-xs text-muted-foreground">
                {stream.progress}
              </p>
            )}
            <div ref={bottomRef} className="h-2" />
          </div>
        )}
      </div>

      {/* Composer */}
      <Composer
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={stream !== null}
        disabled={!providerReady}
        sendOnEnter={settings.sendOnEnter}
      />
    </div>
  );
}
