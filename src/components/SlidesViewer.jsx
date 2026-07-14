import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'

export function SlidesViewer({ slides, onClose }) {
  const [index, setIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
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
            <button key={item.id} className={itemIndex === index ? 'active' : ''} onClick={() => setIndex(itemIndex)}>
              <span>{itemIndex + 1}</span>
              <iframe title={`縮圖 ${itemIndex + 1}`} srcDoc={item.props.html} sandbox="" tabIndex="-1" />
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
