/**
 * In-browser inference via WebLLM. The engine and model weights are loaded
 * lazily the first time an offline conversation runs, so the initial app
 * bundle stays small and devices without WebGPU never pay the cost.
 */

import type { ChatCallbacks, ChatRequest } from "./chat";

type EngineModule = typeof import("@mlc-ai/web-llm");
type Engine = Awaited<ReturnType<EngineModule["CreateMLCEngine"]>>;

let enginePromise: Promise<Engine> | null = null;
let loadedModel: string | null = null;

export function webgpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

async function getEngine(
  model: string,
  onProgress?: (report: { text: string; progress: number }) => void,
): Promise<Engine> {
  if (enginePromise && loadedModel === model) return enginePromise;
  const mod = await import("@mlc-ai/web-llm");
  loadedModel = model;
  enginePromise = mod.CreateMLCEngine(model, {
    initProgressCallback: onProgress,
  });
  return enginePromise;
}

export async function streamWebLLM(
  req: ChatRequest,
  cb: ChatCallbacks,
  onProgress?: (report: { text: string; progress: number }) => void,
): Promise<void> {
  if (!webgpuAvailable()) {
    cb.onError(
      "This device has no WebGPU support, so in-browser (WebLLM) models can't run here.",
    );
    return;
  }
  try {
    const engine = await getEngine(req.model, onProgress);
    const messages = [
      ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
      ...req.messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];
    const chunks = await engine.chat.completions.create({
      messages,
      stream: true,
      temperature: req.params?.temperature ?? 0.7,
      top_p: req.params?.topP ?? 1,
    });
    let full = "";
    for await (const chunk of chunks) {
      if (req.signal?.aborted) break;
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        cb.onToken(delta);
      }
    }
    cb.onDone(full);
  } catch (err: unknown) {
    cb.onError(err instanceof Error ? err.message : "WebLLM failed to run.");
  }
}
