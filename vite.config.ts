
// import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// export default defineConfig({
//   tanstackStart: {
//     // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
//     // nitro/vite builds from this
//     server: { entry: "server" },
//   },
//   vite: {
//     server: {
//       port: 8082,
//       strictPort: true,
//     },
//   },
// });

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import electron from "vite-plugin-electron";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  vite: {
    server: {
      port: 8082,
      strictPort: true,
    },
    plugins: [
      electron([
        {
          // Compiles your Electron main process file
          entry: "src/electron/main.ts",
        },
        {
          // Compiles your Preload script and injects window.kilnBridge
          entry: "src/electron/preload.ts",
          onstart(options) {
            options.reload();
          },
        },
      ]),
    ],
  },
});