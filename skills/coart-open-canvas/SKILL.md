---
name: coart-open-canvas
description: Open the native Coart tldraw infinite canvas inside Codex for the active project.
---

# Coart Open Canvas

1. Call `render_coart_canvas` with the absolute active user project path as `projectDir`.
2. Do not pass the Coart plugin source directory unless it is itself the user's target project.
3. The native widget stores its state under `<projectDir>/canvas`.
4. Do not start a localhost browser server for normal use.
5. If the tool is unavailable immediately after installation, open a new Codex conversation so plugin tools are reloaded.
6. Always use `inline` mode in Codex Desktop. Coart v0.2.7 keeps the Widget as a direct sub-4 MB HTML document and lets the MCP Apps SDK report the actual intrinsic size; do not restore the legacy gzip loader, a fixed 720px size override, or a recurring resize timer.

Example:

```json
{
  "projectDir": "C:/work/my-project",
  "displayMode": "inline"
}
```
