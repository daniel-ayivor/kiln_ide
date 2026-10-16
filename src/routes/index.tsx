import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Workbench } from "@/ide/Workbench";
import type { FsNodeItem } from "../electron/electron"; // Import your file node interfaces

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
  // Protects from SSR hydration mismatch errors
  const [mounted, setMounted] = useState(false);
  
  // Track open workspace data 
  const [projectPath, setProjectPath] = useState<string | null>(null);
  
  // FIX: Type state as FsNodeItem[] instead of string[]
  const [workspaceFiles, setWorkspaceFiles] = useState<FsNodeItem[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Safe handler to pass down into your editor layouts
  const handleSelectWorkspace = async () => {
    // Guards against running outside Electron runtime context
    if (typeof window === "undefined" || !window.ideAPI) {
      console.warn("Electron native API is not available.");
      return;
    }

    const targetFolder = await window.ideAPI.selectFolder();
    if (!targetFolder) return;

    setProjectPath(targetFolder);

    // Call the file system bridge to scan files recursively
    const response = await window.ideAPI.readDirectory(targetFolder);
    if (response.success && response.files) {
      setWorkspaceFiles(response.files); // No more type mismatch error!
      
      // Update custom window titlebar text smoothly 
      if (window.electronAPI) {
        window.electronAPI.setTitle(`Kiln — ${targetFolder}`);
      }
    } else {
      console.error("Failed to map directory structure:", response.error);
    }
  };

  if (!mounted) return <div className="h-screen bg-background" />;

  // Pass down path, file lists, and trigger functions into your actual editor dashboard
  return (
    <Workbench 
      projectPath={projectPath}
      workspaceFiles={workspaceFiles}
      onSelectWorkspace={handleSelectWorkspace}
    />
  );
}
