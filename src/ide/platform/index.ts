import { browserPlatform } from "./browser";
import type { KilnPlatform } from "./types";

export type * from "./types";

/** Returns the Electron bridge when injected by a preload script, else the browser mock. */
export function getPlatform(): KilnPlatform {
  if (typeof window !== "undefined" && window.kilnBridge) return window.kilnBridge;
  return browserPlatform;
}
