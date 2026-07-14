export const COART_KINDS = {
  AI_IMAGE: 'ai-image',
  AI_HTML: 'ai-html',
  SLIDES: 'slides'
}

export const ASPECT_PRESETS = [
  { id: '1:1', width: 512, height: 512 },
  { id: '4:3', width: 683, height: 512 },
  { id: '3:4', width: 512, height: 683 },
  { id: '16:9', width: 1024, height: 576 },
  { id: '9:16', width: 512, height: 910 }
]

export const DEFAULT_HTML_SIZE = { width: 1024, height: 576 }
export const DEFAULT_SLIDES_SIZE = { width: 1048, height: 600 }
export const SAVE_DEBOUNCE_MS = 700
