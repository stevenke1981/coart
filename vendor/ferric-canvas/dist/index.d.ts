/** Observable result returned by the Rust browser bridge. */
export interface BridgeEffect {
    scene_changed: boolean;
    request_render: boolean;
    prevent_default: boolean;
    selection: string[];
    composition_range?: [number, number];
}
/** Stable surface consumed by the DOM host and implemented by wasm-bindgen. */
export interface FerricCanvasEngine {
    sceneJson(): string;
    renderSvg(): string;
    pointerDown(x: number, y: number, shift: boolean): BridgeEffect;
    pointerMove(x: number, y: number): BridgeEffect;
    pointerUp(x: number, y: number): BridgeEffect;
    pointerCancel(): BridgeEffect;
    keyDown(key: string, shift: boolean, ctrl: boolean, alt: boolean, meta: boolean): BridgeEffect;
    compositionStart(start: number, end: number): BridgeEffect;
    compositionUpdate(text: string): BridgeEffect;
    compositionEnd(): BridgeEffect;
    compositionCancel(): BridgeEffect;
    free?(): void;
}
export interface FerricCanvasConstructor {
    new (width: number, height: number): FerricCanvasEngine;
    fromSceneJson(json: string): FerricCanvasEngine;
}
export interface WasmModule {
    default(input?: unknown): Promise<unknown>;
    FerricCanvas: FerricCanvasConstructor;
}
export interface KeyboardInput {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
}
export interface NormalizedKeyboardEvent {
    key: string;
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
}
export interface CanvasHostOptions {
    /** Supplies a UTF-8 byte range for the active Rust text object. */
    compositionRange?: () => [number, number];
    /** Called after every handled event, including selection-only events. */
    onEffect?: (effect: BridgeEffect) => void;
    /** Receives safe SVG output when the engine requests a render. */
    render?: (svg: string) => void;
    /** Element containing the rendered SVG when it differs from the input host. */
    viewportElement?: Element;
    /** Overrides the official SVG viewBox mapping for custom render hosts. */
    pointerCoordinates?: (event: PointerEvent, bounds: DOMRect) => {
        x: number;
        y: number;
    };
}
export interface CanvasHost {
    render(): void;
    cancelComposition(): void;
    destroy(): void;
}
export declare function normalizeKeyboardEvent(event: KeyboardInput): NormalizedKeyboardEvent;
/**
 * Loads the wasm-pack output. The generated module is intentionally imported
 * lazily so SSR and native Node tooling can import this facade without WebAssembly.
 */
export declare function loadWasm(input?: unknown): Promise<WasmModule>;
export declare function createCanvas(width: number, height: number, input?: unknown): Promise<FerricCanvasEngine>;
export declare function loadScene(sceneJson: string, input?: unknown): Promise<FerricCanvasEngine>;
/**
 * Connects pointer, keyboard, and IME composition events to a Ferric engine.
 *
 * The host does not emulate Canvas2D. It emits the SVG reference rendering;
 * callers retain control of how that SVG is mounted and sanitized by policy.
 */
export declare function bindCanvasHost(element: HTMLElement, engine: FerricCanvasEngine, options?: CanvasHostOptions): CanvasHost;
