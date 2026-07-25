import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { conversationsApi } from "@/lib/store";
import type { Conversation } from "@/lib/models";

/** Per-conversation model parameters and system prompt. */
export function ConversationSettings({
  conversation,
  children,
}: {
  conversation: Conversation;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const temperature = conversation.temperature ?? 0.7;
  const topP = conversation.topP ?? 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conversation settings</DialogTitle>
          <DialogDescription>These apply to this chat only.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={conversation.title}
              onChange={(e) =>
                conversationsApi.update(conversation.id, {
                  title: e.target.value,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="system">System prompt</Label>
            <Textarea
              id="system"
              rows={4}
              placeholder="You are a helpful assistant…"
              value={conversation.systemPrompt ?? ""}
              onChange={(e) =>
                conversationsApi.update(conversation.id, {
                  systemPrompt: e.target.value,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Temperature</Label>
              <span className="text-sm text-muted-foreground">
                {temperature.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[temperature]}
              onValueChange={([v]) =>
                conversationsApi.update(conversation.id, { temperature: v })
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Top P</Label>
              <span className="text-sm text-muted-foreground">
                {topP.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[topP]}
              onValueChange={([v]) =>
                conversationsApi.update(conversation.id, { topP: v })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTokens">Max tokens</Label>
            <Input
              id="maxTokens"
              type="number"
              min={1}
              placeholder="4096"
              value={conversation.maxTokens ?? ""}
              onChange={(e) =>
                conversationsApi.update(conversation.id, {
                  maxTokens: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
