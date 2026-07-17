import { useEffect, useState } from 'react'
import { Crop, ImagePlus, X } from 'lucide-react'
import type { AnyCanvasShape, EditorLike } from '../types'

interface MediaInspectorProps {
  editor: EditorLike
  shape: AnyCanvasShape
  onClose: () => void
  onStatus: (message: string) => void
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('圖片讀取失敗'))
    reader.readAsDataURL(file)
  })
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('圖片無法解碼'))
    image.src = source
  })
}

export function MediaInspector({ editor, shape, onClose, onStatus }: MediaInspectorProps) {
  const [altText, setAltText] = useState(String(shape.props.altText || ''))
  const [crop, setCrop] = useState({ left: 0, top: 0, right: 0, bottom: 0 })
  const source = editor.getImageSource(shape.id)

  useEffect(() => setAltText(String(shape.props.altText || '')), [shape.id, shape.props.altText])

  const replace = async (file: File): Promise<void> => {
    const dataUrl = await readFile(file)
    editor.replaceImage(shape.id, dataUrl, file.name)
    onStatus('圖片已替換；舊來源保留供回復')
  }

  const applyCrop = async (): Promise<void> => {
    if (!source) return
    const image = await loadImage(source)
    const sx = Math.round(image.naturalWidth * crop.left / 100)
    const sy = Math.round(image.naturalHeight * crop.top / 100)
    const width = Math.max(1, Math.round(image.naturalWidth * (100 - crop.left - crop.right) / 100))
    const height = Math.max(1, Math.round(image.naturalHeight * (100 - crop.top - crop.bottom) / 100))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('裁切需要 Canvas 2D')
    context.drawImage(image, sx, sy, width, height, 0, 0, width, height)
    editor.replaceImage(shape.id, canvas.toDataURL('image/png'), `crop-${Date.now()}.png`)
    editor.updateShape(shape.id, { props: { altText } })
    onStatus('裁切與 alt text 已套用')
    onClose()
  }

  return (
    <section className="coart-panel coart-media-inspector" aria-label="圖片情境編輯">
      <header><div><strong>圖片</strong><span>裁切、替換與替代文字</span></div><button className="coart-panel-close" onClick={onClose}><X size={17} /></button></header>
      {source && <div className="coart-crop-preview"><img src={source} alt={altText} style={{ clipPath: `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)` }} /></div>}
      <label className="coart-field is-stacked">Alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="描述圖片內容" /></label>
      <div className="coart-crop-grid">
        {(['left', 'top', 'right', 'bottom'] as const).map((side) => <label key={side}>{side}<input type="range" min="0" max="45" value={crop[side]} onChange={(event) => setCrop({ ...crop, [side]: Number(event.target.value) })} /><output>{crop[side]}%</output></label>)}
      </div>
      <div className="coart-panel-actions">
        <label className="coart-secondary"><ImagePlus size={15} />替換<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void replace(file) }} /></label>
        <button className="coart-primary" onClick={() => void applyCrop()}><Crop size={15} />套用裁切</button>
      </div>
    </section>
  )
}
