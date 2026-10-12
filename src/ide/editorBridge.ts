import type { editor } from "monaco-editor";
import { toast } from "sonner";
import type { Ide } from "./store";
import { languageFor } from "./mockFs";

let active: editor.IStandaloneCodeEditor | null = null;

export function setActiveEditor(e: editor.IStandaloneCodeEditor) {
  active = e;
}

/** Runs a built-in Monaco action on the focused editor. */
export function runEditorAction(actionId: string) {
  if (!active) {
    toast("Open a file to use this command");
    return;
  }
  active.focus();
  const action = active.getAction(actionId);
  if (action) void action.run();
  else active.trigger("menu", actionId, null);
}

export async function pasteIntoEditor() {
  if (!active) { toast("Open a file to paste"); return; }
  try {
    const text = await navigator.clipboard.readText();
    active.focus();
    const sel = active.getSelection();
    if (sel) active.executeEdits("menu", [{ range: sel, text, forceMoveMarkers: true }]);
  } catch {
    toast("Clipboard access was blocked — use Ctrl+V instead");
  }
}

export function askAboutSelection(ide: Ide) {
  const sel = ide.selection;
  if (!sel?.text.trim()) {
    toast("Select some code in the editor first");
    return;
  }
  const name = ide.nodes[sel.fileId]?.name ?? "selection";
  ide.setChatDraft({ file: name, language: languageFor(name), code: sel.text, n: Date.now() });
  ide.setChatOpen(true);
}
