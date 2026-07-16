import type { AnyCanvasShape } from '../types'

export type ContextToolbarMode = 'shape' | 'text' | 'image' | 'ai-image' | 'ai-html' | 'slides' | 'mixed'

export function contextToolbarMode(shapes: AnyCanvasShape[]): ContextToolbarMode | null {
  if (!shapes.length) return null
  if (shapes.length > 1) return 'mixed'
  const shape = shapes[0]
  if (shape.meta?.coartKind === 'ai-image') return 'ai-image'
  if (shape.meta?.coartKind === 'ai-html' || shape.type === 'coart-html') return 'ai-html'
  if (shape.meta?.coartKind === 'slides') return 'slides'
  if (shape.type === 'text') return 'text'
  if (shape.type === 'image') return 'image'
  return 'shape'
}
