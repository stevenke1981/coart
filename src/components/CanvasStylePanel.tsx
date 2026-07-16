import { Ban, Circle, PaintBucket, PencilLine } from 'lucide-react'
import { useState } from 'react'
import type { AnyCanvasShape, CanvasStrokeStyle, EditorLike } from '../types'

const SWATCHES = [
  '#202124', '#98a2b3', '#d976e8', '#9b3ad2',
  '#4263eb', '#3d9be9', '#f3a83b', '#e65f12',
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
  selectedShape: AnyCanvasShape | null
}

export function CanvasStylePanel({ editor, ready, selectedShape }: CanvasStylePanelProps) {
  const [colorTarget, setColorTarget] = useState<'fill' | 'stroke'>('stroke')
  const disabled = !ready || !selectedShape
  const fill = String(selectedShape?.props.fill || 'transparent')
  const stroke = String(selectedShape?.props.stroke || '#6d5ef7')
  const defaultStrokeStyle = selectedShape?.type === 'frame' || selectedShape?.type === 'coart-html' ? 'dashed' : 'solid'
  const strokeStyle = String(selectedShape?.props.strokeStyle || defaultStrokeStyle) as CanvasStrokeStyle
  const strokeWidth = Number(selectedShape?.props.strokeWidth || 3)
  const opacity = Math.round(Number(selectedShape?.opacity ?? 1) * 100)

  return (
    <aside className={`coart-style-panel${disabled ? ' is-disabled' : ''}`} aria-label="物件樣式">
      <header>
        <div>
          <strong>樣式</strong>
          <span>{selectedShape ? '套用至選取物件' : '請先選取物件'}</span>
        </div>
        <div className="coart-style-target" role="group" aria-label="顏色套用位置">
          <button className={colorTarget === 'fill' ? 'active' : ''} onClick={() => setColorTarget('fill')} title="填色"><PaintBucket size={15} /></button>
          <button className={colorTarget === 'stroke' ? 'active' : ''} onClick={() => setColorTarget('stroke')} title="線條"><PencilLine size={15} /></button>
        </div>
      </header>

      <div className="coart-swatches" role="group" aria-label="顏色">
        {SWATCHES.map((color) => (
          <button
            key={color}
            disabled={disabled}
            className={(colorTarget === 'fill' ? fill : stroke) === color ? 'active' : ''}
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
          value={opacity}
          onChange={(event) => editor.updateSelectedStyles({ opacity: Number(event.target.value) / 100 })}
        />
        <output>{opacity}%</output>
      </label>

      <div className="coart-style-section">
        <span className="coart-style-label">填色</span>
        <div className="coart-style-options" role="group" aria-label="填色模式">
          <button disabled={disabled} className={fill === 'transparent' ? 'active' : ''} onClick={() => editor.updateSelectedStyles({ fill: 'transparent' })} title="透明"><Ban size={17} /></button>
          <button disabled={disabled} className={fill === '#ffffff' ? 'active' : ''} onClick={() => editor.updateSelectedStyles({ fill: '#ffffff' })} title="白色"><span className="coart-fill-sample is-white" /></button>
          <button disabled={disabled} className={fill !== 'transparent' && fill !== '#ffffff' ? 'active' : ''} onClick={() => editor.updateSelectedStyles({ fill: stroke })} title="使用線條顏色"><span className="coart-fill-sample" style={{ backgroundColor: stroke }} /></button>
        </div>
      </div>

      <div className="coart-style-section">
        <span className="coart-style-label">線條</span>
        <div className="coart-style-options" role="group" aria-label="線條樣式">
          {(['solid', 'dashed', 'dotted', 'none'] as CanvasStrokeStyle[]).map((style) => (
            <button key={style} disabled={disabled} className={strokeStyle === style ? 'active' : ''} onClick={() => editor.updateSelectedStyles({ strokeStyle: style })} title={style}>
              {style === 'none' ? <Circle size={18} /> : <span className={`coart-line-sample is-${style}`} />}
            </button>
          ))}
        </div>
      </div>

      <div className="coart-style-section">
        <span className="coart-style-label">粗細</span>
        <div className="coart-size-options" role="group" aria-label="線條粗細">
          {STROKE_SIZES.map((size) => (
            <button key={size.label} disabled={disabled} className={strokeWidth === size.value ? 'active' : ''} onClick={() => editor.updateSelectedStyles({ strokeWidth: size.value })}>{size.label}</button>
          ))}
        </div>
      </div>
    </aside>
  )
}
