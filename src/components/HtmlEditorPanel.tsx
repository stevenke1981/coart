import { useEffect, useState } from 'react'
import { Code2, X } from 'lucide-react'
import type { AnyCanvasShape, EditorLike } from '../types'

interface HtmlEditorPanelProps {
  editor: EditorLike
  shape: AnyCanvasShape
  onClose: () => void
  onStatus: (message: string) => void
}

export function HtmlEditorPanel({ editor, shape, onClose, onStatus }: HtmlEditorPanelProps) {
  const [html, setHtml] = useState(String(shape.props.html || ''))
  useEffect(() => setHtml(String(shape.props.html || '')), [shape.id, shape.props.html])
  return (
    <section className="coart-panel coart-html-editor-panel" aria-label="HTML DOM 編輯">
      <header><div><strong>HTML 物件</strong><span>直接編輯 DOM 來源並即時預覽</span></div><button className="coart-panel-close" onClick={onClose}><X size={17} /></button></header>
      <div className="coart-html-editor-grid">
        <textarea value={html} onChange={(event) => setHtml(event.target.value)} spellCheck={false} aria-label="HTML 原始碼" />
        <iframe title="HTML 即時預覽" srcDoc={html} sandbox="allow-scripts allow-forms" />
      </div>
      <button className="coart-primary" onClick={() => { editor.updateShape(shape.id, { type: 'coart-html', props: { html, title: String(shape.props.title || shape.props.name || 'HTML 物件') } }); onStatus('HTML 內容已更新'); onClose() }}><Code2 size={15} />儲存 HTML</button>
    </section>
  )
}
