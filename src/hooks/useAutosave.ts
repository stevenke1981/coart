import { useEffect, useRef } from 'react'
import { SAVE_DEBOUNCE_MS } from '../constants'
import { saveCanvasState, saveSelection, saveViewState } from '../lib/coartClient'
import type { AnyCanvasShape, EditorLike, SelectionState, ViewState } from '../types'

export function useAutosave(
  editor: EditorLike | null,
  onStatus?: (message: string) => void,
  enabled = true
): void {
  const timerRef = useRef<number | undefined>(undefined)
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!editor || !enabled) return undefined

    const persist = () => {
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        const persistSnapshot = async (): Promise<void> => {
          try {
            const snapshot = editor.getStoreSnapshot()
            const selectedIds = editor.getSelectedShapeIds()
            const selection: SelectionState = {
              version: 1,
              pageId: editor.getCurrentPageId(),
              selectedShapeIds: selectedIds.map(String),
              selectedShapes: selectedIds
                .map((id) => editor.getShape(id))
                .filter((shape): shape is AnyCanvasShape => Boolean(shape))
                .map((shape) => shape as AnyCanvasShape),
              updatedAt: new Date().toISOString()
            }
            const viewState: ViewState = {
              version: 1,
              currentPageId: editor.getCurrentPageId(),
              camera: editor.getCamera(),
              updatedAt: new Date().toISOString()
            }

            // MCP Apps hosts may proxy only one widget tool call at a time.
            // Keep the three project-local writes ordered so a successful
            // snapshot is not accompanied by a -32000 proxy failure.
            await saveCanvasState(snapshot)
            await saveSelection(selection)
            await saveViewState(viewState)
            onStatus?.('已儲存')
          } catch (error: unknown) {
            console.error(error)
            onStatus?.(`儲存失敗：${error instanceof Error ? error.message : String(error)}`)
          }
        }

        saveChainRef.current = saveChainRef.current.catch(() => undefined).then(persistSnapshot)
      }, SAVE_DEBOUNCE_MS)
    }

    const unlisten = editor.onChange(persist)

    return () => {
      window.clearTimeout(timerRef.current)
      unlisten?.()
    }
  }, [editor, enabled, onStatus])
}
