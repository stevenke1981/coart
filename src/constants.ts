import type { AspectPreset, ImageResolution } from './types'

export const COART_KINDS = {
  AI_IMAGE: 'ai-image',
  AI_HTML: 'ai-html',
  SLIDES: 'slides'
} as const

export const ASPECT_PRESETS: readonly AspectPreset[] = [
  { id: '4:3', width: 1024, height: 768 },
  { id: '3:4', width: 768, height: 1024 },
  { id: '9:16', width: 576, height: 1024 },
  { id: '16:9', width: 1024, height: 576 },
  { id: '1:1', width: 768, height: 768 }
]

export const IMAGE_RESOLUTION_PRESETS: readonly ImageResolution[] = ['2K', '4K']
export const DEFAULT_IMAGE_RESOLUTION: ImageResolution = '2K'
export const DEFAULT_HTML_SIZE = { width: 1024, height: 576 }
export const DEFAULT_SLIDES_SIZE = { width: 1048, height: 600 }
export const SAVE_DEBOUNCE_MS = 700
