export function normalizeKeyboardEvent(event) {
    return {
        key: event.key,
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        meta: event.metaKey,
    };
}
/**
 * Loads the wasm-pack output. The generated module is intentionally imported
 * lazily so SSR and native Node tooling can import this facade without WebAssembly.
 */
export async function loadWasm(input) {
    // wasm-pack creates this module before TypeScript compilation in the release pipeline.
    // @ts-ignore generated artifact is absent from a source-only checkout
    const module = (await import("../wasm/canvas_wasm.js"));
    await module.default(input);
    return module;
}
export async function createCanvas(width, height, input) {
    const wasm = await loadWasm(input);
    return new wasm.FerricCanvas(width, height);
}
export async function loadScene(sceneJson, input) {
    const wasm = await loadWasm(input);
    return wasm.FerricCanvas.fromSceneJson(sceneJson);
}
/**
 * Connects pointer, keyboard, and IME composition events to a Ferric engine.
 *
 * The host does not emulate Canvas2D. It emits the SVG reference rendering;
 * callers retain control of how that SVG is mounted and sanitized by policy.
 */
export function bindCanvasHost(element, engine, options = {}) {
    if (element.tabIndex < 0)
        element.tabIndex = 0;
    const previousTouchAction = element.style.touchAction;
    element.style.touchAction = "none";
    let lastCompositionData;
    let activePointerId;
    let renderedViewBox;
    const readViewBox = (svg) => {
        const match = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(svg);
        if (!match)
            return undefined;
        const serializedViewBox = match[1];
        if (!serializedViewBox)
            return undefined;
        const values = serializedViewBox.trim().split(/[\s,]+/).map(Number);
        const [minX = Number.NaN, minY = Number.NaN, width = Number.NaN, height = Number.NaN] = values;
        if (values.length !== 4
            || values.some((value) => !Number.isFinite(value))
            || width <= 0
            || height <= 0)
            return undefined;
        return { minX, minY, width, height };
    };
    const coordinates = (event, bounds) => {
        if (options.pointerCoordinates)
            return options.pointerCoordinates(event, bounds);
        renderedViewBox ??= readViewBox(engine.renderSvg());
        if (!renderedViewBox || bounds.width <= 0 || bounds.height <= 0) {
            throw new Error("pointer mapping requires official SVG output with a valid viewBox or CanvasHostOptions.pointerCoordinates");
        }
        const scale = Math.min(bounds.width / renderedViewBox.width, bounds.height / renderedViewBox.height);
        const contentWidth = renderedViewBox.width * scale;
        const contentHeight = renderedViewBox.height * scale;
        const contentLeft = bounds.left + (bounds.width - contentWidth) / 2;
        const contentTop = bounds.top + (bounds.height - contentHeight) / 2;
        return {
            x: renderedViewBox.minX + (event.clientX - contentLeft) / scale,
            y: renderedViewBox.minY + (event.clientY - contentTop) / scale,
        };
    };
    const pointerBounds = () => {
        const viewport = options.viewportElement;
        const viewportSvg = viewport?.matches?.("svg")
            ? viewport
            : viewport?.querySelector?.("svg");
        const renderedSvg = element.matches?.("svg")
            ? element
            : element.querySelector?.("svg");
        return (viewportSvg ?? viewport ?? renderedSvg ?? element).getBoundingClientRect();
    };
    const apply = (effect) => {
        options.onEffect?.(effect);
        if (effect.request_render)
            render();
    };
    const render = () => {
        const svg = engine.renderSvg();
        renderedViewBox = readViewBox(svg);
        options.render?.(svg);
    };
    const pointerDown = (raw) => {
        const event = raw;
        if (event.button !== 0)
            return;
        const bounds = pointerBounds();
        const point = coordinates(event, bounds);
        element.focus();
        apply(engine.pointerDown(point.x, point.y, event.shiftKey));
        activePointerId = event.pointerId;
        element.setPointerCapture(event.pointerId);
    };
    const pointerMove = (raw) => {
        const event = raw;
        if (event.pointerId !== activePointerId)
            return;
        const bounds = pointerBounds();
        const point = coordinates(event, bounds);
        apply(engine.pointerMove(point.x, point.y));
    };
    const pointerUp = (raw) => {
        const event = raw;
        if (event.pointerId !== activePointerId)
            return;
        const bounds = pointerBounds();
        const point = coordinates(event, bounds);
        apply(engine.pointerUp(point.x, point.y));
        activePointerId = undefined;
        element.releasePointerCapture(event.pointerId);
    };
    const pointerCancel = (raw) => {
        const event = raw;
        if (event.pointerId !== activePointerId)
            return;
        activePointerId = undefined;
        apply(engine.pointerCancel());
        if (element.hasPointerCapture(event.pointerId))
            element.releasePointerCapture(event.pointerId);
    };
    const keyDown = (raw) => {
        const event = raw;
        if (event.isComposing
            && ["Delete", "Backspace", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            return;
        }
        const normalized = normalizeKeyboardEvent(event);
        const effect = engine.keyDown(normalized.key, normalized.shift, normalized.ctrl, normalized.alt, normalized.meta);
        if (effect.prevent_default)
            event.preventDefault();
        apply(effect);
    };
    const compositionStart = () => {
        lastCompositionData = undefined;
        const [start, end] = options.compositionRange?.() ?? [0, 0];
        apply(engine.compositionStart(start, end));
    };
    const compositionUpdate = (raw) => {
        const event = raw;
        lastCompositionData = event.data ?? "";
        apply(engine.compositionUpdate(lastCompositionData));
    };
    const compositionEnd = (raw) => {
        const event = raw;
        if (!event.data) {
            apply(engine.compositionCancel());
        }
        else {
            if (event.data !== lastCompositionData)
                apply(engine.compositionUpdate(event.data));
            apply(engine.compositionEnd());
        }
        lastCompositionData = undefined;
    };
    const listeners = [
        ["pointerdown", pointerDown],
        ["pointermove", pointerMove],
        ["pointerup", pointerUp],
        ["pointercancel", pointerCancel],
        ["lostpointercapture", pointerCancel],
        ["keydown", keyDown],
        ["compositionstart", compositionStart],
        ["compositionupdate", compositionUpdate],
        ["compositionend", compositionEnd],
    ];
    for (const [type, listener] of listeners)
        element.addEventListener(type, listener);
    return {
        render,
        cancelComposition() {
            apply(engine.compositionCancel());
            lastCompositionData = undefined;
        },
        destroy() {
            for (const [type, listener] of listeners)
                element.removeEventListener(type, listener);
            if (activePointerId !== undefined) {
                apply(engine.pointerCancel());
                activePointerId = undefined;
            }
            element.style.touchAction = previousTouchAction;
            engine.free?.();
        },
    };
}
