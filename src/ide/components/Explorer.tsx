// import { useEffect, useRef } from "react";
// import {
//   ChevronRight,
//   FilePlus,
//   FolderPlus,
//   RefreshCw,
//   ChevronsDownUp,
//   FileText,
//   Folder,
//   FolderOpen,
// } from "lucide-react";
// import { useIde } from "../store";
// import { childrenOf, fileColorClass } from "../mockFs";
// import type { FsNode } from "../types";
// import { SectionHeader } from "./common";
// import { cn } from "@/lib/utils";

// export function FileIcon({ name, className }: { name: string; className?: string }) {
//   return <FileText className={cn("h-4 w-4 shrink-0", fileColorClass(name), className)} strokeWidth={1.75} />;
// }

// function TreeItem({ node, depth }: { node: FsNode; depth: number }) {
//   const ide = useIde();
//   const isOpen = ide.expanded.has(node.id);
//   const isFolder = node.type === "folder";
//   const active = ide.groups[ide.activeGroup]?.active === node.id;
//   const status = ide.changes.find((c) => c.id === node.id)?.status;
//   const inputRef = useRef<HTMLInputElement>(null);
//   const renaming = ide.renaming === node.id;

//   useEffect(() => {
//     if (renaming && inputRef.current) {
//       const el = inputRef.current;
//       el.focus();
//       const dot = node.name.lastIndexOf(".");
//       el.setSelectionRange(0, dot > 0 ? dot : node.name.length);
//     }
//   }, [renaming, node.name]);

//   const onContext = (e: React.MouseEvent) => {
//     e.preventDefault();
//     ide.setSelected(node.id);
//     ide.setMenu({
//       x: e.clientX,
//       y: e.clientY,
//       items: [
//         ...(isFolder
//           ? [
//               { label: "New File", onClick: () => ide.createNode(node.id, "file") },
//               { label: "New Folder", onClick: () => ide.createNode(node.id, "folder") },
//               { separator: true as const },
//             ]
//           : [
//               { label: "Open", onClick: () => ide.openFile(node.id) },
//               { label: "Open to the Side", onClick: () => { ide.splitRight(); setTimeout(() => ide.openFile(node.id, ide.groups.length), 0); } },
//               { separator: true as const },
//             ]),
//         { label: "Copy Path", onClick: () => navigator.clipboard?.writeText(node.id) },
//         { label: "Rename", shortcut: "F2", onClick: () => ide.setRenaming(node.id) },
//         {
//           label: "Delete",
//           shortcut: "Del",
//           danger: true,
//           onClick: () =>
//             ide.setConfirm({
//               title: `Delete '${node.name}'?`,
//               body: isFolder ? "The folder and all its contents will be removed." : "This file will be removed from the workspace.",
//               onOk: () => ide.deleteNode(node.id),
//             }),
//         },
//       ],
//     });
//   };

