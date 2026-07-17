import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import type { CoartHtmlShape } from '../types'

interface SlidesViewerProps {
  slides: CoartHtmlShape[]
  onClose: () => void
  onReorder?: (slides: CoartHtmlShape[]) => void
}

export function SlidesViewer({ slides, onClose, onReorder }: SlidesViewerProps) {
  const [index, setIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' || event.key === ' ') setIndex((value) => Math.min(slides.length - 1, value + 1))
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, slides.length])

  if (!slides.length) return null
  const slide = slides[index]

  return (
    <div className={`coart-slides-viewer ${fullscreen ? 'is-fullscreen' : ''}`}>
      <div className="coart-slides-bar">
        <strong>Coart Slides</strong>
        <span>{index + 1} / {slides.length}</span>
        <button onClick={() => setFullscreen(!fullscreen)}><Maximize2 size={17} /></button>
        <button onClick={onClose}><X size={18} /></button>
      </div>
      <div className="coart-slides-body">
        <nav>
          {slides.map((item, itemIndex) => (
            <button key={item.id} className={itemIndex === index ? 'active' : ''} draggable onDragStart={() => setDragIndex(itemIndex)} onDragOver={(event) => event.preventDefault()} onDrop={() => {
              if (dragIndex === null || dragIndex === itemIndex) return
              const next = [...slides]
              const [moved] = next.splice(dragIndex, 1)
              next.splice(itemIndex, 0, moved)
              setDragIndex(null)
              setIndex(itemIndex)
              onReorder?.(next)
            }} onClick={() => setIndex(itemIndex)}>
              <span>{itemIndex + 1}</span>
              <iframe title={`縮圖 ${itemIndex + 1}`} srcDoc={item.props.html} sandbox="" tabIndex={-1} />
            </button>
          ))}
        </nav>
        <main>
          <iframe title={slide.props.title || `Slide ${index + 1}`} srcDoc={slide.props.html} sandbox="allow-scripts allow-forms allow-modals allow-popups" />
          <button className="coart-slide-prev" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}><ChevronLeft /></button>
          <button className="coart-slide-next" onClick={() => setIndex(Math.min(slides.length - 1, index + 1))} disabled={index === slides.length - 1}><ChevronRight /></button>
        </main>
      </div>
    </div>
  )
}
