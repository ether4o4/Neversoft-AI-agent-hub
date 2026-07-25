import { useMemo, useState } from "react";
import {
  MessageSquarePlus,
  MoreHorizontal,
  Pin,
  PinOff,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { conversationsApi, useSelector } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/models";

function groupLabel(ts: number): string {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (now - ts < day) return "Today";
  if (now - ts < 7 * day) return "Previous 7 days";
  if (now - ts < 30 * day) return "Previous 30 days";
  return "Older";
}

export function Sidebar({
  activeId,
  onSelect,
  onNew,
  onOpenSettings,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onOpenSettings: () => void;
}) {
  const conversations = useSelector((s) => s.conversations);
  const [query, setQuery] = useState("");

  const { pinned, groups } = useMemo(() => {
    const filtered = conversations
      .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const pinned = filtered.filter((c) => c.pinnedAt);
    const rest = filtered.filter((c) => !c.pinnedAt);

    const groups = new Map<string, Conversation[]>();
    for (const c of rest) {
      const label = groupLabel(c.updatedAt);
      const arr = groups.get(label) ?? [];
      arr.push(c);
      groups.set(label, arr);
    }
    return { pinned, groups };
  }, [conversations, query]);

  const renderItem = (c: Conversation) => (
    <div
      key={c.id}
      className={cn(
        "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm",
        activeId === c.id
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/60",
      )}
    >
      <button
        className="min-w-0 flex-1 truncate text-left"
        onClick={() => onSelect(c.id)}
      >
        {c.pinnedAt && <Pin className="mr-1 inline size-3 text-primary" />}
        {c.title}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label="Conversation actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => conversationsApi.togglePin(c.id)}>
            {c.pinnedAt ? (
              <PinOff className="size-4" />
            ) : (
              <Pin className="size-4" />
            )}
            {c.pinnedAt ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => conversationsApi.remove(c.id)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-3 pt-safe">
        <div className="flex h-12 w-full items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
            NS
          </div>
          <span className="text-sm font-semibold">NeverSoft AI</span>
        </div>
      </div>

      <div className="px-3 pb-2">
        <Button className="w-full justify-start gap-2" onClick={onNew}>
          <MessageSquarePlus className="size-4" />
          New chat
        </Button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="h-8 pl-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No conversations yet.
          </p>
        )}
        {pinned.length > 0 && (
          <div>
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pinned
            </p>
            {pinned.map(renderItem)}
          </div>
        )}
        {[...groups.entries()].map(([label, items]) => (
          <div key={label}>
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            {items.map(renderItem)}
          </div>
        ))}
      </div>

      <div className="border-t border-sidebar-border px-3 py-2 pb-safe">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={onOpenSettings}
        >
          <Settings className="size-4" />
          Settings
        </Button>
      </div>
    </div>
  );
}
