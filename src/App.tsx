import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/sidebar";
import { ChatView } from "@/components/chat/chat-view";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { conversationsApi, useSelector } from "@/lib/store";
import { useServiceWorker } from "@/hooks/use-service-worker";
import { initNativeShell, onHardwareBack } from "@/lib/native";
import { cn } from "@/lib/utils";

export default function App() {
  const conversations = useSelector((s) => s.conversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useServiceWorker();

  // Configure the native shell (status bar, safe areas, splash) once.
  useEffect(() => {
    void initNativeShell();
  }, []);

  // Android hardware back: close whatever is open before exiting the app.
  useEffect(() => {
    let cleanup = () => {};
    void onHardwareBack(() => {
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      return false;
    }).then((fn) => (cleanup = fn));
    return () => cleanup();
  }, [settingsOpen, drawerOpen]);

  // Keep a valid active conversation selected.
  useEffect(() => {
    if (activeId && conversations.some((c) => c.id === activeId)) return;
    setActiveId(conversations[0]?.id ?? null);
  }, [conversations, activeId]);

  const newChat = () => {
    const id = conversationsApi.create();
    setActiveId(id);
    setDrawerOpen(false);
  };

  const select = (id: string) => {
    setActiveId(id);
    setDrawerOpen(false);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full w-full overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 shrink-0 border-r border-sidebar-border md:block">
          <Sidebar
            activeId={activeId}
            onSelect={select}
            onNew={newChat}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </aside>

        {/* Mobile drawer */}
        <div
          className={cn(
            "fixed inset-0 z-40 md:hidden",
            drawerOpen ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          <div
            className={cn(
              "absolute inset-0 bg-black/60 transition-opacity",
              drawerOpen ? "opacity-100" : "opacity-0",
            )}
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className={cn(
              "absolute left-0 top-0 h-full w-[80%] max-w-xs border-r border-sidebar-border shadow-xl transition-transform",
              drawerOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <Sidebar
              activeId={activeId}
              onSelect={select}
              onNew={newChat}
              onOpenSettings={() => {
                setDrawerOpen(false);
                setSettingsOpen(true);
              }}
            />
          </aside>
        </div>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col">
          {activeId ? (
            <ChatView
              key={activeId}
              conversationId={activeId}
              onOpenSidebar={() => setDrawerOpen(true)}
            />
          ) : (
            <WelcomeScreen
              onNew={newChat}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Toaster theme="dark" position="top-center" richColors />
    </TooltipProvider>
  );
}

function WelcomeScreen({
  onNew,
  onOpenSettings,
}: {
  onNew: () => void;
  onOpenSettings: () => void;
}) {
  const hasProvider = useSelector((s) => s.providers.some((p) => p.isEnabled));
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 pt-safe text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-primary/15 text-2xl font-bold text-primary">
        NS
      </div>
      <div>
        <h1 className="text-xl font-semibold">NeverSoft AI Container</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Run any AI model anywhere — cloud APIs, a local Ollama server, or
          fully offline in-browser. Everything stays on your device.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onNew}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Start a new chat
        </button>
        {!hasProvider && (
          <button
            onClick={onOpenSettings}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            First, add an AI provider →
          </button>
        )}
      </div>
    </div>
  );
}
