# Coart Agent Development Rules

## Mission

Build Coart as an independent clean-room implementation of a Codex-native visual canvas. Preserve functional goals, not Cowart code, wording, icons, screenshots, or branding.

## Required workflow

1. Read `spec.md`, `architecture.md`, `plan.md`, and `todos.md` before changing code.
2. Keep the MCP protocol, filesystem layer, frontend bridge, and tldraw UI separated.
3. Update or add tests for path, storage, prompt, and insertion behavior.
4. Run `npm run check`, `npm test`, and `npm run build` before marking work complete.
5. Record failures, boundaries, and follow-up work in `final.md` and `todos.md`.

## Safety gates

- Never allow canvas assets to escape the configured `canvas/` directory.
- Never put secrets or provider API keys in snapshots or browser localStorage.
- Do not delete user images or shapes unless the operation explicitly acknowledges replacement.
- Do not use force push or destructive filesystem deletion without user confirmation.

## Architecture rules

- Avoid a monolithic `App.jsx`; feature UI belongs in `src/components`, bridge logic in `src/lib`, and persistence in `mcp/lib`.
- MCP tools must use Zod schemas and return structured content.
- All Widget resources must be CSP-safe and self-contained.
- New shape metadata must be namespaced with `coart`.
