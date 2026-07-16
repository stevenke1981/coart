import { useEffect, useMemo, useRef } from 'react'
import { SerialPersistenceQueue } from '../canvas/PersistenceQueue'
import { SAVE_DEBOUNCE_MS } from '../constants'
import { saveCanvasState, saveSelection, saveViewState } from '../lib/coartClient'
import type { AnyCanvasShape, EditorLike, SelectionState, ViewState } from '../types'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useDocumentAutosave(
  editor: EditorLike | null,
  queue: SerialPersistenceQueue,
  enabled: boolean,
  onStatus?: (message: string) => void
): void {
  const timerRef = useRef<number | undefined>(undefined)
  const latestRevisionRef = useRef(0)
  const savedRevisionRef = useRef(0)

  useEffect(() => {
    if (!editor || !enabled) return undefined
    let active = true

    const flush = (): void => {
      window.clearTimeout(timerRef.current)
      const revision = latestRevisionRef.current
      if (revision <= savedRevisionRef.current) return
      void queue.enqueue(async () => {
        try {
          await saveCanvasState(editor.getStoreSnapshot())
          savedRevisionRef.current = Math.max(savedRevisionRef.current, revision)
          if (active && latestRevisionRef.current > savedRevisionRef.current) schedule()
        } catch (error: unknown) {
          console.error(error)
          onStatus?.(`儲存失敗：${errorMessage(error)}`)
          if (active) timerRef.current = window.setTimeout(flush, 1200)
        }
      })
    }

    const schedule = (): void => {
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS)
    }

    const unlisten = editor.on('document', (event) => {
      latestRevisionRef.current = Math.max(latestRevisionRef.current, event.revision)
      schedule()
    })

    return () => {
      active = false
      flush()
      unlisten()
    }
  }, [editor, enabled, onStatus, queue])
}

export function useSelectionPersistence(editor: EditorLike | null, queue: SerialPersistenceQueue, enabled: boolean, onStatus?: (message: string) => void): void {
  const timerRef = useRef<number | undefined>(undefined)
  const revisionRef = useRef(0)

  useEffect(() => {
    if (!editor || !enabled) return undefined
    const flush = (): void => {
      window.clearTimeout(timerRef.current)
      const selectedIds = editor.getSelectedShapeIds()
      const selection: SelectionState = {
        version: 1,
        pageId: editor.getCurrentPageId(),
        selectedShapeIds: selectedIds,
        selectedShapes: selectedIds
          .map((id) => editor.getShape(id))
          .filter((shape): shape is AnyCanvasShape => Boolean(shape)),
        updatedAt: new Date().toISOString()
      }
      void queue.enqueue(async () => { await saveSelection(selection) }).catch((error: unknown) => {
        console.error(error)
        onStatus?.(`選取狀態儲存失敗：${errorMessage(error)}`)
      })
    }
    const unlisten = editor.on('selection', (event) => {
      revisionRef.current = event.revision
      if (timerRef.current !== undefined) return
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined
        flush()
      }, 200)
    })
    return () => {
      if (revisionRef.current > 0) flush()
      unlisten()
    }
  }, [editor, enabled, onStatus, queue])
}

export function useViewPersistence(editor: EditorLike | null, queue: SerialPersistenceQueue, enabled: boolean, onStatus?: (message: string) => void): void {
  const timerRef = useRef<number | undefined>(undefined)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!editor || !enabled) return undefined
    const flush = (): void => {
      window.clearTimeout(timerRef.current)
      if (!dirtyRef.current) return
      dirtyRef.current = false
      const viewState: ViewState = {
        version: 1,
        currentPageId: editor.getCurrentPageId(),
        camera: editor.getCamera(),
        updatedAt: new Date().toISOString()
      }
      void queue.enqueue(async () => { await saveViewState(viewState) }).catch((error: unknown) => {
        dirtyRef.current = true
        console.error(error)
        onStatus?.(`視角儲存失敗：${errorMessage(error)}`)
      })
    }
    const unlisten = editor.on('camera', () => {
      dirtyRef.current = true
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(flush, 400)
    })
    return () => {
      flush()
      unlisten()
    }
  }, [editor, enabled, onStatus, queue])
}

export function useAutosave(editor: EditorLike | null, onStatus?: (message: string) => void, enabled = true): void {
  const queue = useMemo(() => new SerialPersistenceQueue(), [])
  useDocumentAutosave(editor, queue, enabled, onStatus)
  useSelectionPersistence(editor, queue, enabled, onStatus)
  useViewPersistence(editor, queue, enabled, onStatus)
}
