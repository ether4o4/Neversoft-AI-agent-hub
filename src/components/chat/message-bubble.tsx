import { memo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/models";

type Props = {
  message: Message;
  /** Live text while this message is streaming; overrides stored content. */
  streamingText?: string;
  isStreaming?: boolean;
  onRetry?: () => void;
  onDelete?: () => void;
};

function MessageBubbleImpl({
  message,
  streamingText,
  isStreaming,
  onRetry,
  onDelete,
}: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const content = streamingText ?? message.content;

  return (
    <div
      className={cn(
        "group flex w-full gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isUser
            ? "bg-secondary text-secondary-foreground"
            : "bg-primary/15 text-primary",
        )}
      >
        {isUser ? <User className="size-4" /> : "AI"}
      </div>

      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-secondary text-secondary-foreground whitespace-pre-wrap break-words"
              : "bg-card text-card-foreground w-full",
          )}
        >
          {message.error ? (
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span className="text-sm">{message.error}</span>
            </div>
          ) : isUser ? (
            content
          ) : content ? (
            <Markdown content={content} />
          ) : isStreaming ? (
            <span className="inline-flex gap-1 py-1">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            "flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100",
            isStreaming && "hidden",
          )}
        >
          {!message.error && content && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              onClick={() => {
                void navigator.clipboard?.writeText(content).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          )}
          {onRetry && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              onClick={onRetry}
              aria-label="Retry"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              onClick={onDelete}
              aria-label="Delete message"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          {message.modelId && !message.error && (
            <span className="ml-1 text-[11px] text-muted-foreground">
              {message.modelId}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
