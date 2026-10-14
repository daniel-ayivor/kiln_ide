import { childrenOf, createMockFs } from "../mockFs";
import type { KilnPlatform, ShellContext, ShellResult, TermLine } from "./types";

function exec(cmdline: string, ctx: ShellContext): ShellResult {
  const [cmd, ...args] = cmdline.trim().split(/\s+/);
  const lines: TermLine[] = [{ kind: "in", text: cmdline }];
  const push = (text: string, kind: TermLine["kind"] = "out") => lines.push({ kind, text });
  const resolve = (p: string) =>
    [ctx.cwd === "~" ? "" : ctx.cwd, p].filter(Boolean).join("/").replace(/^\/+/, "");
  const { nodes } = ctx;

  switch (cmd) {
    case undefined:
    case "":
      break;
    case "help":
      push("Commands: ls, cd <dir>, cat <file>, pwd, echo, date, clear, git status, npm run dev, npm test, touch <file>");
      break;
    case "clear":
      return { lines: [], clear: true };
    case "pwd":
      push(`/workspace/kiln-starter${ctx.cwd === "~" ? "" : "/" + ctx.cwd}`);
      break;
    case "ls": {
      const dir = (args[0] ? resolve(args[0]) : ctx.cwd === "~" ? "root" : ctx.cwd) || "root";
      if (!nodes[dir]) push(`ls: ${args[0]}: No such directory`, "err");
      else push(childrenOf(nodes, dir).map((k) => (k.type === "folder" ? k.name + "/" : k.name)).join("   "));
      break;
    }
    case "cd": {
      if (!args[0] || args[0] === "~" || args[0] === "/") return { lines, cwd: "~" };
      if (args[0] === "..") return { lines, cwd: ctx.cwd.split("/").slice(0, -1).join("/") || "~" };
      const target = resolve(args[0]);
      if (nodes[target]?.type === "folder") return { lines, cwd: target };
      push(`cd: no such directory: ${args[0]}`, "err");
      break;
    }
    case "cat": {
      const f = nodes[resolve(args[0] ?? "")];
      if (f?.type === "file") (f.content ?? "").split("\n").forEach((l) => push(l));
      else push(`cat: ${args[0] ?? ""}: No such file`, "err");
      break;
    }
    case "touch":
      if (args[0]) {
        ctx.createNode(ctx.cwd === "~" ? "root" : ctx.cwd, "file");
        push("Created new file — rename it in the explorer.");
      }
      break;
    case "echo":
      push(args.join(" "));
      break;
    case "date":
      push(new Date().toString());
      break;
    case "git":
      if (args[0] === "status") {
        push(`On branch ${ctx.branch}`);
        if (!ctx.changes.length) push("nothing to commit, working tree clean");
        ctx.changes.forEach((c) =>
          push(`  ${c.status === "U" ? "new file:" : c.status === "D" ? "deleted: " : "modified:"}   ${c.id}`, c.status === "U" ? "ok" : "err"),
        );
      } else push(`git: '${args[0] ?? ""}' is not supported in this sandbox`, "err");
      break;
    case "npm":
      if (args[0] === "run" && args[1] === "dev") {
        push("> kiln-starter@0.1.0 dev");
        push("> vite");
        push("");
        push("  VITE v7.0.0  ready in 312 ms", "ok");
        push("  ➜  Local:   http://localhost:5173/");
        ctx.log("Dev server started on :5173", "Tasks");
      } else if (args[0] === "test") {
        push(" ✓ src/utils/format.test.ts (3 tests) 4ms", "ok");
        push(" Test Files  1 passed (1)", "ok");
      } else push(`npm: unknown command '${args.join(" ")}'`, "err");
      break;
    default:
      push(`${cmd}: command not found`, "err");
  }
  return { lines };
}

/** Default in-browser platform: mock workspace + simulated shell. */
export const browserPlatform: KilnPlatform = {
  kind: "browser",
  capabilities: { realFileSystem: false, realTerminal: false, windowControls: false },
  fs: { loadWorkspace: createMockFs },
  shell: { exec },
};
