/* tslint:disable */
/* eslint-disable */

/**
 * JavaScript-facing owner of a canonical Ferric Canvas scene.
 */
export class FerricCanvas {
    free(): void;
    [Symbol.dispose](): void;
    compositionCancel(): any;
    compositionEnd(): any;
    compositionStart(start: number, end: number): any;
    compositionUpdate(text: string): any;
    static fromSceneJson(json: string): FerricCanvas;
    keyDown(key: string, shift: boolean, ctrl: boolean, alt: boolean, meta: boolean): any;
    /**
     * Creates an empty canvas. Dimensions must be finite and positive.
     */
    constructor(width: number, height: number);
    pointerCancel(): any;
    pointerDown(x: number, y: number, shift: boolean): any;
    pointerMove(x: number, y: number): any;
    pointerUp(x: number, y: number): any;
    renderSvg(): string;
    sceneJson(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_ferriccanvas_free: (a: number, b: number) => void;
    readonly ferriccanvas_compositionCancel: (a: number) => [number, number, number];
    readonly ferriccanvas_compositionEnd: (a: number) => [number, number, number];
    readonly ferriccanvas_compositionStart: (a: number, b: number, c: number) => [number, number, number];
    readonly ferriccanvas_compositionUpdate: (a: number, b: number, c: number) => [number, number, number];
    readonly ferriccanvas_fromSceneJson: (a: number, b: number) => [number, number, number];
    readonly ferriccanvas_keyDown: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly ferriccanvas_new: (a: number, b: number) => [number, number, number];
    readonly ferriccanvas_pointerCancel: (a: number) => [number, number, number];
    readonly ferriccanvas_pointerDown: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly ferriccanvas_pointerMove: (a: number, b: number, c: number) => [number, number, number];
    readonly ferriccanvas_pointerUp: (a: number, b: number, c: number) => [number, number, number];
    readonly ferriccanvas_renderSvg: (a: number) => [number, number, number, number];
    readonly ferriccanvas_sceneJson: (a: number) => [number, number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
