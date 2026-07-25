/**
 * Thin bridge over the Capacitor native layer.
 *
 * Every call degrades to a no-op on the web build, so the same code path serves
 * both the browser preview and the packaged Android APK. Plugins are imported
 * lazily and guarded, so a missing plugin never throws.
 */

import { Capacitor } from "@capacitor/core";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function platform(): string {
  return Capacitor.getPlatform();
}

/**
 * Configure the status bar and drive CSS safe-area insets from the real device
 * metrics. On the web this returns immediately.
 */
export async function initNativeShell(): Promise<void> {
  if (!isNative()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#141414" });
    // Keep the webview below the status bar so no content is obscured. This is
    // the most reliable layout across Android versions and gesture-nav devices.
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    // Plugin unavailable — leave the default chrome in place.
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    // No splash plugin; nothing to hide.
  }
}

/**
 * Wire the Android hardware back button to a handler (typically "close the open
 * panel, otherwise minimise the app"). Returns a cleanup function.
 */
export async function onHardwareBack(
  handler: () => boolean,
): Promise<() => void> {
  if (!isNative()) return () => {};
  try {
    const { App } = await import("@capacitor/app");
    const sub = await App.addListener("backButton", () => {
      const handled = handler();
      if (!handled) App.exitApp();
    });
    return () => {
      void sub.remove();
    };
  } catch {
    return () => {};
  }
}
