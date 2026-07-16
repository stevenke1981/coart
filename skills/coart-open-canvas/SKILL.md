---
name: coart-open-canvas
description: Open the Coart Ferric Canvas WebAssembly/SVG canvas in the Codex conversation so image edits can be handled directly without copying prompts.
---

# Coart Open Canvas

Use this workflow whenever the user asks to open or reopen Coart for the active project.

## Current runtime

Coart v0.2.7 is TypeScript-first:

- Node.js 22.6+ executes `scripts/start-mcp.ts` directly with type stripping.
- The stdio entrypoint imports `mcp/server.ts`; do not refer to removed `.mjs` entrypoints.
- The in-task MCP Apps Widget is the default editing surface. It is bound to the requested project and writes only to `<projectDir>/canvas/`.
- `open_coart_editor` remains available for an explicitly requested standalone Chrome／Edge app window, served from a token-protected loopback bridge.

## Default open procedure

1. Call `render_coart_canvas` with the absolute active project path and `displayMode: "sidebar"` so the canvas opens in the Codex task sidebar:

   ```json
   {
     "projectDir": "C:/work/my-project",
     "displayMode": "sidebar"
   }
   ```

2. Keep the project path unchanged. The snapshot, selection, view state, references, and generated assets are persisted under `<projectDir>/canvas/`; never substitute the plugin cache path.
3. The Widget's generation and annotation controls use the Codex Apps `sendMessage` bridge. Treat the resulting message as a normal user follow-up and continue the image/HTML/Slides workflow in this conversation; never ask the user to copy or paste a prompt.
4. When the user finishes editing, call `get_coart_latest_image` to return the newest project-local image as MCP image content, or call `read_coart_asset` when the user names a specific asset. Keep the original asset unless the user explicitly requests replacement.
5. If the user explicitly asks for the standalone editor, call `open_coart_editor`. Its follow-up controls write a project-local pending request; after the user says "繼續處理" or otherwise returns to the conversation, call `get_coart_pending_request`, handle the request, then call `clear_coart_pending_request` after success. Do not ask the user to paste the prompt.

## Sidebar Widget (default) and inline fallback

Use `render_coart_canvas` with `displayMode: "sidebar"` for the normal in-task canvas. Use inline only when the user explicitly wants the canvas embedded in the conversation:

```json
{
  "projectDir": "C:/work/my-project",
  "displayMode": "sidebar"
}
```

Use `"inline"` only for an explicit conversation-embedded request. For either mode, check `codex features list` first. Both `apps ... true` and `enable_mcp_apps ... true` are required. If `enable_mcp_apps` is false, run `codex features enable enable_mcp_apps`, fully restart Codex Desktop, and start a new task. The expected v0.2.7 resource URI is `ui://widget/coart/canvas-v0-2-7.html`.

## Recovery

- If `open_coart_editor` is unavailable immediately after installation or an update, start a new Codex task so plugin tools are reloaded.
- If the MCP proxy reports `-32000` during save, verify that `coart@coart-public` is installed and enabled from the current source, reinstall it, then fully restart Codex Desktop and start a new task. Current autosave writes are serialized to avoid proxy concurrency failures; do not repeatedly render the stale Widget.
- If the browser does not launch, retry once after closing an old Coart window; the editor API can still be tested through the returned loopback URL while that server remains alive.
- If only MCP tool JSON is visible, explain that the MCP Apps renderer gate is disabled and use `open_coart_editor` as a temporary fallback; its pending-request queue still avoids clipboard copy.
- Preserve the user's project path and existing `<projectDir>/canvas` state; never delete canvas files as part of reopening.
