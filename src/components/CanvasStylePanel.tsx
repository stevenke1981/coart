import { Ban, Circle, PaintBucket, PencilLine, Pin, PinOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { mixedValue } from '../canvas/style'
import type { AnyCanvasShape, CanvasStrokeStyle, EditorLike } from '../types'

const SWATCHES = [
  '#202124', '#98a2b3', '#d976e8', '#9b3ad2',
  '#2563eb', '#3d9be9', '#f3a83b', '#e65f12',
  '#07966f', '#49ad61', '#f56f72', '#e33030'
]

const STROKE_SIZES = [
  { label: 'S', value: 1.5 },
  { label: 'M', value: 3 },
  { label: 'L', value: 5 },
  { label: 'XL', value: 8 }
]

interface CanvasStylePanelProps {
  editor: EditorLike
  ready: boolean
  selectedShapes: AnyCanvasShape[]
  generationOpen: boolean
}

export function CanvasStylePanel({ editor, ready, selectedShapes, generationOpen }: CanvasStylePanelProps) {
  const [colorTarget, setColorTarget] = useState<'fill' | 'stroke'>('stroke')
  const [pinned, setPinned] = useState(() => {
    try { return window.localStorage.getItem('coart.stylePanelPinned') === 'true' } catch { return false }
  })
  useEffect(() => {
    try { window.localStorage.setItem('coart.stylePanelPinned', String(pinned)) } catch { /* local UI preference only */ }
  }, [pinned])

  if (!selectedShapes.length || (generationOpen && !pinned)) return null
  const disabled = !ready
  const fills = selectedShapes.map((shape) => String(shape.props.fill || 'transparent'))
  const strokes = selectedShapes.map((shape) => String(shape.props.stroke || '#2563eb'))
  const strokeStyles = selectedShapes.map((shape) => String(shape.props.strokeStyle || (shape.type === 'frame' || shape.type === 'coart-html' ? 'dashed' : 'solid')) as CanvasStrokeStyle)
  const strokeWidths = selectedShapes.map((shape) => Number(shape.props.strokeWidth || 3))
  const opacities = selectedShapes.map((shape) => Math.round(Number(shape.opacity ?? 1) * 100))
  const fill = mixedValue(fills)
  const stroke = mixedValue(strokes)
  const strokeStyle = mixedValue(strokeStyles)
  const strokeWidth = mixedValue(strokeWidths)
  const opacity = mixedValue(opacities)
  const activeColor = colorTarget === 'fill' ? fill : stroke

  return (
    <aside className={`coart-style-panel${pinned ? ' is-pinned' : ''}`} aria-label="物件樣式">
      <header>
        <div>
          <strong>樣式</strong>
          <span>{selectedShapes.length === 1 ? '單一物件' : `${selectedShapes.length} 個物件 · 共同屬性`}</span>
        </div>
        <div className="coart-style-target" role="group" aria-label="顏色套用位置">
          <button className={colorTarget === 'fill' ? 'active' : ''} onClick={() => setColorTarget('fill')} title="填色"><PaintBucket size={15} /></button>
          <button className={colorTarget === 'stroke' ? 'active' : ''} onClick={() => setColorTarget('stroke')} title="線條"><PencilLine size={15} /></button>
          <button className={pinned ? 'active' : ''} onClick={() => setPinned((value) => !value)} title={pinned ? '取消固定' : '固定面板'}>{pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
        </div>
      </header>

      <div className="coart-swatches" role="group" aria-label="顏色">
        {SWATCHES.map((color) => (
          <button
            key={color}
            disabled={disabled}
            className={activeColor === color ? 'active' : ''}
            onClick={() => editor.updateSelectedStyles({ [colorTarget]: color })}
            title={color}
            aria-label={`使用顏色 ${color}`}
          ><span style={{ backgroundColor: color }} /></button>
        ))}
      </div>

      <label className="coart-opacity">
        <span>不透明度</span>
        <input
          disabled={disabled}
          type="range"
          min="10"
          max="100"
          step="5"
          value={opacity === 'mixed' ? 100 : opacity}
          aria-valuetext={opacity === 'mixed' ? '混合值' : `${opacity}%`}
          onChange={(event) => editor.updateSelectedStyles({ opacity: Number(event.target.value) / 100 })}
        />
        <output>{opacity === 'mixed' ? '—' : `${opacity}%`}</output>
      </label>

      <div className="coart-style-section">
        <span className="coart-style-label">填色 {fill === 'mixed' && '—'}</span>
        <div className="coart-style-options" role="group" aria-label="填色模式">
          <button disabled={disabled} className={fill === 'transparent' ? 'active' : ''} onClick={() => editor.updateSelectedStyles({ fill: 'transparent' })} title="透明"><Ban size={17} /></button>
          <button disabled={disabled} className={fill === '#ffffff' ? 'active' : ''} onClick={() => editor.updateSelectedStyles({ fill: '#ffffff' })} title="白色"><span className="coart-fill-sample is-white" /></button>
          <button disabled={disabled} className={fill !== 'mixed' && fill !== 'transparent' && fill !== '#ffffff' ? 'active' : ''} onClick={() => editor.updateSelectedStyles({ fill: stroke === 'mixed' ? '#2563eb' : stroke })} title="使用線條顏色"><span className="coart-fill-sample" style={{ backgroundColor: stroke === 'mixed' ? '#98a2b3' : stroke }} /></button>
        </div>
      </div>

      <div className="coart-style-section">
        <span className="coart-style-label">線條 {strokeStyle === 'mixed' && '—'}</span>
        <div className="coart-style-options" role="group" aria-label="線條樣式">
          {(['solid', 'dashed', 'dotted', 'none'] as CanvasStrokeStyle[]).map((style) => (
            <button key={style} disabled={disabled} className={strokeStyle === style ? 'active' : ''} onClick={() => editor.updateSelectedStyles({ strokeStyle: style })} title={style}>
              {style === 'none' ? <Circle size={18} /> : <span className={`coart-line-sample is-${style}`} />}
            </button>
          ))}
        </div>
      </div>

      <div className="coart-style-section">
        <span className="coart-style-label">粗細 {strokeWidth === 'mixed' && '—'}</span>
        <div className="coart-size-options" role="group" aria-label="線條粗細">
          {STROKE_SIZES.map((size) => (
            <button key={size.label} disabled={disabled} className={strokeWidth === size.value ? 'active' : ''} onClick={() => editor.updateSelectedStyles({ strokeWidth: size.value })}>{size.label}</button>
          ))}
        </div>
      </div>
    </aside>
  )
}
