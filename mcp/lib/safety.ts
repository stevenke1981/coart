import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path'

const CANVAS_FILE = 'coart-canvas.json'
const MANIFEST_FILE = 'coart-manifest.json'
const SHARED_FILE = 'coart-shared.json'
const SELECTION_FILE = 'coart-selection.json'
const VIEW_FILE = 'coart-view-state.json'
const FOLLOW_UP_FILE = 'coart-follow-up.json'

export function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function resolveCoartPaths(args: any = {}) {
  const projectDir = resolve(nonEmptyString(args.projectDir) || process.env.COART_PROJECT_DIR || process.cwd())
  const canvasDir = resolve(nonEmptyString(args.canvasDir) || process.env.COART_CANVAS_DIR || join(projectDir, 'canvas'))
  return {
    projectDir,
    canvasDir,
    assetsDir: join(canvasDir, 'assets'),
    pagesDir: join(canvasDir, 'pages'),
    canvasFile: join(canvasDir, CANVAS_FILE),
    manifestFile: join(canvasDir, MANIFEST_FILE),
    sharedFile: join(canvasDir, SHARED_FILE),
    selectionFile: join(canvasDir, SELECTION_FILE),
    viewFile: join(canvasDir, VIEW_FILE),
    followUpFile: join(canvasDir, FOLLOW_UP_FILE)
  }
}

export function isSafeChildPath(parent: string, child: string) {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`))
}

export function sanitizeFileName(value: unknown, fallback = 'asset.bin') {
  const raw = basename(String(value || fallback))
  const extension = extname(raw) || extname(fallback) || '.bin'
  const stem = raw.slice(0, raw.length - extname(raw).length)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
  return `${stem || 'asset'}${extension.toLowerCase()}`
}

export function parseDataUrl(dataUrl: unknown) {
  const match = /^data:([^;,]+)?((?:;[^,]*)?),(.*)$/s.exec(String(dataUrl || ''))
  if (!match) throw new Error('Invalid data URL.')
  const mimeType = match[1] || 'application/octet-stream'
  const params = match[2] || ''
  const payload = match[3] || ''
  const buffer = /;base64(?:;|$)/i.test(params)
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8')
  return { mimeType, buffer }
}
