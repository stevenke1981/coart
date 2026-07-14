import { useEffect, useRef } from 'react'
import { Canvas } from 'fabric'
import { CoartFabricEditor } from '../lib/fabricCanvas'
import type { EditorLike } from '../types'

interface FabricCanvasProps {
  onReady: (editor: EditorLike | null) => void
}

export function FabricCanvas({ onReady }: FabricCanvasProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const shell = shellRef.current
    const element = canvasRef.current
    if (!shell || !element) return undefined

    const fabricCanvas = new Canvas(element, {
      backgroundColor: '#f7f7fb',
      preserveObjectStacking: true,
      selection: true,
      stopContextMenu: true,
      uniformScaling: false
    })
    const editor = new CoartFabricEditor(fabricCanvas)
    let isPanning = false
    let lastPointer: { x: number; y: number } | null = null

    const resize = () => {
      const rect = shell.getBoundingClientRect()
      fabricCanvas.setDimensions({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(640, Math.floor(rect.height))
      })
      fabricCanvas.requestRenderAll()
    }

    const onWheel = (event: { e: WheelEvent }) => {
      event.e.preventDefault()
      event.e.stopPropagation()
      const rect = element.getBoundingClientRect()
      editor.zoomAt({ x: event.e.clientX - rect.left, y: event.e.clientY - rect.top }, event.e.deltaY)
    }
    const onMouseDown = (event: { e: MouseEvent }) => {
      if (event.e.altKey || event.e.button === 1) {
        isPanning = true
        lastPointer = { x: event.e.clientX, y: event.e.clientY }
        fabricCanvas.selection = false
        fabricCanvas.defaultCursor = 'grabbing'
      }
    }
    const onMouseMove = (event: { e: MouseEvent }) => {
      if (!isPanning || !lastPointer) return
      editor.panBy(event.e.clientX - lastPointer.x, event.e.clientY - lastPointer.y)
      lastPointer = { x: event.e.clientX, y: event.e.clientY }
    }
    const stopPanning = () => {
      if (!isPanning) return
      isPanning = false
      lastPointer = null
      fabricCanvas.selection = true
      fabricCanvas.defaultCursor = 'default'
    }

    fabricCanvas.on('mouse:wheel', onWheel as never)
    fabricCanvas.on('mouse:down', onMouseDown as never)
    fabricCanvas.on('mouse:move', onMouseMove as never)
    fabricCanvas.on('mouse:up', stopPanning as never)
    window.addEventListener('resize', resize)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(shell)
    resize()
    onReady(editor)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      editor.dispose()
      onReady(null)
    }
  }, [onReady])

  return (
    <div ref={shellRef} className="coart-fabric-shell" aria-label="Coart Fabric.js canvas">
      <canvas ref={canvasRef} className="coart-fabric-canvas" />
    </div>
  )
}
