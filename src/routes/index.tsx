import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Workbench } from "@/ide/Workbench";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kiln — Desktop Code Editor" },
      { name: "description", content: "Kiln is a fast, focused desktop IDE with a real code editor, terminal, search and source control." },
      { property: "og:title", content: "Kiln — Desktop Code Editor" },
      { property: "og:description", content: "A fast, focused desktop IDE with a real code editor, terminal, search and source control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  // The workbench is browser-only (editor, local storage, window sizing).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-screen bg-background" />;
  return <Workbench />;
}
