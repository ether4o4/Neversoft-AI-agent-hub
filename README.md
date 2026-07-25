# NeverSoft AI Container

Run any AI model anywhere — cloud APIs, a local Ollama server, or fully offline
in-browser — from a single, self-contained app. NeverSoft AI Container ships as
both a web app (PWA) and an **installable Android APK**.

The app is **local-first**: conversations, prompt templates and provider
credentials live entirely on the device in `localStorage`. Nothing is sent to a
server except the chat requests you make directly to the AI provider you
configure. That is what lets the packaged APK run without any backend.

## Features

- **Bring your own provider** — OpenAI, Anthropic, Google Gemini, Mistral, Groq,
  OpenRouter, a local **Ollama** server, any **OpenAI-compatible** endpoint, or
  **WebLLM** (fully on-device inference via WebGPU).
- **Streaming chat** with Markdown, syntax-highlighted code blocks and copy
  buttons.
- **Conversation management** — create, rename, pin, search and delete chats;
  everything persists locally.
- **Per-chat controls** — system prompt, temperature, top-p and max tokens.
- **Prompt templates** — reusable prompts you can drop into any conversation.
- **Import / export** your entire workspace as JSON.
- **Native Android shell** — status-bar theming, splash screen, hardware
  back-button handling and offline asset caching.

## Tech stack

- React 19 + Vite 7 + TypeScript, Tailwind CSS v4, Radix UI primitives.
- [Capacitor 7](https://capacitorjs.com) wraps the built web app into a native
  Android project.
- Optional Convex backend (see `convex/`) for a hosted, multi-device deployment
  — not required by the shipped app.

## Getting started (web)

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

Open **Settings → Providers**, add a provider with your API key (or point at a
local Ollama server), then start chatting.

## Building the Android APK

Prerequisites: **JDK 21**, the **Android SDK** (platform 35 + build-tools
35.0.0), Node 22 and pnpm.

```bash
# One-shot: build the web bundle, sync it into the native project, assemble APK
pnpm android:build

# The debug APK is written to:
#   android/app/build/outputs/apk/debug/app-debug.apk
```

Under the hood this runs:

```bash
pnpm build                 # tsc + vite build  ->  dist/
pnpm exec cap sync android # copy dist/ into the Android project
cd android && ./gradlew assembleDebug
```

Install it on a device or emulator:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Continuous integration

`.github/workflows/android.yml` lints, type-checks, builds the web bundle and
assembles the debug APK on every push, uploading `app-debug.apk` as a workflow
artifact — a reproducible, downloadable build.

### Release builds

`pnpm android:release` produces an unsigned release APK. To ship one, configure
a signing key in `android/app/build.gradle` (or via a `keystore.properties`) and
run `./gradlew assembleRelease`.

## App icons

Launcher and PWA icons are generated from a single dependency-free script:

```bash
node scripts/generate-icons.mjs 512:public/icon/icon-512.png:tile
```

See `scripts/generate-icons.mjs` for the full set produced for each density.

## Project layout

```
src/
  App.tsx                 App shell: sidebar, chat, settings, native init
  components/
    chat/                 Chat view, composer, message bubbles, model picker
    settings/             Providers, templates and general settings
    ui/                   Radix-based design-system primitives
  lib/
    models.ts             Domain types + provider catalogue
    store.ts              Local-first store (localStorage) via useSyncExternalStore
    chat.ts               Direct-to-provider streaming transport (SSE)
    webllm.ts             In-browser inference (lazy-loaded)
    native.ts             Capacitor bridge (no-ops on web)
convex/                   Optional hosted backend (not used by the APK)
android/                  Capacitor Android project
scripts/generate-icons.mjs  Brand icon generator
```
