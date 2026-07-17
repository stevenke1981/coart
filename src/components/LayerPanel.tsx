import { useEffect, useMemo, useState } from 'react'
import { Group, Layers3, Lock, Ungroup } from 'lucide-react'
import type { AnyCanvasShape, EditorLike } from '../types'

interface LayerPanelProps {
  editor: EditorLike
}

function label(shape: AnyCanvasShape): string {
  return String(shape.props.name || shape.props.title || shape.props.altText || shape.meta.coartGroupName || shape.type || '物件')
}

export function LayerPanel({ editor }: LayerPanelProps) {
  const [, setRevision] = useState(0)
  const [name, setName] = useState('')
  useEffect(() => editor.onChange(() => setRevision((value) => value + 1)), [editor])
  const selected = editor.getSelectedShapeIds()
  const selectedSet = useMemo(() => new Set(selected), [selected.join('\u0000')])
  const shapes = [...editor.getCurrentPageShapes()].reverse()
  useEffect(() => {
    const first = selected.length === 1 ? editor.getShape(selected[0]) : null
    setName(first ? label(first) : '')
  }, [editor, selected.join('\u0000')])
  return (
    <aside className="coart-layer-panel" aria-label="圖層">
      <header><Layers3 size={16} /><strong>圖層</strong><span>{shapes.length}</span></header>
      <div className="coart-layer-actions">
        <button disabled={selected.length < 2} onClick={() => editor.groupSelection()} title="群組"><Group size={15} /></button>
        <button disabled={!selected.some((id) => Boolean(editor.getShape(id)?.meta.coartGroupId))} onClick={() => editor.ungroupSelection()} title="取消群組"><Ungroup size={15} /></button>
        <button disabled={!selected.length} onClick={() => editor.toggleSelectionLock()} title="鎖定"><Lock size={15} /></button>
      </div>
      {selected.length > 0 && <form onSubmit={(event) => { event.preventDefault(); editor.renameSelection(name) }}><input value={name} onChange={(event) => setName(event.target.value)} placeholder={selected.length > 1 ? '群組名稱' : '物件名稱'} /><button>命名</button></form>}
      <div className="coart-layer-list">
        {shapes.map((shape) => <button key={shape.id} className={selectedSet.has(shape.id) ? 'active' : ''} onClick={() => editor.select(shape.id)}><span className={`is-${shape.type || 'shape'}`} /><span>{label(shape)}</span>{shape.isLocked && <Lock size={11} />}</button>)}
      </div>
    </aside>
  )
}