//   return (
//     <>
//       <div
//         role="treeitem"
//         aria-expanded={isFolder ? isOpen : undefined}
//         onClick={() => {
//           ide.setSelected(node.id);
//           if (isFolder) ide.toggleFolder(node.id);
//           else ide.openFile(node.id);
//         }}
//         onKeyDown={(e) => {
//           if (e.key === "F2") ide.setRenaming(node.id);
//         }}
//         tabIndex={0}
//         onContextMenu={onContext}
//         className={cn(
//           "ide-row h-[22px] gap-1 pr-2 text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
//           active && "bg-ide-selected",
//           ide.selected === node.id && !active && "bg-ide-hover",
//         )}
//         style={{ paddingLeft: 8 + depth * 12 }}
//       >
//         <ChevronRight
//           className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90", !isFolder && "invisible")}
//         />
//         {isFolder ? (
//           isOpen ? (
//             <FolderOpen className="h-4 w-4 shrink-0 text-primary/80" strokeWidth={1.75} />
//           ) : (
//             <Folder className="h-4 w-4 shrink-0 text-primary/80" strokeWidth={1.75} />
//           )
//         ) : (
//           <FileIcon name={node.name} />
//         )}
//         {renaming ? (
//           <input
//             ref={inputRef}
//             defaultValue={node.name}
//             onClick={(e) => e.stopPropagation()}
//             onBlur={(e) => ide.renameNode(node.id, e.target.value)}
//             onKeyDown={(e) => {
//               e.stopPropagation();
//               if (e.key === "Enter") ide.renameNode(node.id, e.currentTarget.value);
//               if (e.key === "Escape") ide.setRenaming(null);
//             }}
//             className="ml-1 h-[19px] min-w-0 flex-1 border border-primary bg-input px-1 text-[13px] outline-none"
//           />
//         ) : (
//           <span className={cn("ml-1 min-w-0 flex-1 truncate", status === "M" && "text-ide-warning", status === "U" && "text-ide-success")}>
//             {node.name}
//           </span>
//         )}
//         {ide.dirty.has(node.id) && <span className="h-2 w-2 shrink-0 rounded-full bg-foreground/60" />}
//         {status && !renaming && (
//           <span className={cn("w-3 shrink-0 text-right text-[11px] font-semibold", status === "M" ? "text-ide-warning" : "text-ide-success")}>{status}</span>
//         )}
//       </div>
//       {isFolder && isOpen && childrenOf(ide.nodes, node.id).map((c) => <TreeItem key={c.id} node={c} depth={depth + 1} />)}
//     </>
//   );
// }

// export function Explorer() {
//   const ide = useIde();
//   const openTabs = ide.groups.flatMap((g) => g.tabs).filter((t, i, a) => a.indexOf(t) === i && ide.nodes[t]);
//   return (
//     <div className="flex h-full flex-col">
//       <SectionHeader
//         title="Explorer"
//         actions={
//           <>
//             <button className="ide-icon-btn h-6 w-6" title="New File" onClick={() => ide.createNode(ide.selected ?? "root", "file")}><FilePlus className="h-4 w-4" /></button>
//             <button className="ide-icon-btn h-6 w-6" title="New Folder" onClick={() => ide.createNode(ide.selected ?? "root", "folder")}><FolderPlus className="h-4 w-4" /></button>
//             <button className="ide-icon-btn h-6 w-6" title="Refresh" onClick={() => ide.log("Explorer refreshed")}><RefreshCw className="h-3.5 w-3.5" /></button>
//             <button className="ide-icon-btn h-6 w-6" title="Collapse Folders" onClick={() => ide.expanded.forEach((id) => id !== "root" && ide.toggleFolder(id))}><ChevronsDownUp className="h-4 w-4" /></button>
//           </>
//         }
//       />
//       {openTabs.length > 0 && (
//         <div className="border-b pb-1">
//           <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Open Editors</div>
//           {openTabs.map((t) => (
//             <div key={t} onClick={() => ide.openFile(t)} className="ide-row h-[22px] gap-1.5 pl-6 pr-2 text-[12.5px]">
//               <FileIcon name={ide.nodes[t].name} />
//               <span className="truncate">{ide.nodes[t].name}</span>
//               {ide.dirty.has(t) && <span className="ml-auto h-2 w-2 rounded-full bg-foreground/60" />}
//             </div>
//           ))}
//         </div>
//       )}
//       <div
//         className="min-h-0 flex-1 overflow-auto py-1"
//         role="tree"
//         onContextMenu={(e) => {
//           if (e.target !== e.currentTarget) return;
//           e.preventDefault();
//           ide.setMenu({
//             x: e.clientX,
//             y: e.clientY,
//             items: [
//               { label: "New File", onClick: () => ide.createNode("root", "file") },
//               { label: "New Folder", onClick: () => ide.createNode("root", "folder") },
//             ],
//           });
//         }}
//       >
//         <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-foreground/80">{ide.nodes.root.name}</div>
//         {childrenOf(ide.nodes, "root").map((n) => (
//           <TreeItem key={n.id} node={n} depth={0} />
//         ))}
//       </div>
//     </div>
//   );
// }


