---
name: coart-open-canvas
description: Open the Coart Fabric.js canvas in an external editor window for the active project and return project-local images to the same Codex task.
---

# Coart Open Canvas

Use this workflow whenever the user asks to open or reopen Coart for the active project.

## Current runtime

Coart v0.2.7 is TypeScript-first:

- Node.js 22.6+ executes `scripts/start-mcp.ts` directly with type stripping.
- The stdio entrypoint imports `mcp/server.ts`; do not refer to removed `.mjs` entrypoints.
- The default editor is a standalone Chrome／Edge app window served from a token-protected loopback bridge. It is bound to the requested project and writes only to `<projectDir>/canvas/`.
- `render_coart_canvas` remains an MCP Apps Widget fallback and supports `inline` or `sidebar`. It is not required for the external editor workflow.

## Default open procedure

1. Call `open_coart_editor` with the absolute active project path. Do not call `render_coart_canvas` first and do not pass the Coart plugin source directory unless it is itself the user's target project:

   ```json
   {
     "projectDir": "C:/work/my-project"
   }
   ```

2. Let the tool launch Chrome or Edge in app mode. Do not start `npm run start:http`, a Vite preview, or another local server; the tool owns the short-lived loopback server and its token.
3. Keep the project path unchanged. The editor's snapshot, selection, view state, references, and generated assets are persisted under `<projectDir>/canvas/`; never substitute the plugin cache path.
4. When the user finishes editing, return to the same Codex task. Call `get_coart_latest_image` to return the newest project-local image as MCP image content, or call `read_coart_asset` when the user names a specific asset. Keep the original asset unless the user explicitly requests replacement.
5. If the standalone editor presents a generated follow-up prompt, tell the user to paste the copied prompt into this same Codex task. The external window has no Codex host follow-up bridge, so it cannot send the chat message automatically.

## Inline fallback

Use `render_coart_canvas` when the user explicitly requests inline/sidebar display or when external window launch is unavailable:

```json
{
  "projectDir": "C:/work/my-project",
  "displayMode": "inline"
}
```

Use `"sidebar"` instead of `"inline"` when the host should place the same Fabric canvas in the side panel. For either mode, check `codex features list` first. Both `apps ... true` and `enable_mcp_apps ... true` are required. If `enable_mcp_apps` is false, run `codex features enable enable_mcp_apps`, fully restart Codex Desktop, and start a new task. The expected v0.2.7 resource URI is `ui://widget/coart/canvas-v0-2-7.html`.

## Recovery

- If `open_coart_editor` is unavailable immediately after installation or an update, start a new Codex task so plugin tools are reloaded.
- If the MCP proxy reports `-32000`, verify that `coart@coart-public` is installed and enabled from the current source, then fully restart Codex Desktop and start a new task. Do not repeatedly render the inline Widget.
- If the browser does not launch, retry once after closing an old Coart window; the editor API can still be tested through the returned loopback URL while that server remains alive.
- If only MCP tool JSON is visible, use the external editor workflow; the renderer gate applies to inline MCP Apps only.
- Preserve the user's project path and existing `<projectDir>/canvas` state; never delete canvas files as part of reopening.
