<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Coding conversations use route-derived thread IDs and owner-scoped Cloud records containing AI SDK UIMessage arrays, so history remains isolated and reloadable.
- Chat streams through the TanStack API route and server-only Responses helper; credentials and workspace prompts never enter client code.
- Account controls use Cloud Auth and its managed social broker; workspace identity must reflect the active session.
- Workbench and Monaco themes share global semantic CSS tokens, with the resolved system preference supplied by the IDE state.
- All OS access (workspace files, terminal) goes through getPlatform() in src/ide/platform; components never import mockFs for I/O. Why: an Electron preload can inject window.kilnBridge without UI rewrites.
