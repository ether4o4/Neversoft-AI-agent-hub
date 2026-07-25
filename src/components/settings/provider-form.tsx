import { useState } from "react";
import { Loader2, Wifi } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROVIDER_CATALOG,
  PROVIDER_TYPES,
  type Provider,
  type ProviderType,
} from "@/lib/models";
import { providersApi } from "@/lib/store";
import { fetchModels, fetchOllamaTags } from "@/lib/chat";
import { toast } from "sonner";

type Draft = {
  id?: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  models: string;
  isEnabled: boolean;
  isDefault: boolean;
};

function toDraft(p?: Provider): Draft {
  if (!p) {
    return {
      name: "",
      type: "openai",
      baseUrl: "",
      apiKey: "",
      models: "",
      isEnabled: true,
      isDefault: false,
    };
  }
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    baseUrl: p.baseUrl ?? "",
    apiKey: p.apiKey ?? "",
    models: (p.models ?? []).join(", "),
    isEnabled: p.isEnabled,
    isDefault: !!p.isDefault,
  };
}

export function ProviderForm({
  provider,
  open,
  onOpenChange,
}: {
  provider?: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(provider));
  const [busy, setBusy] = useState(false);
  const meta = PROVIDER_CATALOG[draft.type];

  // Reset the form each time it is opened for a (possibly different) provider.
  const [seededFor, setSeededFor] = useState<string | undefined>(provider?.id);
  if (open && seededFor !== provider?.id) {
    setDraft(toDraft(provider));
    setSeededFor(provider?.id);
  }

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const parsedModels = () =>
    draft.models
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

  const save = () => {
    if (!draft.name.trim()) {
      toast.error("Give the provider a name.");
      return;
    }
    providersApi.upsert({
      id: draft.id,
      name: draft.name.trim(),
      type: draft.type,
      baseUrl: draft.baseUrl.trim() || undefined,
      apiKey: draft.apiKey.trim() || undefined,
      models: parsedModels().length ? parsedModels() : undefined,
      isEnabled: draft.isEnabled,
      isDefault: draft.isDefault,
    });
    toast.success(draft.id ? "Provider updated" : "Provider added");
    onOpenChange(false);
  };

  const testAndFetch = async () => {
    setBusy(true);
    try {
      const asProvider: Provider = {
        id: draft.id ?? "temp",
        name: draft.name,
        type: draft.type,
        baseUrl: draft.baseUrl.trim() || undefined,
        apiKey: draft.apiKey.trim() || undefined,
        isEnabled: true,
      };
      const models =
        draft.type === "ollama"
          ? await fetchOllamaTags(draft.baseUrl.trim() || meta.baseUrl)
          : await fetchModels(asProvider);
      if (models.length) {
        update({ models: models.join(", ") });
        toast.success(`Connected — found ${models.length} models`);
      } else {
        toast.success("Connected");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {draft.id ? "Edit provider" : "Add provider"}
          </DialogTitle>
          <DialogDescription>{meta.docsHint}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={draft.type}
                onValueChange={(v) => {
                  const type = v as ProviderType;
                  update({
                    type,
                    name: draft.name || PROVIDER_CATALOG[type].label,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PROVIDER_CATALOG[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder={meta.label}
              />
            </div>
          </div>

          {draft.type !== "webllm" && (
            <div className="space-y-2">
              <Label htmlFor="p-url">Base URL</Label>
              <Input
                id="p-url"
                value={draft.baseUrl}
                onChange={(e) => update({ baseUrl: e.target.value })}
                placeholder={meta.baseUrl || "https://…/v1"}
              />
            </div>
          )}

          {meta.needsApiKey && (
            <div className="space-y-2">
              <Label htmlFor="p-key">API key</Label>
              <Input
                id="p-key"
                type="password"
                autoComplete="off"
                value={draft.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                placeholder="sk-…"
              />
              <p className="text-xs text-muted-foreground">
                Stored only on this device.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="p-models">Models (comma separated)</Label>
            <Input
              id="p-models"
              value={draft.models}
              onChange={(e) => update({ models: e.target.value })}
              placeholder={meta.models.slice(0, 2).join(", ") || "model-id"}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.isEnabled}
                  onCheckedChange={(v) => update({ isEnabled: v })}
                />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.isDefault}
                  onCheckedChange={(v) => update({ isDefault: v })}
                />
                Default
              </label>
            </div>
            {draft.type !== "webllm" && (
              <Button
                variant="outline"
                size="sm"
                onClick={testAndFetch}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wifi className="size-4" />
                )}
                Test
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
