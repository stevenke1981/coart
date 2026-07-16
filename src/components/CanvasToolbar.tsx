import {
  ChevronDown,
  Copy,
  FileCode2,
  Hand,
  ImagePlus,
  Menu,
  Minus,
  MonitorPlay,
  MoreHorizontal,
  MousePointer2,
  PencilLine,
  Plus,
  Presentation,
  Save,
  Square,
  Trash2,
  Type
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { ASPECT_PRESETS, COART_KINDS, DEFAULT_HTML_SIZE, DEFAULT_SLIDES_SIZE } from '../constants'
import { createCoartShapeId } from '../lib/ferricCanvas'
import type { AnyCanvasShape, CanvasTool, CoartKind, EditorLike } from '../types'
import { CanvasStylePanel } from './CanvasStylePanel'

interface FrameOptions {
  kind: CoartKind
  width: number
  height: number
  name: string
}

function viewportPoint(editor: EditorLike): { x: number; y: number } {
  const bounds = editor.getViewportPageBounds()
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
}

function createFrame(editor: EditorLike, { kind, width, height, name }: FrameOptions): void {
  const center = viewportPoint(editor)
  const id = createCoartShapeId()
  editor.createShape({
    id,
    type: 'frame',
    x: center.x - width / 2,
    y: center.y - height / 2,
    props: { w: width, h: height, name },
    meta: { coartKind: kind, coartVersion: 1 }
  })
  window.setTimeout(() => editor.select(id), 0)
}

interface CanvasToolbarProps {
  editor: EditorLike | null
  ready: boolean
  selectedShape: AnyCanvasShape | null
  aspectId: string
  onAspectChange: (value: string) => void
  onAnnotate: () => void
  onOpenSlides: () => void
  onSaveNow: () => void
}

export function CanvasToolbar({ editor, ready, selectedShape, aspectId, onAspectChange, onAnnotate, onOpenSlides, onSaveNow }: CanvasToolbarProps) {
  const [activeTool, setActiveTool] = useState<CanvasTool>('select')
  const [zoomPercent, setZoomPercent] = useState(100)
  const [selectionCount, setSelectionCount] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    if (!editor) return undefined
    const update = () => {
      setActiveTool(editor.getCurrentTool())
      setZoomPercent(Math.round(editor.getCamera().z * 100))
      setSelectionCount(editor.getSelectedShapeIds().length)
    }
    update()
    return editor.onChange(update)
  }, [editor])

  if (!editor) return null
  const preset = ASPECT_PRESETS.find((item) => item.id === aspectId) || ASPECT_PRESETS[2]
  const hasSelection = selectionCount > 0

  const activateTool = (tool: CanvasTool): void => {
    editor.setCurrentTool(tool)
    setActiveTool(tool)
  }

  const changeZoom = (direction: -1 | 1): void => {
    const camera = editor.getCamera()
    const bounds = editor.getViewportPageBounds()
    const nextZoom = Math.min(4, Math.max(0.1, camera.z * (direction > 0 ? 1.2 : 1 / 1.2)))
    const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
    const viewport = { w: bounds.w * camera.z, h: bounds.h * camera.z }
    editor.setCamera({
      x: viewport.w / 2 - center.x * nextZoom,
      y: viewport.h / 2 - center.y * nextZoom,
      z: nextZoom
    })
  }

  return (
    <div className="coart-canvas-chrome" aria-busy={!ready}>
      <nav className="coart-document-bar" aria-label="畫布文件操作">
        <button className="coart-menu-button" onClick={() => setMoreOpen((value) => !value)} title="Coart 畫布選單" aria-label="Coart 畫布選單" aria-expanded={moreOpen}><Menu size={19} /></button>
        <div className="coart-page-button" title="目前頁面" aria-label="目前頁面：頁面 1"><span>頁面 1</span><ChevronDown size={15} /></div>
        <span className="coart-document-divider" />
        <button disabled={!ready} onClick={onSaveNow} title="立即儲存"><Save size={17} /></button>
        <button className="coart-selection-action" disabled={!ready || !hasSelection} onClick={() => editor.duplicateSelection()} title="複製選取物件"><Copy size={17} /></button>
        <button className="coart-selection-action" disabled={!ready || !hasSelection} onClick={() => editor.deleteSelection()} title="刪除選取物件"><Trash2 size={17} /></button>
        <div className="coart-more-wrap">
          <button disabled={!ready} className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen((value) => !value)} title="更多操作"><MoreHorizontal size={19} /></button>
          {moreOpen && (
            <div className="coart-more-menu">
              <button onClick={() => { onAnnotate(); setMoreOpen(false) }}><ImagePlus size={16} />匯出標註</button>
              <button onClick={() => { onOpenSlides(); setMoreOpen(false) }}><MonitorPlay size={16} />播放 Slides</button>
            </div>
          )}
        </div>
      </nav>

      <CanvasStylePanel editor={editor} ready={ready} selectedShape={selectedShape} />

      <nav className="coart-toolbar" aria-label="Coart 創作工具">
        <button className="coart-annotate-button" disabled={!ready} onClick={onAnnotate} title="匯出選取內容作為標註"><ImagePlus size={18} /><span>標註</span></button>
        <span className="coart-toolbar-divider" />
        <button disabled={!ready} className={activeTool === 'select' ? 'active' : ''} data-coart-tool="select" onClick={() => activateTool('select')} title="選取"><MousePointer2 size={20} /></button>
        <button disabled={!ready} className={activeTool === 'pan' ? 'active' : ''} data-coart-tool="pan" onClick={() => activateTool('pan')} title="平移畫布"><Hand size={20} /></button>
        <button disabled={!ready} className={activeTool === 'rectangle' ? 'active' : ''} data-coart-tool="rectangle" onClick={() => activateTool('rectangle')} title="拖曳建立框線"><Square size={20} /></button>
        <span className="coart-toolbar-divider" />
        <div className="coart-aspect-tool">
          <select disabled={!ready} value={aspectId} onChange={(event) => onAspectChange(event.target.value)} aria-label="AI 圖片比例">
            {ASPECT_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
          </select>
          <button
            disabled={!ready}
            onClick={() => createFrame(editor, { kind: COART_KINDS.AI_IMAGE, width: preset.width, height: preset.height, name: `AI 圖片 ${preset.id}` })}
            title="建立 AI 圖片框"
          ><ImagePlus size={20} /></button>
        </div>
        <button disabled={!ready} className={activeTool === 'draw' ? 'active' : ''} data-coart-tool="draw" onClick={() => activateTool('draw')} title="手繪"><PencilLine size={20} /></button>
        <button disabled={!ready} className={activeTool === 'text' ? 'active' : ''} data-coart-tool="text" onClick={() => activateTool('text')} title="新增文字"><Type size={20} /></button>
        <button disabled={!ready} onClick={() => createFrame(editor, { kind: COART_KINDS.AI_HTML, width: DEFAULT_HTML_SIZE.width, height: DEFAULT_HTML_SIZE.height, name: 'AI HTML' })} title="建立 AI HTML 框"><FileCode2 size={20} /></button>
        <button disabled={!ready} onClick={() => createFrame(editor, { kind: COART_KINDS.SLIDES, width: DEFAULT_SLIDES_SIZE.width, height: DEFAULT_SLIDES_SIZE.height, name: 'AI Slides' })} title="建立 AI Slides"><Presentation size={20} /></button>
        <button disabled={!ready} onClick={onOpenSlides} title="播放選取的 Slides"><MonitorPlay size={20} /></button>
      </nav>

      <div className="coart-zoom-control" aria-label="縮放控制">
        <button disabled={!ready} onClick={() => changeZoom(-1)} title="縮小"><Minus size={16} /></button>
        <output>{zoomPercent}%</output>
        <button disabled={!ready} onClick={() => changeZoom(1)} title="放大"><Plus size={16} /></button>
      </div>
    </div>
  )
}
