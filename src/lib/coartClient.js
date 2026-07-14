const LOCAL_KEY = 'coart:canvas:v1'
const LOCAL_VIEW_KEY = 'coart:view:v1'
const LOCAL_SELECTION_KEY = 'coart:selection:v1'
const PAYLOAD_TIMEOUT_MS = 5000

export const IS_WIDGET_BUILD = typeof __COART_WIDGET_BUILD__ !== 'undefined' && __COART_WIDGET_BUILD__

export function hasCoartBridge() {
  return Boolean(window.coartMcp && typeof window.coartMcp.callServerTool === 'function')
}

function toolPayload() {
  return window.openai?.toolOutput && typeof window.openai.toolOutput === 'object'
    ? window.openai.toolOutput
    : {}
}

function withTarget(extra = {}) {
  const payload = toolPayload()
  return Object.fromEntries(Object.entries({
    projectDir: payload.projectDir,
    canvasDir: payload.canvasDir,
    ...extra
  }).filter(([, value]) => value !== undefined))
}

async function waitForTarget() {
  if (!hasCoartBridge()) return
  const current = toolPayload()
  if (current.projectDir || current.canvasDir) return

  await new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Coart 尚未取得 projectDir/canvasDir，已拒絕無目標的檔案操作。'))
    }, PAYLOAD_TIMEOUT_MS)
    const onGlobals = () => {
      const next = toolPayload()
      if (next.projectDir || next.canvasDir) {
        cleanup()
        resolve()
      }
    }
    const cleanup = () => {
      window.clearTimeout(timer)
      window.removeEventListener('openai:set_globals', onGlobals)
    }
    window.addEventListener('openai:set_globals', onGlobals)
  })
}

async function callTool(name, args = {}) {
  await waitForTarget()
  const result = await window.coartMcp.callServerTool({ name, arguments: withTarget(args) })
  if (result?.isError) {
    const text = result.content?.find((item) => item.type === 'text')?.text
    throw new Error(text || `Coart MCP tool failed: ${name}`)
  }
  return result?.structuredContent ?? result
}

export async function loadCanvasState() {
  if (hasCoartBridge()) return callTool('get_coart_canvas_state', { hydrateAssets: true })
  return {
    snapshot: JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'),
    viewState: JSON.parse(localStorage.getItem(LOCAL_VIEW_KEY) || 'null'),
    storage: 'localStorage'
  }
}

export async function saveCanvasState(snapshot) {
  if (hasCoartBridge()) return callTool('save_coart_canvas_state', { snapshot })
  localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot))
  return { ok: true, storage: 'localStorage' }
}

export async function saveSelection(selection) {
  if (hasCoartBridge()) return callTool('save_coart_selection', { selection })
  localStorage.setItem(LOCAL_SELECTION_KEY, JSON.stringify(selection))
  return { ok: true }
}

export async function saveViewState(viewState) {
  if (hasCoartBridge()) return callTool('save_coart_view_state', { viewState })
  localStorage.setItem(LOCAL_VIEW_KEY, JSON.stringify(viewState))
  return { ok: true }
}

export async function saveReferenceImage(reference) {
  if (hasCoartBridge()) return callTool('save_coart_reference_image', reference)
  return {
    assetPath: reference.fileName || `reference-${Date.now()}.png`,
    assetPathRelativeToProject: reference.fileName || `reference-${Date.now()}.png`,
    dataUrl: reference.dataUrl
  }
}

export async function downloadFile(payload) {
  if (hasCoartBridge()) return callTool('download_coart_file', payload)
  const link = document.createElement('a')
  link.href = payload.dataUrl
  link.download = payload.fileName || 'coart-export.png'
  link.click()
  return { ok: true, fileName: link.download }
}

export async function updateHtmlShape({ shapeId, htmlContent }) {
  if (!hasCoartBridge()) return { ok: true, localOnly: true }
  return callTool('insert_coart_html', {
    shapeId,
    htmlContent,
    updateExisting: true,
    replaceHolder: false
  })
}

export async function sendFollowUpMessage(prompt) {
  if (!window.coartMcp || typeof window.coartMcp.sendFollowUpMessage !== 'function') {
    throw new Error('目前不是 Codex 原生 Widget；本機開發模式只提供畫布與 localStorage。')
  }
  return window.coartMcp.sendFollowUpMessage({ prompt })
}
