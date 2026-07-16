import {
  Bot,
  ChevronDown,
  Circle,
  FileCode2,
  Frame,
  Hand,
  ImagePlus,
  Minus,
  MoreHorizontal,
  MousePointer2,
  PencilLine,
  Plus,
  Presentation,
  Redo2,
  Save,
  Shapes,
  Square,
  StickyNote,
  Type,
  Undo2
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { ASPECT_PRESETS, COART_KINDS, DEFAULT_HTML_SIZE, DEFAULT_IMAGE_RESOLUTION, DEFAULT_SLIDES_SIZE } from '../constants'
import { createCoartShapeId } from '../lib/ferricCanvas'
import type { AnyCanvasShape, CanvasTool, CoartKind, EditorLike } from '../types'
import { CanvasStylePanel } from './CanvasStylePanel'

interface FrameOptions {
  kind: CoartKind
  width: number
  height: number
  name: string
  aspectRatio?: string
}

function viewportPoint(editor: EditorLike): { x: number; y: number } {
  const bounds = editor.getViewportPageBounds()
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
}

function createFrame(editor: EditorLike, { kind, width, height, name, aspectRatio }: FrameOptions): void {
  const center = viewportPoint(editor)
  const id = createCoartShapeId()
  editor.createShape({
    id,
    type: 'frame',
    x: center.x - width / 2,
    y: center.y - height / 2,
    props: { w: width, h: height, name },
    meta: {
      coartKind: kind,
      coartVersion: 1,
      ...(kind === COART_KINDS.AI_IMAGE ? { coartAspectRatio: aspectRatio, coartResolution: DEFAULT_IMAGE_RESOLUTION } : {})
    }
  })
  window.setTimeout(() => editor.select(id), 0)
}

function createShape(editor: EditorLike, type: 'ellipse' | 'arrow' | 'note' | 'frame'): void {
  const center = viewportPoint(editor)
  const width = type === 'arrow' ? 220 : type === 'note' ? 220 : 180
  const height = type === 'arrow' ? 80 : type === 'note' ? 160 : 140
  editor.createShape({
    id: createCoartShapeId(),
    type,
    x: center.x - width / 2,
    y: center.y - height / 2,
    props: {
      w: width,
      h: height,
      ...(type === 'arrow' ? { x2: width, y2: height, stroke: '#2563eb', strokeWidth: 3 } : {}),
      ...(type === 'note' ? { fill: '#fff5b8', stroke: '#d9be4b', strokeWidth: 1.5 } : {}),
      ...(type === 'frame' ? { fill: 'transparent', stroke: '#98a2b3', strokeStyle: 'dashed' } : {})
    },
    meta: { coartVersion: 1 }
  })
}

interface CanvasToolbarProps {
  editor: EditorLike | null
  ready: boolean
  selectedShapes: AnyCanvasShape[]
  generationOpen: boolean
  aspectId: string
  onAspectChange: (value: string) => void
  onAnnotate: () => void
  onOpenSlides: () => void
  onSaveNow: () => void
}

type OpenPopover = 'shape' | 'ai' | 'more' | 'zoom' | null

export function CanvasToolbar({ editor, ready, selectedShapes, generationOpen, aspectId, onAspectChange, onAnnotate, onOpenSlides, onSaveNow }: CanvasToolbarProps) {
  const [activeTool, setActiveTool] = useState<CanvasTool>('select')
  const [zoomPercent, setZoomPercent] = useState(100)
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null)
  const [, setDocumentRevision] = useState(0)

  useEffect(() => {
    if (!editor) return undefined
    const updateTool = editor.on('tool', ({ tool }) => setActiveTool(tool))
    const updateCamera = editor.on('camera', ({ camera }) => setZoomPercent(Math.round(camera.z * 100)))
    const updateDocument = editor.on('document', ({ revision }) => setDocumentRevision(revision))
    setActiveTool(editor.getCurrentTool())
    setZoomPercent(Math.round(editor.getCamera().z * 100))
    return () => { updateTool(); updateCamera(); updateDocument() }
  }, [editor])

  if (!editor) return null
  const preset = ASPECT_PRESETS.find((item) => item.id === aspectId) || ASPECT_PRESETS[0]

  const activateTool = (tool: CanvasTool): void => {
    editor.setCurrentTool(tool)
    setOpenPopover(null)
  }

  const changeZoom = (direction: -1 | 1): void => {
    const camera = editor.getCamera()
    const next = Math.min(4, Math.max(.1, camera.z * (direction > 0 ? 1.2 : 1 / 1.2)))
    const viewport = editor.getViewportPageBounds()
    const center = { x: viewport.x + viewport.w / 2, y: viewport.y + viewport.h / 2 }
    editor.setCamera({ x: viewport.w * camera.z / 2 - center.x * next, y: viewport.h * camera.z / 2 - center.y * next, z: next })
  }

  return (
    <div className="coart-canvas-chrome" aria-busy={!ready}>
      <nav className="coart-document-bar" aria-label="畫布文件操作">
        <strong className="coart-document-title">Coart Ferric</strong>
        <span className="coart-page-label">頁面 1</span>
        <span className="coart-save-status">自動儲存</span>
        <span className="coart-document-divider" />
        <button disabled={!ready || !editor.canUndo()} onClick={() => editor.undo()} title="復原 (Ctrl/Cmd+Z)"><Undo2 size={17} /></button>
        <button disabled={!ready || !editor.canRedo()} onClick={() => editor.redo()} title="重做 (Ctrl/Cmd+Shift+Z)"><Redo2 size={17} /></button>
      </nav>

      <CanvasStylePanel editor={editor} ready={ready} selectedShapes={selectedShapes} generationOpen={generationOpen} />

      <nav className="coart-toolbar" aria-label="Coart 創作工具">
        <button disabled={!ready} className={activeTool === 'select' ? 'active' : ''} data-coart-tool="select" onClick={() => activateTool('select')} title="選取 (V)"><MousePointer2 size={20} /><span>選取</span></button>
        <button disabled={!ready} className={activeTool === 'pan' ? 'active' : ''} data-coart-tool="pan" onClick={() => activateTool('pan')} title="手掌 (H/Space)"><Hand size={20} /><span>手掌</span></button>
        <button disabled={!ready} className={activeTool === 'text' ? 'active' : ''} data-coart-tool="text" onClick={() => activateTool('text')} title="文字 (T)"><Type size={20} /><span>文字</span></button>
        <button disabled={!ready} className={activeTool === 'draw' ? 'active' : ''} data-coart-tool="draw" onClick={() => activateTool('draw')} title="手繪 (D)"><PencilLine size={20} /><span>手繪</span></button>

        <div className="coart-tool-popover-wrap">
          <button disabled={!ready} className={openPopover === 'shape' || activeTool === 'rectangle' ? 'active' : ''} onClick={() => setOpenPopover(openPopover === 'shape' ? null : 'shape')} title="形狀"><Shapes size={20} /><span>形狀</span><ChevronDown size={12} /></button>
          {openPopover === 'shape' && (
            <div className="coart-tool-popover is-shape" role="menu">
              <button data-coart-tool="rectangle" onClick={() => activateTool('rectangle')}><Square size={17} />矩形</button>
              <button onClick={() => { createShape(editor, 'ellipse'); setOpenPopover(null) }}><Circle size={17} />圓形</button>
              <button onClick={() => { createShape(editor, 'arrow'); setOpenPopover(null) }}>↗ 箭頭</button>
              <button onClick={() => { createShape(editor, 'note'); setOpenPopover(null) }}><StickyNote size={17} />便條</button>
              <button onClick={() => { createShape(editor, 'frame'); setOpenPopover(null) }}><Frame size={17} />Frame</button>
            </div>
          )}
        </div>

        <div className="coart-tool-popover-wrap">
          <button disabled={!ready} className={openPopover === 'ai' ? 'active' : ''} onClick={() => setOpenPopover(openPopover === 'ai' ? null : 'ai')} title="AI 建立"><Bot size={20} /><span>AI</span><ChevronDown size={12} /></button>
          {openPopover === 'ai' && (
            <div className="coart-tool-popover is-ai" role="menu">
              <label>圖片比例
                <select value={aspectId} onChange={(event) => onAspectChange(event.target.value)}>
                  {ASPECT_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
                </select>
              </label>
              <button onClick={() => { createFrame(editor, { kind: COART_KINDS.AI_IMAGE, width: preset.width, height: preset.height, name: `AI 圖片 ${preset.id}`, aspectRatio: preset.id }); setOpenPopover(null) }}><ImagePlus size={17} />AI 圖片</button>
              <button onClick={() => { createFrame(editor, { kind: COART_KINDS.AI_HTML, width: DEFAULT_HTML_SIZE.width, height: DEFAULT_HTML_SIZE.height, name: 'AI HTML' }); setOpenPopover(null) }}><FileCode2 size={17} />AI HTML</button>
              <button onClick={() => { createFrame(editor, { kind: COART_KINDS.SLIDES, width: DEFAULT_SLIDES_SIZE.width, height: DEFAULT_SLIDES_SIZE.height, name: 'AI Slides' }); setOpenPopover(null) }}><Presentation size={17} />AI Slides</button>
            </div>
          )}
        </div>

        <div className="coart-tool-popover-wrap">
          <button disabled={!ready} className={openPopover === 'more' ? 'active' : ''} onClick={() => setOpenPopover(openPopover === 'more' ? null : 'more')} title="更多"><MoreHorizontal size={20} /><span>更多</span></button>
          {openPopover === 'more' && (
            <div className="coart-tool-popover is-more" role="menu">
              <button onClick={() => { onSaveNow(); setOpenPopover(null) }}><Save size={16} />立即儲存</button>
              <button onClick={() => { onAnnotate(); setOpenPopover(null) }}><ImagePlus size={16} />匯出標註</button>
              <button onClick={() => { onOpenSlides(); setOpenPopover(null) }}><Presentation size={16} />播放 Slides</button>
            </div>
          )}
        </div>
      </nav>

      <div className="coart-zoom-control" aria-label="縮放控制">
        <button disabled={!ready} onClick={() => changeZoom(-1)} title="縮小"><Minus size={16} /></button>
        <button className="coart-zoom-output" onClick={() => setOpenPopover(openPopover === 'zoom' ? null : 'zoom')} title="縮放選單"><output>{zoomPercent}%</output><ChevronDown size={12} /></button>
        <button disabled={!ready} onClick={() => changeZoom(1)} title="放大"><Plus size={16} /></button>
        {openPopover === 'zoom' && (
          <div className="coart-zoom-menu">
            <button onClick={() => { editor.zoomToFit('content'); setOpenPopover(null) }}>Fit 全部</button>
            <button disabled={!selectedShapes.length} onClick={() => { editor.zoomToFit('selection'); setOpenPopover(null) }}>Fit 選取</button>
            {[50, 100, 200].map((value) => <button key={value} onClick={() => { editor.setCamera({ ...editor.getCamera(), z: value / 100 }); setOpenPopover(null) }}>{value}%</button>)}
          </div>
        )}
      </div>
    </div>
  )
}