import { useEffect, useRef } from "react";
import {
  ChevronRight,
  FilePlus,
  FolderPlus,
  RefreshCw,
  ChevronsDownUp,
  FileText,
  Folder,
  FolderOpen,
  FolderIcon,
} from "lucide-react";
import { useIde } from "../store";
import { childrenOf, fileColorClass } from "../mockFs";
import type { FsNode } from "../types";
import { SectionHeader } from "./common";
import { cn } from "@/lib/utils";

export function FileIcon({ name, className }: { name: string; className?: string }) {
  return <FileText className={cn("h-4 w-4 shrink-0", fileColorClass(name), className)} strokeWidth={1.75} />;
}

function TreeItem({ node, depth }: { node: FsNode; depth: number }) {
  const ide = useIde();
  const isOpen = ide.expanded.has(node.id);
  const isFolder = node.type === "folder";
  const active = ide.groups[ide.activeGroup]?.active === node.id;
  const status = ide.changes.find((c) => c.id === node.id)?.status;
  const inputRef = useRef<HTMLInputElement>(null);
  const renaming = ide.renaming === node.id;

  useEffect(() => {
    if (renaming && inputRef.current) {
      const el = inputRef.current;
      el.focus();
      const dot = node.name.lastIndexOf(".");
      el.setSelectionRange(0, dot > 0 ? dot : node.name.length);
    }
  }, [renaming, node.name]);

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    ide.setSelected(node.id);
    ide.setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        ...(isFolder
          ? [
              { label: "New File", onClick: () => ide.createNode(node.id, "file") },
              { label: "New Folder", onClick: () => ide.createNode(node.id, "folder") },
              { separator: true as const },
            ]
          : [
              { label: "Open", onClick: () => ide.openFile(node.id) },
              { label: "Open to the Side", onClick: () => { ide.splitRight(); setTimeout(() => ide.openFile(node.id, ide.groups.length), 0); } },
              { separator: true as const },
            ]),
        { label: "Copy Path", onClick: () => navigator.clipboard?.writeText(node.id) },
        { label: "Rename", shortcut: "F2", onClick: () => ide.setRenaming(node.id) },
        {
          label: "Delete",
          shortcut: "Del",
          danger: true,
          onClick: () =>
            ide.setConfirm({
              title: `Delete '${node.name}'?`,
              body: isFolder ? "The folder and all its contents will be removed." : "This file will be removed from the workspace.",
              onOk: () => ide.deleteNode(node.id),
            }),
        },
      ],
    });
  };

  return (
    <>
      <div
        role="treeitem"
        aria-expanded={isFolder ? isOpen : undefined}
        onClick={() => {
          ide.setSelected(node.id);
          if (isFolder) ide.toggleFolder(node.id);
          else ide.openFile(node.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "F2") ide.setRenaming(node.id);
        }}
        tabIndex={0}
        onContextMenu={onContext}
        className={cn(
          "ide-row h-[22px] gap-1 pr-2 text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
          active && "bg-ide-selected",
          ide.selected === node.id && !active && "bg-ide-hover",
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90", !isFolder && "invisible")}
        />
        {isFolder ? (
          isOpen ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-primary/80" strokeWidth={1.75} />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-primary/80" strokeWidth={1.75} />
          )
        ) : (
          <FileIcon name={node.name} />
        )}
        {renaming ? (
          <input
            ref={inputRef}
            defaultValue={node.name}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => ide.renameNode(node.id, e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") ide.renameNode(node.id, e.currentTarget.value);
              if (e.key === "Escape") ide.setRenaming(null);
            }}
            className="ml-1 h-[19px] min-w-0 flex-1 border border-primary bg-input px-1 text-[13px] outline-none"
          />
        ) : (
          <span className={cn("ml-1 min-w-0 flex-1 truncate", status === "M" && "text-ide-warning", status === "U" && "text-ide-success")}>
            {node.name}
          </span>
        )}
        {ide.dirty.has(node.id) && <span className="h-2 w-2 shrink-0 rounded-full bg-foreground/60" />}
        {status && !renaming && (
          <span className={cn("w-3 shrink-0 text-right text-[11px] font-semibold", status === "M" ? "text-ide-warning" : "text-ide-success")}>{status}</span>
        )}
      </div>
      {isFolder && isOpen && childrenOf(ide.nodes, node.id).map((c) => <TreeItem key={c.id} node={c} depth={depth + 1} />)}
    </>
  );
}

