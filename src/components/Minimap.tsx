import { useEffect, useState } from 'react'
import type { EditorLike } from '../types'

interface MinimapProps { editor: EditorLike }

export function Minimap({ editor }: MinimapProps) {
  const [, setRevision] = useState(0)
  useEffect(() => editor.onChange(() => setRevision((value) => value + 1)), [editor])
  const shapes = editor.getCurrentPageShapes()
  const camera = editor.getCamera()
  const viewport = editor.getViewportPageBounds()
  const bounds = shapes.reduce((result, shape) => ({
    left: Math.min(result.left, Number(shape.x || 0)),
    top: Math.min(result.top, Number(shape.y || 0)),
    right: Math.max(result.right, Number(shape.x || 0) + Number(shape.props.w || 1)),
    bottom: Math.max(result.bottom, Number(shape.y || 0) + Number(shape.props.h || 1))
  }), { left: 0, top: 0, right: 1280, bottom: 720 })
  const width = Math.max(1, bounds.right - bounds.left)
  const height = Math.max(1, bounds.bottom - bounds.top)
  const toX = (value: number) => (value - bounds.left) / width * 160
  const toY = (value: number) => (value - bounds.top) / height * 96
  return (
    <svg className="coart-minimap" viewBox="0 0 160 96" aria-label="小地圖" onPointerDown={(event) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const worldX = bounds.left + (event.clientX - rect.left) / rect.width * width
      const worldY = bounds.top + (event.clientY - rect.top) / rect.height * height
      const screenWidth = viewport.w * camera.z
      const screenHeight = viewport.h * camera.z
      editor.setCamera({ ...camera, x: screenWidth / 2 - worldX * camera.z, y: screenHeight / 2 - worldY * camera.z })
    }}>
      {shapes.map((shape) => <rect key={shape.id} x={toX(Number(shape.x || 0))} y={toY(Number(shape.y || 0))} width={Math.max(1, Number(shape.props.w || 1) / width * 160)} height={Math.max(1, Number(shape.props.h || 1) / height * 96)} />)}
      <rect className="coart-minimap-viewport" x={toX(viewport.x)} y={toY(viewport.y)} width={viewport.w / width * 160} height={viewport.h / height * 96} />
    </svg>
  )
}
