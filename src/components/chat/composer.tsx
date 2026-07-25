import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSelector } from "@/lib/store";
import { cn } from "@/lib/utils";

type Props = {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  sendOnEnter: boolean;
};

export function Composer({
  onSend,
  onStop,
  isStreaming,
  disabled,
  sendOnEnter,
}: Props) {
  const [text, setText] = useState("");
  const templates = useSelector((s) => s.templates);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea up to a cap.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div className="border-t border-border bg-background/80 px-3 py-3 pb-safe backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        {templates.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="mb-1 size-9 shrink-0 text-muted-foreground"
                aria-label="Insert prompt template"
              >
                <Wand2 className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-w-[16rem]">
              {templates.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() =>
                    setText((prev) =>
                      prev ? `${prev}\n\n${t.content}` : t.content,
                    )
                  }
                >
                  <span className="truncate">{t.title}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div
          className={cn(
            "flex flex-1 items-end rounded-2xl border border-input bg-card px-3 py-1.5",
            "focus-within:ring-2 focus-within:ring-ring",
          )}
        >
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && sendOnEnter) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={
              disabled ? "Configure a provider to start chatting…" : "Message…"
            }
            disabled={disabled}
            className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
        </div>

        {isStreaming ? (
          <Button
            size="icon"
            variant="secondary"
            className="mb-0.5 size-9 shrink-0 rounded-full"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <Square className="size-4 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="mb-0.5 size-9 shrink-0 rounded-full"
            onClick={submit}
            disabled={!text.trim() || disabled}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
