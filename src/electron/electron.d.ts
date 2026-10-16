/**
 * The preload script exposes `window.kilnBridge`, matching the KilnPlatform
 * contract in src/ide/platform/types.ts. The workbench picks it up through
 * getPlatform() — no component changes needed.
 */
import type { KilnPlatform } from "../ide/platform/types";

declare global {
  interface Window {
    kilnBridge?: KilnPlatform;
  }
}

export {};
