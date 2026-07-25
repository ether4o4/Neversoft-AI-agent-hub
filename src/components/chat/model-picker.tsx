import { useMemo } from "react";
import { Cpu } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROVIDER_CATALOG, type Conversation } from "@/lib/models";
import { conversationsApi, useSelector } from "@/lib/store";

/**
 * Compound provider+model selector. A single value encodes both, so switching
 * model and switching provider is one interaction. Disabled providers and those
 * missing credentials are still listed but not selectable as a fresh default.
 */
export function ModelPicker({ conversation }: { conversation: Conversation }) {
  const providers = useSelector((s) => s.providers);

  const options = useMemo(() => {
    return providers
      .filter((p) => p.isEnabled)
      .flatMap((p) => {
        const models = p.models?.length
          ? p.models
          : PROVIDER_CATALOG[p.type].models;
        return models.map((m) => ({
          value: `${p.id}::${m}`,
          providerId: p.id,
          providerName: p.name,
          model: m,
        }));
      });
  }, [providers]);

  const current =
    conversation.providerId && conversation.modelId
      ? `${conversation.providerId}::${conversation.modelId}`
      : undefined;

  if (options.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Cpu className="size-3.5" />
        No models — add a provider in Settings
      </div>
    );
  }

  return (
    <Select
      value={current}
      onValueChange={(value) => {
        const [providerId, model] = value.split("::");
        conversationsApi.update(conversation.id, {
          providerId,
          modelId: model,
        });
      }}
    >
      <SelectTrigger className="h-8 w-auto min-w-[13rem] max-w-[70vw] gap-1.5 border-none bg-transparent px-2 text-xs font-medium shadow-none hover:bg-accent">
        <Cpu className="size-3.5 text-primary" />
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {providers
          .filter((p) => p.isEnabled)
          .map((p) => {
            const models = p.models?.length
              ? p.models
              : PROVIDER_CATALOG[p.type].models;
            if (models.length === 0) return null;
            return (
              <SelectGroup key={p.id}>
                <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {p.name}
                </div>
                {models.map((m) => (
                  <SelectItem key={`${p.id}::${m}`} value={`${p.id}::${m}`}>
                    {m}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
      </SelectContent>
    </Select>
  );
}
