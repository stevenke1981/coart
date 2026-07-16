import { useEffect, useMemo, useRef, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { COART_KINDS, DEFAULT_IMAGE_RESOLUTION, IMAGE_RESOLUTION_PRESETS } from '../constants'
import { fileToDataUrl } from '../lib/dataUrl'
import { saveReferenceImage, sendFollowUpMessage } from '../lib/coartClient'
import { htmlPrompt, imagePrompt, slidesPrompt } from '../lib/prompts'
import type { AnyCanvasShape, EditorLike, ImageResolution, PromptShape } from '../types'

type GenerationMode = 'image' | 'html' | 'slides'
const MAX_REFERENCES = 8

export function modeForShape(shape: AnyCanvasShape | null): GenerationMode | null {
  const kind = shape?.meta?.coartKind
  if (kind === COART_KINDS.AI_IMAGE || shape?.type === 'image') return 'image'
  if (kind === COART_KINDS.AI_HTML || shape?.type === 'coart-html') return 'html'
  if (kind === COART_KINDS.SLIDES) return 'slides'
  return null
}

interface GenerationPanelProps {
  editor: EditorLike | null
  selectedShape: AnyCanvasShape | null
  open: boolean
  onClose: () => void
  onStatus?: (message: string) => void
}

export function GenerationPanel({ editor, selectedShape, open, onClose, onStatus }: GenerationPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const draftsRef = useRef(new Map<string, string>())
  const filesRef = useRef(new Map<string, File[]>())
  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [slideCount, setSlideCount] = useState(5)
  const [customSlides, setCustomSlides] = useState(false)
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION)
  const [busy, setBusy] = useState(false)
  const mode = modeForShape(selectedShape)

  useEffect(() => {
    const id = selectedShape?.id
    if (!id) return
    setPrompt(draftsRef.current.get(id) ?? '')
    setFiles(filesRef.current.get(id) ?? [])
    setResolution(selectedShape.meta?.coartResolution || DEFAULT_IMAGE_RESOLUTION)
  }, [selectedShape?.id, selectedShape?.meta?.coartResolution])

  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file))
    setPreviews(next)
    return () => next.forEach((url) => URL.revokeObjectURL(url))
  }, [files])

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    const closeOutside = (event: PointerEvent): void => {
      if (!busy && panelRef.current && !panelRef.current.contains(event.target as Node)) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('pointerdown', closeOutside, true)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('pointerdown', closeOutside, true)
    }
  }, [busy, onClose, open])

  const title = useMemo(() => (mode ? {
    image: selectedShape?.type === 'image' && selectedShape.meta?.coartKind !== COART_KINDS.AI_IMAGE ? '編輯 Coart 圖片' : '生成 AI 圖片',
    html: '生成 AI HTML',
    slides: '生成 AI Slides'
  }[mode] : ''), [mode, selectedShape])

  if (!open || !mode || !editor || !selectedShape) return null
  const bounds = editor.getSelectionScreenBounds()
  const panelWidth = 352
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 720 : window.innerHeight
  const preferredLeft = bounds ? bounds.x + bounds.w + 12 : viewportWidth - panelWidth - 16
  const left = preferredLeft + panelWidth <= viewportWidth - 12
    ? preferredLeft
    : Math.max(12, (bounds?.x ?? viewportWidth) - panelWidth - 12)
  const top = Math.max(12, Math.min(viewportHeight - 520, bounds?.y ?? 72))

  const updatePrompt = (value: string): void => {
    setPrompt(value)
    draftsRef.current.set(selectedShape.id, value)
  }

  const updateFiles = (next: File[]): void => {
    const limited = next.slice(0, MAX_REFERENCES)
    setFiles(limited)
    filesRef.current.set(selectedShape.id, limited)
    if (next.length > MAX_REFERENCES) onStatus?.(`參考圖最多 ${MAX_REFERENCES} 張`)
  }

  const submit = async (): Promise<void> => {
    if (busy) return
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
      const args = { userPrompt: prompt, shape: selectedShape as PromptShape, pageId, references, slideCount, resolution }
      const message = mode === 'image' ? imagePrompt(args) : mode === 'html' ? htmlPrompt(args) : slidesPrompt(args)
      const delivery = await sendFollowUpMessage(message)
      onStatus?.((delivery as { pending?: boolean })?.pending
        ? '修改指令已送入待處理佇列；回到對話說「繼續處理」即可'
        : '已將生成任務送交 Codex')
      draftsRef.current.delete(selectedShape.id)
      filesRef.current.delete(selectedShape.id)
      setPrompt('')
      setFiles([])
      onClose()
    } catch (error: unknown) {
      console.error(error)
      onStatus?.(`送出失敗：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside ref={panelRef} className="coart-panel" style={{ left, top, right: 'auto' }}>
      <header>
        <div><strong>{title}</strong><span>{selectedShape.props?.w} × {selectedShape.props?.h}</span></div>
        <button className="coart-panel-close" disabled={busy} onClick={onClose} title="關閉"><X size={16} /></button>
      </header>
      <textarea
        value={prompt}
        onChange={(event) => updatePrompt(event.target.value)}
        onPaste={(event) => {
          const images = [...event.clipboardData.items]
            .filter((item) => item.type.startsWith('image/'))
            .map((item) => item.getAsFile())
            .filter((file): file is File => Boolean(file))
          if (images.length) {
            event.preventDefault()
            updateFiles([...files, ...images])
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            void submit()
          }
        }}
        placeholder={mode === 'slides' ? '描述整套簡報的主題、對象、風格與內容…' : '描述要生成的內容、風格、構圖與文字…'}
      />
      <small className="coart-prompt-hint">Ctrl/Cmd + Enter 送出</small>
      {mode === 'image' && (
        <label className="coart-field">輸出解析度
          <select value={resolution} onChange={(event) => setResolution(event.target.value as ImageResolution)}>
            {IMAGE_RESOLUTION_PRESETS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      )}
      {mode === 'slides' && (
        <div className="coart-slide-count">
          <span>頁數</span>
          {[3, 5, 10].map((count) => <button key={count} className={!customSlides && slideCount === count ? 'active' : ''} onClick={() => { setCustomSlides(false); setSlideCount(count) }}>{count}</button>)}
          <button className={customSlides ? 'active' : ''} onClick={() => setCustomSlides(true)}>自訂</button>
          {customSlides && <input aria-label="自訂頁數" type="number" min="1" max="30" value={slideCount} onChange={(event) => setSlideCount(Number(event.target.value) || 1)} />}
        </div>
      )}
      <label className="coart-upload">
        <Paperclip size={16} />加入參考圖 <span>{files.length}/{MAX_REFERENCES}</span>
        <input type="file" accept="image/*" multiple onChange={(event) => updateFiles([...files, ...Array.from(event.target.files || [])])} />
      </label>
      {files.length > 0 && (
        <div className="coart-reference-grid">
          {files.map((file, index) => (
            <figure key={`${file.name}-${file.lastModified}-${index}`}>
              <img src={previews[index]} alt="" />
              <figcaption title={file.name}>{file.name}</figcaption>
              <button onClick={() => updateFiles(files.filter((_, itemIndex) => itemIndex !== index))} title="移除"><X size={12} /></button>
            </figure>
          ))}
        </div>
      )}
      <button className="coart-primary" disabled={busy} onClick={() => void submit()}>
        <Send size={16} />{busy ? '傳送中…' : '送交 Codex'}
      </button>
    </aside>
  )
}