export function Explorer() {
  const ide = useIde();
  const openTabs = ide.groups.flatMap((g) => g.tabs).filter((t, i, a) => a.indexOf(t) === i && ide.nodes[t]);

  // The workspace comes from the platform layer: the browser build always
  // has the mock "root"; in Electron it appears after Open Folder loads disk.
  const hasWorkspace = !!ide.nodes.root;
  const folderName = ide.nodes.root?.name ?? "No Workspace";

  return (
    <div className="flex h-full flex-col select-none">
      <SectionHeader
        title="Explorer"
        actions={
          <>
            <button className="ide-icon-btn h-6 w-6" title="New File" onClick={() => ide.createNode(ide.selected ?? "root", "file")} disabled={!projectPath}><FilePlus className="h-4 w-4" /></button>
            <button className="ide-icon-btn h-6 w-6" title="New Folder" onClick={() => ide.createNode(ide.selected ?? "root", "folder")} disabled={!projectPath}><FolderPlus className="h-4 w-4" /></button>
            <button className="ide-icon-btn h-6 w-6" title="Refresh" onClick={() => ide.log("Explorer refreshed")}><RefreshCw className="h-3.5 w-3.5" /></button>
            <button className="ide-icon-btn h-6 w-6" title="Collapse Folders" onClick={() => ide.expanded.forEach((id) => id !== "root" && ide.toggleFolder(id))}><ChevronsDownUp className="h-4 w-4" /></button>
          </>
        }
      />
      
      {openTabs.length > 0 && (
        <div className="border-b pb-1">
          <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Open Editors</div>
          {openTabs.map((t) => (
            <div key={t} onClick={() => ide.openFile(t)} className="ide-row h-[22px] gap-1.5 pl-6 pr-2 text-[12.5px]">
              <FileIcon name={ide.nodes[t].name} />
              <span className="truncate">{ide.nodes[t].name}</span>
              {ide.dirty.has(t) && <span className="ml-auto h-2 w-2 rounded-full bg-foreground/60" />}
            </div>
          ))}
        </div>
      )}

      <div
        className="min-h-0 flex-1 overflow-auto py-1"
        role="tree"
        onContextMenu={(e) => {
          if (!projectPath || e.target !== e.currentTarget) return;
          e.preventDefault();
          ide.setMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
              { label: "New File", onClick: () => ide.createNode("root", "file") },
              { label: "New Folder", onClick: () => ide.createNode("root", "folder") },
            ],
          });
        }}
      >
        {projectPath ? (
          <>
            {/* Display opened system project name */}
            <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
              <FolderIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate" title={projectPath}>{folderName}</span>
            </div>
            
            {/* Populate active subdirectories or workspace files lists */}
            {workspaceFiles.length === 0 ? (
              <div className="px-4 py-2 text-[12px] text-muted-foreground italic">Empty directory</div>
            ) : (
              childrenOf(ide.nodes, "root").map((n) => (
                <TreeItem key={n.id} node={n} depth={0} />
              ))
            )}
          </>
        ) : (
          /* Native workspace entry prompt when no active project path is registered */
          <div className="p-4 flex flex-col items-center justify-center text-center h-48 gap-3">
            <p className="text-[12px] text-muted-foreground leading-normal">
              You have not opened a workspace folder yet.
            </p>
            <button
              onClick={onSelectWorkspace}
              className="px-3 py-1.5 text-[12px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded shadow-sm transition-colors cursor-pointer"
            >
              Open Folder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
