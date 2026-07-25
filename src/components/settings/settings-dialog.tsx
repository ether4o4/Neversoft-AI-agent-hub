import { useRef, useState } from "react";
import {
  BadgeCheck,
  CircleAlert,
  Download,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ProviderForm } from "./provider-form";
import {
  PROVIDER_CATALOG,
  providerMissingReason,
  type Provider,
  type PromptTemplate,
} from "@/lib/models";
import {
  conversationsApi,
  exportState,
  importState,
  providersApi,
  settingsApi,
  templatesApi,
  useSelector,
} from "@/lib/store";
import { toast } from "sonner";

function ProvidersTab() {
  const providers = useSelector((s) => s.providers);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | undefined>(undefined);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add the AI backends you want to use. Keys stay on-device.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {providers.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No providers yet. Add OpenAI, Anthropic, Google, Groq, a local Ollama
          server, or any OpenAI-compatible endpoint.
        </div>
      )}

      <div className="space-y-2">
        {providers.map((p) => {
          const issue = providerMissingReason(p);
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  {p.isDefault && (
                    <Badge variant="default">
                      <Star className="mr-1 size-3" />
                      Default
                    </Badge>
                  )}
                  {issue ? (
                    <Badge variant="destructive">
                      <CircleAlert className="mr-1 size-3" />
                      {issue}
                    </Badge>
                  ) : (
                    <Badge variant="success">
                      <BadgeCheck className="mr-1 size-3" />
                      Ready
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {PROVIDER_CATALOG[p.type].label}
                  {p.models?.length ? ` · ${p.models.length} models` : ""}
                </p>
              </div>
              {!p.isDefault && p.isEnabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => providersApi.setDefault(p.id)}
                  aria-label="Make default"
                >
                  <Star className="size-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditing(p);
                  setFormOpen(true);
                }}
                aria-label="Edit provider"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => providersApi.remove(p.id)}
                aria-label="Delete provider"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <ProviderForm
        provider={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}

function TemplatesTab() {
  const templates = useSelector((s) => s.templates);
  const [draft, setDraft] = useState<PromptTemplate | null>(null);

  const startNew = () =>
    setDraft({ id: "", title: "", content: "", category: "" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reusable prompts you can drop into any chat.
        </p>
        <Button size="sm" onClick={startNew}>
          <Plus className="size-4" />
          New
        </Button>
      </div>

      {draft && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <Input
            placeholder="Title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <Textarea
            placeholder="Prompt content"
            rows={3}
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!draft.title.trim() || !draft.content.trim()) {
                  toast.error("Title and content are required.");
                  return;
                }
                templatesApi.upsert({
                  id: draft.id || undefined,
                  title: draft.title.trim(),
                  content: draft.content.trim(),
                  category: draft.category,
                });
                setDraft(null);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {t.content}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDraft(t)}
              aria-label="Edit template"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => templatesApi.remove(t.id)}
              aria-label="Delete template"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneralTab() {
  const settings = useSelector((s) => s.settings);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = () => {
    const blob = new Blob([exportState()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "neversoft-ai-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="default-system">Default system prompt</Label>
        <Textarea
          id="default-system"
          rows={3}
          placeholder="Applied to new conversations"
          value={settings.defaultSystemPrompt}
          onChange={(e) =>
            settingsApi.update({ defaultSystemPrompt: e.target.value })
          }
        />
      </div>

      <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
        <span>
          Send on <kbd className="rounded bg-muted px-1">Enter</kbd>
          <span className="ml-1 text-muted-foreground">
            (Shift+Enter for newline)
          </span>
        </span>
        <Switch
          checked={settings.sendOnEnter}
          onCheckedChange={(v) => settingsApi.update({ sendOnEnter: v })}
        />
      </label>

      <div className="space-y-2">
        <Label>Data</Label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={doExport}>
            <Download className="size-4" />
            Export backup
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" />
            Import backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const ok = importState(await file.text());
              toast[ok ? "success" : "error"](
                ok ? "Backup imported" : "Invalid backup file",
              );
              e.target.value = "";
            }}
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Delete all conversations? This cannot be undone.")) {
                conversationsApi.clearAll();
                toast.success("All conversations deleted");
              }
            }}
          >
            <Trash2 className="size-4" />
            Clear chats
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        NeverSoft AI Container runs on-device. Conversations and keys never
        leave this browser unless you export them.
      </p>
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Manage providers, prompt templates and app preferences.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="providers">
          <TabsList className="w-full">
            <TabsTrigger value="providers" className="flex-1">
              Providers
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-1">
              Templates
            </TabsTrigger>
            <TabsTrigger value="general" className="flex-1">
              General
            </TabsTrigger>
          </TabsList>
          <TabsContent value="providers">
            <ProvidersTab />
          </TabsContent>
          <TabsContent value="templates">
            <TemplatesTab />
          </TabsContent>
          <TabsContent value="general">
            <GeneralTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
