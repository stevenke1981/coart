import { ArrowDown, ArrowUp, Code2, Copy, Crop, Download, Group, LayoutGrid, Lock, PaintBucket, Play, Sparkles, Trash2, Ungroup } from 'lucide-react'
import { contextToolbarMode } from '../canvas/context'
import type { AnyCanvasShape, EditorLike } from '../types'

interface ContextToolbarProps {
  editor: EditorLike | null
  selectedShapes: AnyCanvasShape[]
  onAnnotate: () => void
  onOpenSlides: () => void
  onExportSlides: () => void
  onGenerate: () => void
  onMedia: () => void
  onHtmlEdit: () => void
  onLayoutSlides: () => void
}

export function ContextToolbar({ editor, selectedShapes, onAnnotate, onOpenSlides, onExportSlides, onGenerate, onMedia, onHtmlEdit, onLayoutSlides }: ContextToolbarProps) {
  const mode = contextToolbarMode(selectedShapes)
  const bounds = editor?.getSelectionScreenBounds()
  if (!editor || !mode || !bounds) return null
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 720 : window.innerHeight
  const estimatedHalfWidth = Math.min(260, Math.max(120, viewportWidth / 2 - 10))
  const above = bounds.y > 62 && bounds.y < viewportHeight
  const rawTop = above ? bounds.y - 12 : bounds.y + bounds.h + 12
  const style: React.CSSProperties = {
    left: Math.min(viewportWidth - estimatedHalfWidth, Math.max(estimatedHalfWidth, bounds.x + bounds.w / 2)),
    top: above ? rawTop : Math.min(viewportHeight - 58, Math.max(12, rawTop)),
    transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
  }
  const supportsGeneration = mode === 'ai-image' || mode === 'ai-html' || mode === 'slides' || mode === 'image'
  const grouped = selectedShapes.some((shape) => Boolean(shape.meta.coartGroupId))

  return (
    <nav className="coart-context-toolbar" style={style} aria-label="選取物件操作" data-context-mode={mode}>
      <button onClick={() => editor.updateSelectedStyles({ fill: '#ffffff' })} title="填色"><PaintBucket size={16} /></button>
      {supportsGeneration && <button className="is-primary" onClick={onGenerate} title="開啟生成面板"><Sparkles size={16} /><span>生成</span></button>}
      {(mode === 'image' || (mode === 'ai-image' && selectedShapes[0]?.type === 'image')) && <button onClick={onMedia} title="裁切、替換與 alt text"><Crop size={16} /><span>圖片</span></button>}
      {(mode === 'image' || mode === 'ai-image' || mode === 'ai-html') && <button onClick={onAnnotate} title="按標註修改"><span>標註</span></button>}
      {mode === 'ai-html' && <button onClick={onHtmlEdit} title="直接編輯 HTML DOM"><Code2 size={16} /><span>HTML</span></button>}
      {mode === 'slides' && <><button onClick={onLayoutSlides} title="自動排列 Slides"><LayoutGrid size={16} /><span>排列</span></button><button onClick={onExportSlides} title="匯出 Slides HTML"><Download size={16} /><span>匯出</span></button><button onClick={onOpenSlides} title="播放 Slides"><Play size={16} /><span>播放</span></button></>}
      {mode === 'mixed' && <button onClick={() => grouped ? editor.ungroupSelection() : editor.groupSelection()} title={grouped ? '取消群組' : '群組'}>{grouped ? <Ungroup size={16} /> : <Group size={16} />}<span>{grouped ? '解組' : '群組'}</span></button>}
      <span className="coart-context-divider" />
      <button onClick={() => editor.moveSelectionLayer('backward')} title="下移一層"><ArrowDown size={16} /></button>
      <button onClick={() => editor.moveSelectionLayer('forward')} title="上移一層"><ArrowUp size={16} /></button>
      <button onClick={() => editor.toggleSelectionLock()} title="鎖定或解鎖"><Lock size={16} /></button>
      <button onClick={() => editor.duplicateSelection()} title="複製"><Copy size={16} /></button>
      <button className="is-danger" onClick={() => editor.deleteSelection()} title="刪除"><Trash2 size={16} /></button>
    </nav>
  )
}
