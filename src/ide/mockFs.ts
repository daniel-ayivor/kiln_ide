import type { FsNode } from "./types";

const files: Record<string, string> = {
  "src/main.tsx": `import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/app.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
  "src/App.tsx": `import { useState } from "react";
import { Button } from "./components/Button";
import { formatCurrency } from "./utils/format";

export function App() {
  const [count, setCount] = useState(0);
  // TODO: replace with real pricing data
  const total = formatCurrency(count * 19.99);

  return (
    <main className="app">
      <h1>Kiln starter</h1>
      <p>You have {count} items — {total}</p>
      <Button onClick={() => setCount((c) => c + 1)}>Add item</Button>
    </main>
  );
}
`,
  "src/components/Button.tsx": `import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({ variant = "primary", className, ...rest }: Props) {
  return <button className={\`btn btn-\${variant} \${className ?? ""}\`} {...rest} />;
}
`,
  "src/utils/format.ts": `export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// FIXME: handle negative durations
export const formatDuration = (ms: number) => \`\${Math.round(ms / 1000)}s\`;
`,
  "src/styles/app.css": `:root {
  --accent: #e8853d;
  font-family: system-ui, sans-serif;
}

.app {
  max-width: 640px;
  margin: 4rem auto;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
}

.btn-primary {
  background: var(--accent);
  color: white;
}
`,
  "public/index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Kiln starter</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  "package.json": `{
  "name": "kiln-starter",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
`,
  "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "moduleResolution": "bundler"
  },
  "include": ["src"]
}
`,
  "README.md": `# Kiln starter

A tiny React project used to demo the **Kiln** editor.

## Scripts

- \`npm run dev\` — start the dev server
- \`npm run build\` — production build
`,
  ".gitignore": `node_modules
dist
.env
`,
};

export function createMockFs(): Record<string, FsNode> {
  const nodes: Record<string, FsNode> = {
    root: { id: "root", name: "kiln-starter", type: "folder", parentId: null },
  };
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/");
    let parent = "root";
    parts.forEach((part, i) => {
      const id = parts.slice(0, i + 1).join("/");
      if (!nodes[id]) {
        nodes[id] =
          i === parts.length - 1
            ? { id, name: part, type: "file", parentId: parent, content }
            : { id, name: part, type: "folder", parentId: parent };
      }
      parent = id;
    });
  }
  return nodes;
}

export function languageFor(name: string): string {
  // Handle extension detail views or non-file tabs
  if (name.startsWith("extension:")) return "json";

  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "css":
      return "css";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "html":
      return "html";
    default:
      return "plaintext";
  }
}

export function fileColorClass(name: string): string {
  if (name.startsWith("extension:")) return "text-primary";

  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") return "text-file-ts";
  if (ext === "css") return "text-file-css";
  if (ext === "json") return "text-file-json";
  if (ext === "md") return "text-file-md";
  if (ext === "html") return "text-file-html";
  return "text-muted-foreground";
}

export function pathOf(nodes: Record<string, FsNode>, id: string): FsNode[] {
  const out: FsNode[] = [];
  let cur: FsNode | undefined = nodes[id];
  while (cur) {
    out.unshift(cur);
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return out;
}

export function childrenOf(nodes: Record<string, FsNode>, id: string): FsNode[] {
  return Object.values(nodes)
    .filter((n) => n.parentId === id)
    .sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1,
    );
}