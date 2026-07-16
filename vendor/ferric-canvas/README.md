# `@ferric-canvas/web`

TypeScript facade and DOM input host for Ferric Canvas' WebAssembly build.

```ts
import { bindCanvasHost, createCanvas } from "@ferric-canvas/web";

const engine = await createCanvas(1280, 720);
const canvas = document.querySelector<HTMLElement>("#canvas")!;

bindCanvasHost(canvas, engine, {
  render: (svg) => { canvas.innerHTML = svg; },
});
```

When input events are captured by a separate overlay, pass the rendered SVG or
its container as `viewportElement`. A child SVG is preferred over its container,
and pointer coordinates are mapped through its viewBox and default
`preserveAspectRatio` letterboxing.

The package exposes a canonical Scene JSON API and the official SVG reference
renderer. SVG returned directly by `engine.renderSvg()` is trusted renderer
output. Treat SVG from any other source—including user-provided, imported, or
custom renderer output—as untrusted and sanitize it with an allowlist-based SVG
sanitizer before assigning it to `innerHTML`.

It does **not** claim HTML Canvas2D compatibility, web font loading,
GPU rendering, clipboard access, accessibility-tree integration, or automatic
caret discovery. IME consumers must supply the active UTF-8 byte range through
`compositionRange`.

## Development

The repository pipeline runs `wasm-pack` first, then:

```sh
npm ci
npm test
npm run pack:check
```

Publishing is restricted to the manual/tagged GitHub workflow and requires the
`NPM_TOKEN` environment secret.
