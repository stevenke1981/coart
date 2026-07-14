import { useEffect, useRef } from 'react'
import { SAVE_DEBOUNCE_MS } from '../constants.js'
import { saveCanvasState, saveSelection, saveViewState } from '../lib/coartClient.js'

export function useAutosave(editor, onStatus) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (!editor) return undefined

    const persist = () => {
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(async () => {
        try {
          const snapshot = editor.store.getStoreSnapshot('document')
          const selectedIds = editor.getSelectedShapeIds()
          const selection = {
            version: 1,
            pageId: editor.getCurrentPageId(),
            selectedShapeIds: selectedIds,
            selectedShapes: selectedIds.map((id) => editor.getShape(id)).filter(Boolean),
            updatedAt: new Date().toISOString()
          }
          const viewState = {
            version: 1,
            currentPageId: editor.getCurrentPageId(),
            camera: editor.getCamera(),
            updatedAt: new Date().toISOString()
          }
          await Promise.all([
            saveCanvasState(snapshot),
            saveSelection(selection),
            saveViewState(viewState)
          ])
          onStatus?.('已儲存')
        } catch (error) {
          console.error(error)
          onStatus?.(`儲存失敗：${error.message}`)
        }
      }, SAVE_DEBOUNCE_MS)
    }

    const unlisten = editor.store.listen(persist, { scope: 'all' })

    return () => {
      window.clearTimeout(timerRef.current)
      unlisten?.()
    }
  }, [editor, onStatus])
}
