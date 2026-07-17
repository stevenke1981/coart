import { useCallback, useEffect, useRef, useState } from 'react'
import { CanvasToolbar } from './components/CanvasToolbar'
import { ContextToolbar } from './components/ContextToolbar'
import { FerricCanvas } from './components/FerricCanvas'
import { GenerationPanel, modeForShape } from './components/GenerationPanel'
import { HtmlEditorPanel } from './components/HtmlEditorPanel'
import { LayerPanel } from './components/LayerPanel'
import { MediaInspector } from './components/MediaInspector'
import { Minimap } from './components/Minimap'
import { SlidesViewer } from './components/SlidesViewer'
import { StatusToast } from './components/StatusToast'
import { blobToDataUrl } from './lib/dataUrl'
import { createEmptyCanvasSnapshot } from './lib/ferricCanvas'
import { annotationPrompt } from './lib/prompts'
import {
  loadCanvasState,
  saveCanvasState,
  saveReferenceImage,
  sendFollowUpMessage
} from './lib/coartClient'
import { useAutosave } from './hooks/useAutosave'
import type { AnyCanvasShape, CoartHtmlShape, EditorLike } from './types'

export default function App() {
  const [editor, setEditor] = useState<EditorLike | null>(null)
  const [canvasReady, setCanvasReady] = useState(false)
  const [selectedShapes, setSelectedShapes] = useState<AnyCanvasShape[]>([])
  const [generationOpen, setGenerationOpen] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [htmlOpen, setHtmlOpen] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const [aspectId, setAspectId] = useState('4:3')
  const [status, setStatus] = useState('')
  const [slides, setSlides] = useState<CoartHtmlShape[]>([])
  const [slidesParentId, setSlidesParentId] = useState('')
  const statusTimerRef = useRef<number | undefined>(undefined)
  const lastSelectionRef = useRef('')
  const activeEditorRef = useRef<EditorLike | null>(null)

  const selectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null

  useEffect(() => {
    if (!editor) {
      setSelectedShapes([])
      return undefined
    }
    const updateSelection = (): void => {
      const ids = editor.getSelectedShapeIds()
      const shapes = ids
        .map((id) => editor.getShape(id))
        .filter((shape): shape is AnyCanvasShape => Boolean(shape))
      setSelectedShapes(shapes)
      const signature = ids.join('\u0000')
      if (signature !== lastSelectionRef.current) {
        lastSelectionRef.current = signature
        setGenerationOpen(shapes.length === 1 && modeForShape(shapes[0]) !== null)
      }
    }
    updateSelection()
    // UI composition follows the compatibility aggregate so contextual
    // overlays also reposition during camera/transient changes. Persistence
    // remains subscribed to the typed document/selection/camera channels.
    return editor.onChange(updateSelection)
  }, [editor])

  const showStatus = useCallback((message: string) => {
    setStatus(message)
    window.clearTimeout(statusTimerRef.current)
    statusTimerRef.current = window.setTimeout(() => setStatus(''), 2600)
  }, [])

  useAutosave(editor, showStatus, canvasReady)

  const handleMount = useCallback((nextEditor: EditorLike | null): void => {
    if (!nextEditor) {
      activeEditorRef.current = null
      setCanvasReady(false)
      setEditor(null)
      setSelectedShapes([])
      return
    }
    activeEditorRef.current = nextEditor
    setCanvasReady(false)
    setEditor(nextEditor)
    void (async () => {
      try {
        const state = await loadCanvasState()
        if (activeEditorRef.current !== nextEditor) return
        if (state.snapshot?.store && state.snapshot?.schema) {
          await nextEditor.loadStoreSnapshot(state.snapshot)
        } else {
          await nextEditor.loadStoreSnapshot(createEmptyCanvasSnapshot())
        }
        if (state.viewState?.currentPageId && nextEditor.has(state.viewState.currentPageId)) {
          nextEditor.setCurrentPage(state.viewState.currentPageId)
        }
        if (state.viewState?.camera) nextEditor.setCamera(state.viewState.camera)
        if (state.selection?.selectedShapeIds?.length) nextEditor.setSelection(state.selection.selectedShapeIds)
        if (activeEditorRef.current !== nextEditor) return
        setEditor(nextEditor)
        setCanvasReady(true)
        showStatus(`畫布已載入（${state.storage || 'project'}）`)
      } catch (error: unknown) {
        if (activeEditorRef.current !== nextEditor) return
        console.error(error)
        setCanvasReady(true)
        showStatus(`載入失敗：${error instanceof Error ? error.message : String(error)}`)
      }
    })()
  }, [showStatus])

  const saveNow = useCallback(async (): Promise<void> => {
    if (!editor) return
    try {
      await saveCanvasState(editor.getStoreSnapshot())
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
      const delivery = await sendFollowUpMessage(annotationPrompt({ pageId, screenshot }))
      showStatus((delivery as { pending?: boolean })?.pending
        ? '標註修改指令已排入佇列；回到對話說「繼續處理」即可'
        : '已將標註修改任務送交 Codex')
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
    setSlidesParentId(selectedShape.id)
  }, [editor, selectedShape, showStatus])

  const exportSlides = useCallback((): void => {
    if (!editor || selectedShape?.meta?.coartKind !== 'slides') {
      showStatus('請先選取 AI Slides 容器')
      return
    }
    const children = editor.getCurrentPageShapes()
      .filter((shape): shape is CoartHtmlShape => shape.parentId === selectedShape.id && shape.type === 'coart-html')
      .sort((a, b) => String(a.index).localeCompare(String(b.index)))
    if (!children.length) {
      showStatus('這個 Slides 尚未包含 HTML 頁面')
      return
    }
    const escapeAttribute = (value: string): string => value
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
    const deckName = typeof selectedShape.props.name === 'string' ? selectedShape.props.name : 'Coart Slides'
    const frames = children.map((slide, index) => `<section class="slide${index === 0 ? ' active' : ''}"><iframe title="Slide ${index + 1}" srcdoc="${escapeAttribute(slide.props.html)}" sandbox="allow-scripts allow-forms allow-modals allow-popups"></iframe></section>`).join('')
    const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeAttribute(deckName)}</title><style>:root{height:100%}body{margin:0;width:100%;height:100%;overflow:hidden;background:#111827}.slide{display:none;width:100%;height:100%}.slide.active{display:block}.slide iframe{width:100%;height:100%;border:0;background:white}.controls{position:fixed;right:20px;bottom:20px;display:flex;gap:8px;z-index:2}.controls button{border:0;border-radius:999px;padding:10px 14px;background:#fff;box-shadow:0 8px 24px #0005;cursor:pointer}</style></head><body>${frames}<div class="controls"><button id="prev" aria-label="上一頁">←</button><button id="next" aria-label="下一頁">→</button></div><script>const s=[...document.querySelectorAll('.slide')];let i=0;const show=n=>{i=Math.max(0,Math.min(s.length-1,n));s.forEach((x,j)=>x.classList.toggle('active',j===i))};document.querySelector('#prev').onclick=()=>show(i-1);document.querySelector('#next').onclick=()=>show(i+1);addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(i-1);if(e.key==='ArrowRight'||e.key===' ')show(i+1)});</script></body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${deckName}.html`
    anchor.click()
    URL.revokeObjectURL(url)
    showStatus(`已匯出 ${children.length} 頁 Slides HTML`)
  }, [editor, selectedShape, showStatus])

  return (
    <div className="coart-app">
      <FerricCanvas onReady={handleMount} interactive={canvasReady} />
      <CanvasToolbar
        editor={editor}
        ready={canvasReady}
        selectedShapes={selectedShapes}
        generationOpen={generationOpen}
        aspectId={aspectId}
        onAspectChange={setAspectId}
        onAnnotate={annotate}
        onOpenSlides={openSlides}
        onSaveNow={saveNow}
        layersOpen={layersOpen}
        onToggleLayers={() => setLayersOpen((value) => !value)}
      />
      <ContextToolbar
        editor={editor}
        selectedShapes={selectedShapes}
        onAnnotate={annotate}
        onOpenSlides={openSlides}
        onExportSlides={exportSlides}
        onGenerate={() => setGenerationOpen(true)}
        onMedia={() => { setMediaOpen(true); setGenerationOpen(false) }}
        onHtmlEdit={() => { setHtmlOpen(true); setGenerationOpen(false) }}
        onLayoutSlides={() => { if (selectedShape) editor?.layoutSlides(selectedShape.id) }}
      />
      <GenerationPanel editor={editor} selectedShape={selectedShape} open={generationOpen} onClose={() => setGenerationOpen(false)} onStatus={showStatus} />
      {editor && selectedShape?.type === 'image' && mediaOpen && <MediaInspector editor={editor} shape={selectedShape} onClose={() => setMediaOpen(false)} onStatus={showStatus} />}
      {editor && selectedShape && (selectedShape.type === 'coart-html' || selectedShape.meta.coartKind === 'ai-html') && htmlOpen && <HtmlEditorPanel editor={editor} shape={selectedShape} onClose={() => setHtmlOpen(false)} onStatus={showStatus} />}
      {editor && layersOpen && !generationOpen && !mediaOpen && !htmlOpen && <LayerPanel editor={editor} />}
      {editor && <Minimap editor={editor} />}
      <StatusToast message={status} />
      {slides.length > 0 && <SlidesViewer slides={slides} onClose={() => setSlides([])} onReorder={(next) => { setSlides(next); if (editor && slidesParentId) editor.layoutSlides(slidesParentId, next.map((slide) => slide.id)) }} />}
    </div>
  )
}
