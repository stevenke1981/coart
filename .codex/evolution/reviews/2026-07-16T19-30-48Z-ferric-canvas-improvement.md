# Ferric Canvas Improvement Self Review

## Task summary

Implemented the Ferric Canvas improvement specification across pointer scheduling, typed editor events, split persistence, reload coalescing, history/clipboard/transform facades, contextual UI, responsive behavior, and real Playwright interaction/performance coverage.

## Corrections and user feedback

- No mid-task user correction was received.
- The repository requirement to preserve the 640px intrinsic widget height floor was retained and re-verified at every required viewport.

## Failure → cause → fix

- Context panels did not follow the canvas editor in the first Playwright run → React StrictMode exposed an async `onReady` race between disposed and current editor instances → added active-editor guards and moved UI subscriptions into an editor-scoped effect.
- Consecutive resize/rotate/duplicate operations lost records → `syncFromEngine()` could read an old engine while `loadScene()` was in flight → separated queued and in-flight reload states and stopped using engine snapshots as an opportunistic getter-side source of truth.
- Ctrl/Cmd shortcuts cleared selection before the command key arrived → modifier-only keydown events were forwarded into Ferric → modifier-only events are now ignored by the engine shortcut facade.
- Space pan failed after text editing → focus stayed outside the canvas and shortcuts were scoped to the shell → canvas focus is restored after edit and non-form shortcuts are handled at window scope.
- Context toolbar could render outside the viewport for a large/off-screen selection → placement only clamped one axis → toolbar placement now clamps both axes and falls back inside the visible viewport.
- React wheel handling emitted a passive-listener warning → `preventDefault()` was called from a passive synthetic listener → wheel zoom now uses a native non-passive listener.
- New `src/canvas/` modules were absent from `git status` → the broad `canvas/` ignore pattern matched nested source directories → narrowed the rule to root-only `/canvas/` and rechecked source visibility.

## Verification evidence

- `npm run quality` passed.
- TypeScript check and full typecheck passed.
- 23/23 Node tests passed.
- Production Vite build passed; the known bundle-size warning remains.
- MCP stdio probe passed with 16 tools and `canvas-v0-2-8`.
- Streamable HTTP probe passed with 16 tools.
- Playwright Chrome probe passed rectangle creation, zero reloads during drag (3 → 3), resize, rotate, marquee, clipboard, undo/redo, Chinese text editing, 1000-point draw, Space pan, wheel zoom, AI draft/reference retention, and five viewports.
- 500-shape stress completed in 823ms in the final screenshot run with pan/zoom reload count unchanged (2 → 2).

## Durable memory changes

- No global user-memory update was made.
- The StrictMode editor-race and reload in-flight findings belong in repository delivery notes because they are implementation-specific.

## Reusable skill decision

- No new skill candidate. The failure patterns are covered by the existing self-review and frontend verification workflows.

## Remaining risks

- The root `canvas/` runtime data remains ignored while `src/canvas/` is now visible and will be committed.
- The production bundle remains above Vite's 500kB warning threshold; this is pre-existing and non-blocking for the self-contained widget guard.
- The hostless Playwright harness observes one expected MCP `-32601` bridge error because no Codex host is attached; application/page errors outside that expected condition are zero.
