import { FileCode2, ImagePlus, MonitorPlay, MousePointer2, PencilLine, Presentation, Save, Square, Type } from 'lucide-react'
import { ASPECT_PRESETS, COART_KINDS, DEFAULT_HTML_SIZE, DEFAULT_SLIDES_SIZE } from '../constants'
import { createCoartShapeId } from '../lib/ferricCanvas'
import type { CoartKind, EditorLike } from '../types'

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
  aspectId: string
  onAspectChange: (value: string) => void
  onAnnotate: () => void
  onOpenSlides: () => void
  onSaveNow: () => void
}

export function CanvasToolbar({ editor, ready, aspectId, onAspectChange, onAnnotate, onOpenSlides, onSaveNow }: CanvasToolbarProps) {
  if (!editor) return null
  const preset = ASPECT_PRESETS.find((item) => item.id === aspectId) || ASPECT_PRESETS[2]

  return (
    <div className="coart-toolbar" aria-label="Coart tools" aria-busy={!ready}>
      <div className="coart-brand"><span>Coart</span><small>AI Canvas</small></div>
      <button disabled={!ready} data-coart-tool="select" onClick={() => editor.setCurrentTool('select')} title="選取"><MousePointer2 size={17} /></button>
      <button disabled={!ready} data-coart-tool="draw" onClick={() => editor.setCurrentTool('draw')} title="手繪"><PencilLine size={17} /></button>
      <button disabled={!ready} data-coart-tool="rectangle" onClick={() => editor.setCurrentTool('rectangle')} title="拖曳建立框線"><Square size={17} />框線</button>
      <button disabled={!ready} data-coart-tool="text" onClick={() => editor.setCurrentTool('text')} title="點擊畫布新增可編輯文字"><Type size={17} />文字</button>
      <div className="coart-divider" />
      <select disabled={!ready} value={aspectId} onChange={(event) => onAspectChange(event.target.value)} aria-label="圖片比例">
        {ASPECT_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
      </select>
      <button
        disabled={!ready}
        onClick={() => createFrame(editor, {
          kind: COART_KINDS.AI_IMAGE,
          width: preset.width,
          height: preset.height,
          name: `AI 圖片 ${preset.id}`
        })}
        title="建立 AI 圖片框"
      ><ImagePlus size={17} />AI 圖片</button>
      <button
        disabled={!ready}
        onClick={() => createFrame(editor, {
          kind: COART_KINDS.AI_HTML,
          width: DEFAULT_HTML_SIZE.width,
          height: DEFAULT_HTML_SIZE.height,
          name: 'AI HTML'
        })}
        title="建立 AI HTML 框"
      ><FileCode2 size={17} />AI HTML</button>
      <button
        disabled={!ready}
        onClick={() => createFrame(editor, {
          kind: COART_KINDS.SLIDES,
          width: DEFAULT_SLIDES_SIZE.width,
          height: DEFAULT_SLIDES_SIZE.height,
          name: 'AI Slides'
        })}
        title="建立 AI Slides"
      ><Presentation size={17} />Slides</button>
      <div className="coart-divider" />
      <button disabled={!ready} onClick={onAnnotate} title="匯出目前多選內容作為標註截圖"><ImagePlus size={17} />按標註修改</button>
      <button disabled={!ready} onClick={onOpenSlides} title="播放選取的 Slides"><MonitorPlay size={17} />播放</button>
      <button disabled={!ready} onClick={onSaveNow} title="立即儲存"><Save size={17} /></button>
    </div>
  )
}
