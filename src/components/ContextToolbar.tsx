import { ArrowDown, ArrowUp, Copy, Lock, PaintBucket, Play, Sparkles, Trash2 } from 'lucide-react'
import { contextToolbarMode } from '../canvas/context'
import type { AnyCanvasShape, EditorLike } from '../types'

interface ContextToolbarProps {
  editor: EditorLike | null
  selectedShapes: AnyCanvasShape[]
  onAnnotate: () => void
  onOpenSlides: () => void
  onGenerate: () => void
}

export function ContextToolbar({ editor, selectedShapes, onAnnotate, onOpenSlides, onGenerate }: ContextToolbarProps) {
  const mode = contextToolbarMode(selectedShapes)
  const bounds = editor?.getSelectionScreenBounds()
  if (!editor || !mode || !bounds) return null
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 720 : window.innerHeight
  const estimatedHalfWidth = Math.min(190, Math.max(120, viewportWidth / 2 - 10))
  const above = bounds.y > 62 && bounds.y < viewportHeight
  const rawTop = above ? bounds.y - 12 : bounds.y + bounds.h + 12
  const style: React.CSSProperties = {
    left: Math.min(viewportWidth - estimatedHalfWidth, Math.max(estimatedHalfWidth, bounds.x + bounds.w / 2)),
    top: above ? rawTop : Math.min(viewportHeight - 58, Math.max(12, rawTop)),
    transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
  }
  const supportsGeneration = mode === 'ai-image' || mode === 'ai-html' || mode === 'slides' || mode === 'image'

  return (
    <nav className="coart-context-toolbar" style={style} aria-label="選取物件操作" data-context-mode={mode}>
      <button onClick={() => editor.updateSelectedStyles({ fill: '#ffffff' })} title="填色"><PaintBucket size={16} /></button>
      {supportsGeneration && <button className="is-primary" onClick={onGenerate} title="開啟生成面板"><Sparkles size={16} /><span>生成</span></button>}
      {(mode === 'image' || mode === 'ai-html') && <button onClick={onAnnotate} title="按標註修改"><span>標註</span></button>}
      {mode === 'slides' && <button onClick={onOpenSlides} title="播放 Slides"><Play size={16} /><span>播放</span></button>}
      <span className="coart-context-divider" />
      <button onClick={() => editor.moveSelectionLayer('backward')} title="下移一層"><ArrowDown size={16} /></button>
      <button onClick={() => editor.moveSelectionLayer('forward')} title="上移一層"><ArrowUp size={16} /></button>
      <button onClick={() => editor.toggleSelectionLock()} title="鎖定或解鎖"><Lock size={16} /></button>
      <button onClick={() => editor.duplicateSelection()} title="複製"><Copy size={16} /></button>
      <button className="is-danger" onClick={() => editor.deleteSelection()} title="刪除"><Trash2 size={16} /></button>
    </nav>
  )
}
