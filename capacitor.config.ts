import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the NeverSoft AI Android container.
 *
 * The web build in ./dist is bundled directly into the APK and served from the
 * app's own origin, so the packaged app runs entirely offline — it only reaches
 * the network when a chat request is sent to a user-configured provider.
 */
const config: CapacitorConfig = {
  appId: "ai.neversoft.container",
  appName: "NeverSoft AI",
  webDir: "dist",
  backgroundColor: "#111111",
  android: {
    backgroundColor: "#111111",
    // Allow plain-HTTP provider endpoints (e.g. a LAN Ollama server) in
    // addition to HTTPS. Cleartext is opt-in per host at the OS level too.
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#111111",
      showSpinner: false,
      androidSplashResourceName: "splash",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#141414",
    },
  },
};

export default config;
