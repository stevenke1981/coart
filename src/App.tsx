import { useCallback, useMemo, useRef, useState } from 'react'
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import { CanvasToolbar } from './components/CanvasToolbar'
import { CoartHtmlShapeUtil } from './components/CoartHtmlShapeUtil'
import { GenerationPanel } from './components/GenerationPanel'
import { SlidesViewer } from './components/SlidesViewer'
import { StatusToast } from './components/StatusToast'
import { blobToDataUrl } from './lib/dataUrl'
import { annotationPrompt } from './lib/prompts'
import {
  loadCanvasState,
  saveCanvasState,
  saveReferenceImage,
  sendFollowUpMessage
} from './lib/coartClient'
import { useAutosave } from './hooks/useAutosave'
import { assetUrls } from './lib/tldrawAssets'
import type { AnyCanvasShape, CoartHtmlShape, EditorLike } from './types'
import type { TLPageId } from 'tldraw'

const shapeUtils = [CoartHtmlShapeUtil]

export default function App() {
  const [editor, setEditor] = useState<EditorLike | null>(null)
  const [selectedShape, setSelectedShape] = useState<AnyCanvasShape | null>(null)
  const [aspectId, setAspectId] = useState('3:4')
  const [status, setStatus] = useState('')
  const [slides, setSlides] = useState<CoartHtmlShape[]>([])
  const statusTimerRef = useRef<number | undefined>(undefined)

  const showStatus = useCallback((message: string) => {
    setStatus(message)
    window.clearTimeout(statusTimerRef.current)
    statusTimerRef.current = window.setTimeout(() => setStatus(''), 2600)
  }, [])

  useAutosave(editor, showStatus)

  const handleMount = useCallback((nextEditor: EditorLike): void => {
    setEditor(nextEditor)
    void (async () => {
      try {
        const state = await loadCanvasState()
        if (state.snapshot?.store && state.snapshot?.schema) {
          nextEditor.store.loadStoreSnapshot(state.snapshot)
        }
        if (state.viewState?.currentPageId && nextEditor.store.has(state.viewState.currentPageId as TLPageId)) {
          nextEditor.setCurrentPage(state.viewState.currentPageId as TLPageId)
        }
        if (state.viewState?.camera) nextEditor.setCamera(state.viewState.camera)
        showStatus(`畫布已載入（${state.storage || 'project'}）`)
      } catch (error: unknown) {
        console.error(error)
        showStatus(`載入失敗：${error instanceof Error ? error.message : String(error)}`)
      }

      const updateSelection = () => {
        const ids = nextEditor.getSelectedShapeIds()
        setSelectedShape(ids.length === 1 ? (nextEditor.getShape(ids[0]) as AnyCanvasShape | undefined) ?? null : null)
      }
      updateSelection()
      nextEditor.store.listen(updateSelection, { scope: 'session' })
    })()
  }, [showStatus])

  const saveNow = useCallback(async (): Promise<void> => {
    if (!editor) return
    try {
      await saveCanvasState(editor.store.getStoreSnapshot('document'))
      showStatus('已立即儲存')
    } catch (error: unknown) {
      showStatus(`儲存失敗：${error instanceof Error ? error.message : String(error)}`)
    }
  }, [editor, showStatus])

  const annotate = useCallback(async (): Promise<void> => {
    if (!editor) return
    const ids = editor.getSelectedShapeIds()
    if (!ids.length) {
      showStatus('請多選原圖、箭頭與標註文字')
      return
    }
    try {
      showStatus('正在匯出標註截圖…')
      const result = await editor.toImage(ids, { format: 'png', background: true, padding: 32, scale: 1 })
      const dataUrl = await blobToDataUrl(result.blob)
      const pageId = editor.getCurrentPageId()
      const screenshot = await saveReferenceImage({
        pageId,
        anchorShapeId: ids[0],
        fileName: `annotation-${Date.now()}.png`,
        dataUrl,
        mimeType: 'image/png'
      })
      await sendFollowUpMessage(annotationPrompt({ pageId, screenshot }))
      showStatus('已將標註修改任務送交 Codex')
    } catch (error: unknown) {
      console.error(error)
      showStatus(`標註匯出失敗：${error instanceof Error ? error.message : String(error)}`)
    }
  }, [editor, showStatus])

  const openSlides = useCallback(() => {
    if (!editor || selectedShape?.meta?.coartKind !== 'slides') {
      showStatus('請先選取 AI Slides 容器')
      return
    }
    const children = editor.getCurrentPageShapes()
      .filter((shape) => shape.parentId === selectedShape.id && shape.type === 'coart-html')
      .sort((a, b) => String(a.index).localeCompare(String(b.index)))
    if (!children.length) {
      showStatus('這個 Slides 尚未包含 HTML 頁面')
      return
    }
    setSlides(children as CoartHtmlShape[])
  }, [editor, selectedShape, showStatus])

  const components = useMemo(() => ({
    InFrontOfTheCanvas: () => (
      <>
        <CanvasToolbar
          editor={editor}
          aspectId={aspectId}
          onAspectChange={setAspectId}
          onAnnotate={annotate}
          onOpenSlides={openSlides}
          onSaveNow={saveNow}
        />
        <GenerationPanel editor={editor} selectedShape={selectedShape} onStatus={showStatus} />
      </>
    )
  }), [annotate, aspectId, editor, openSlides, saveNow, selectedShape, showStatus])

  return (
    <div className="coart-app">
      <Tldraw
        assetUrls={assetUrls}
        shapeUtils={shapeUtils}
        components={components}
        onMount={handleMount}
        persistenceKey={undefined}
      />
      <StatusToast message={status} />
      {slides.length > 0 && <SlidesViewer slides={slides} onClose={() => setSlides([])} />}
    </div>
  )
}
