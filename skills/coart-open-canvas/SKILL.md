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

Example:

```json
{
  "projectDir": "C:/work/my-project",
  "displayMode": "fullscreen"
}
```
