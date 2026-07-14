import { useCallback, useMemo, useRef, useState } from 'react'
import { Tldraw } from 'tldraw'
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'
import 'tldraw/tldraw.css'
import { CanvasToolbar } from './components/CanvasToolbar.jsx'
import { CoartHtmlShapeUtil } from './components/CoartHtmlShapeUtil.jsx'
import { GenerationPanel } from './components/GenerationPanel.jsx'
import { SlidesViewer } from './components/SlidesViewer.jsx'
import { StatusToast } from './components/StatusToast.jsx'
import { blobToDataUrl } from './lib/dataUrl.js'
import { annotationPrompt } from './lib/prompts.js'
import {
  loadCanvasState,
  saveCanvasState,
  saveReferenceImage,
  sendFollowUpMessage
} from './lib/coartClient.js'
import { useAutosave } from './hooks/useAutosave.js'

const shapeUtils = [CoartHtmlShapeUtil]
const assetUrls = getAssetUrlsByImport()

export default function App() {
  const [editor, setEditor] = useState(null)
  const [selectedShape, setSelectedShape] = useState(null)
  const [aspectId, setAspectId] = useState('3:4')
  const [status, setStatus] = useState('')
  const [slides, setSlides] = useState([])
  const statusTimerRef = useRef(null)

  const showStatus = useCallback((message) => {
    setStatus(message)
    window.clearTimeout(statusTimerRef.current)
    statusTimerRef.current = window.setTimeout(() => setStatus(''), 2600)
  }, [])

  useAutosave(editor, showStatus)

  const handleMount = useCallback(async (nextEditor) => {
    setEditor(nextEditor)
    try {
      const state = await loadCanvasState()
      if (state.snapshot?.store && state.snapshot?.schema) {
        nextEditor.store.loadStoreSnapshot(state.snapshot)
      }
      if (state.viewState?.currentPageId && nextEditor.store.has(state.viewState.currentPageId)) {
        nextEditor.setCurrentPage(state.viewState.currentPageId)
      }
      if (state.viewState?.camera) nextEditor.setCamera(state.viewState.camera)
      showStatus(`畫布已載入（${state.storage || 'project'}）`)
    } catch (error) {
      console.error(error)
      showStatus(`載入失敗：${error.message}`)
    }

    const updateSelection = () => {
      const ids = nextEditor.getSelectedShapeIds()
      setSelectedShape(ids.length === 1 ? nextEditor.getShape(ids[0]) : null)
    }
    updateSelection()
    nextEditor.store.listen(updateSelection, { scope: 'session' })
  }, [showStatus])

  const saveNow = useCallback(async () => {
    if (!editor) return
    try {
      await saveCanvasState(editor.store.getStoreSnapshot('document'))
      showStatus('已立即儲存')
    } catch (error) {
      showStatus(`儲存失敗：${error.message}`)
    }
  }, [editor, showStatus])

  const annotate = useCallback(async () => {
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
    } catch (error) {
      console.error(error)
      showStatus(`標註匯出失敗：${error.message}`)
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
    setSlides(children)
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
