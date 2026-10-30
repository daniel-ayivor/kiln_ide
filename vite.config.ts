import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite"; // <-- 1. Import the Tailwind Vite plugin
import path from "path";

export default defineConfig({
   base: './',
  plugins: [
    react(),
    tailwindcss(), // <-- 2. Include it in the plugins array
  ],

    build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 8082,
    strictPort: true,
  },
  css: {
    transformer: 'postcss',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  }
}); 