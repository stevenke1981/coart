import { useMemo, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { COART_KINDS } from '../constants'
import { fileToDataUrl } from '../lib/dataUrl'
import { saveReferenceImage, sendFollowUpMessage } from '../lib/coartClient'
import { htmlPrompt, imagePrompt, slidesPrompt } from '../lib/prompts'
import type { AnyCanvasShape, EditorLike, PromptShape } from '../types'

type GenerationMode = 'image' | 'html' | 'slides'

function modeForShape(shape: AnyCanvasShape | null): GenerationMode | null {
  const kind = shape?.meta?.coartKind
  if (kind === COART_KINDS.AI_IMAGE) return 'image'
  if (kind === COART_KINDS.AI_HTML) return 'html'
  if (kind === COART_KINDS.SLIDES) return 'slides'
  return null
}

interface GenerationPanelProps {
  editor: EditorLike | null
  selectedShape: AnyCanvasShape | null
  onStatus?: (message: string) => void
}

export function GenerationPanel({ editor, selectedShape, onStatus }: GenerationPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [slideCount, setSlideCount] = useState(5)
  const [busy, setBusy] = useState(false)
  const mode = modeForShape(selectedShape)
  const title = useMemo(() => (mode ? {
    image: '生成 AI 圖片',
    html: '生成 AI HTML',
    slides: '生成 AI Slides'
  }[mode] : ''), [mode])

  if (!mode || !editor || !selectedShape) return null

  const submit = async () => {
    if (!prompt.trim()) {
      onStatus?.('請先輸入 prompt')
      return
    }
    setBusy(true)
    try {
      const pageId = editor.getCurrentPageId()
      const references = []
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file)
        references.push(await saveReferenceImage({
          pageId,
          anchorShapeId: selectedShape.id,
          fileName: file.name,
          dataUrl,
          mimeType: file.type
        }))
      }

      const args = {
        userPrompt: prompt,
        shape: selectedShape as PromptShape,
        pageId,
        references,
        slideCount
      }
      const message = mode === 'image'
        ? imagePrompt(args)
        : mode === 'html'
          ? htmlPrompt(args)
          : slidesPrompt(args)
      const delivery = await sendFollowUpMessage(message)
      onStatus?.((delivery as { copiedToClipboard?: boolean })?.copiedToClipboard
        ? '提示詞已複製，請貼回同一 Codex 對話'
        : '已將生成任務送交 Codex')
      setPrompt('')
      setFiles([])
    } catch (error: unknown) {
      console.error(error)
      onStatus?.(`送出失敗：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="coart-panel">
      <header>
        <div><strong>{title}</strong><span>{selectedShape.props?.w} × {selectedShape.props?.h}</span></div>
      </header>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={mode === 'slides' ? '描述整套簡報的主題、對象、風格與內容…' : '描述要生成的內容、風格、構圖與文字…'}
      />
      {mode === 'slides' && (
        <label className="coart-field">頁數
          <input type="number" min="1" max="30" value={slideCount} onChange={(event) => setSlideCount(Number(event.target.value) || 1)} />
        </label>
      )}
      <label className="coart-upload">
        <Paperclip size={16} />加入參考圖
        <input type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} />
      </label>
      {files.length > 0 && (
        <div className="coart-files">
          {files.map((file, index) => (
            <span key={`${file.name}-${index}`}>{file.name}<button onClick={() => setFiles(files.filter((_, i) => i !== index))}><X size={12} /></button></span>
          ))}
        </div>
      )}
      <button className="coart-primary" disabled={busy} onClick={submit}>
        <Send size={16} />{busy ? '傳送中…' : '送交 Codex'}
      </button>
    </aside>
  )
}
