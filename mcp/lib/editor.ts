import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { standaloneWidgetHtml } from './widget.ts'
import {
  readCanvasState,
  saveCanvasSnapshot,
  writeFollowUpRequest,
  writeAsset,
  writeSelection,
  writeViewState
} from './storage.ts'
import { resolveCoartPaths } from './safety.ts'

const EDITOR_HOST = '127.0.0.1'
const MAX_BODY_BYTES = 64 * 1024 * 1024
const TOKEN_HEADER = 'x-coart-editor-token'

interface EditorSession {
  projectDir: string
  canvasDir: string
  token: string
  port: number
  server: Server
}

export interface CoartEditorServerHandle {
  baseUrl: string
  projectDir: string
  canvasDir: string
  token: string
  close: () => Promise<void>
}

export interface OpenCoartEditorResult {
  ok: boolean
  editorUrl: string
  projectDir: string
  canvasDir: string
  opened: boolean
  windowMode: 'app' | 'browser' | 'manual'
  browserPath?: string
  message: string
}

const sessions = new Map<string, Promise<EditorSession>>()

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(payload))
}

function sendText(response: ServerResponse, status: number, text: string, contentType: string) {
  response.statusCode = status
  response.setHeader('Content-Type', contentType)
  response.setHeader('Cache-Control', 'no-store')
  response.end(text)
}

function tokenFor(request: IncomingMessage, url: URL) {
  const header = request.headers[TOKEN_HEADER]
  if (typeof header === 'string' && header) return header
  return url.searchParams.get('token') || ''
}

function isAuthorized(session: EditorSession, request: IncomingMessage, url: URL) {
  return tokenFor(request, url) === session.token
}

async function readJsonBody(request: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new Error(`Editor request exceeds ${MAX_BODY_BYTES} bytes.`)
    chunks.push(buffer)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function methodNotAllowed(response: ServerResponse) {
  sendJson(response, 405, { ok: false, error: 'Method not allowed.' })
}

async function handleRequest(session: EditorSession, request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url || '/', `http://${EDITOR_HOST}`)

  if (url.pathname === '/health') {
    sendJson(response, 200, { ok: true, service: 'coart-editor' })
    return
  }

  if (!isAuthorized(session, request, url)) {
    sendJson(response, 401, { ok: false, error: 'Invalid Coart editor token.' })
    return
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    if (request.method !== 'GET') {
      methodNotAllowed(response)
      return
    }
    sendText(response, 200, await standaloneWidgetHtml(), 'text/html; charset=utf-8')
    return
  }

  if (!url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { ok: false, error: 'Not found.' })
    return
  }

  if (url.pathname === '/api/state') {
    if (request.method === 'GET') {
      sendJson(response, 200, await readCanvasState({ projectDir: session.projectDir }, { hydrateAssets: true }))
      return
    }
    if (request.method === 'POST') {
      const body = await readJsonBody(request)
      if (!body?.snapshot) throw new Error('snapshot is required.')
      sendJson(response, 200, await saveCanvasSnapshot({ projectDir: session.projectDir }, body.snapshot))
      return
    }
    methodNotAllowed(response)
    return
  }

  if (url.pathname === '/api/selection' && request.method === 'POST') {
    const body = await readJsonBody(request)
    sendJson(response, 200, await writeSelection({ projectDir: session.projectDir }, body?.selection))
    return
  }

  if (url.pathname === '/api/view' && request.method === 'POST') {
    const body = await readJsonBody(request)
    sendJson(response, 200, await writeViewState({ projectDir: session.projectDir }, body?.viewState))
    return
  }

  if (url.pathname === '/api/reference' && request.method === 'POST') {
    const body = await readJsonBody(request)
    sendJson(response, 200, await writeAsset({ projectDir: session.projectDir }, body))
    return
  }

  if (url.pathname === '/api/follow-up' && request.method === 'POST') {
    const body = await readJsonBody(request)
    sendJson(response, 200, await writeFollowUpRequest({ projectDir: session.projectDir }, body))
    return
  }

  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { ok: false, error: 'Unknown Coart editor API route.' })
    return
  }

  sendJson(response, 404, { ok: false, error: 'Not found.' })
}

async function startSession(projectDir: string, canvasDir: string): Promise<EditorSession> {
  await standaloneWidgetHtml()
  const token = randomBytes(24).toString('hex')
  const server = createServer((request, response) => {
    void handleRequest({ projectDir, canvasDir, token, port: 0, server }, request, response).catch((error: unknown) => {
      const status = error instanceof Error && error.message.startsWith('Editor request exceeds') ? 413 : 500
      if (!response.headersSent) sendJson(response, status, { ok: false, error: error instanceof Error ? error.message : String(error) })
      else response.destroy()
    })
  })

  await new Promise<void>((resolvePromise, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolvePromise()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(0, EDITOR_HOST)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    await closeServer(server)
    throw new Error('Coart editor server did not expose a TCP port.')
  }
  const session = { projectDir, canvasDir, token, port: address.port, server }
  return session
}

async function getSession(projectDir: string, canvasDir: string): Promise<EditorSession> {
  const existing = sessions.get(projectDir)
  if (existing) return existing
  const pending = startSession(projectDir, canvasDir)
  sessions.set(projectDir, pending)
  try {
    return await pending
  } catch (error) {
    sessions.delete(projectDir)
    throw error
  }
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()))
}

export async function startCoartEditorServer(projectDir: string): Promise<CoartEditorServerHandle> {
  const paths = resolveCoartPaths({ projectDir })
  const session = await getSession(paths.projectDir, paths.canvasDir)
  return {
    baseUrl: `http://${EDITOR_HOST}:${session.port}`,
    projectDir: session.projectDir,
    canvasDir: session.canvasDir,
    token: session.token,
    close: async () => {
      sessions.delete(session.projectDir)
      await closeServer(session.server)
    }
  }
}

function browserCandidates() {
  if (process.env.COART_EDITOR_BROWSER) return [process.env.COART_EDITOR_BROWSER]
  if (process.platform !== 'win32') return []
  const roots = [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']].filter(Boolean) as string[]
  const relativePaths = [
    ['Google', 'Chrome', 'Application', 'chrome.exe'],
    ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
    ['BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe']
  ]
  return roots.flatMap((root) => relativePaths.map((parts) => join(root, ...parts)))
}

function launchBrowser(editorUrl: string): Pick<OpenCoartEditorResult, 'opened' | 'windowMode' | 'browserPath'> {
  const browserPath = browserCandidates().find((candidate) => candidate && existsSync(candidate))
  if (browserPath) {
    const child = spawn(browserPath, [`--app=${editorUrl}`], { detached: true, stdio: 'ignore' })
    child.unref()
    return { opened: true, windowMode: 'app', browserPath }
  }

  if (process.platform === 'win32') {
    const child = spawn('explorer.exe', [editorUrl], { detached: true, stdio: 'ignore' })
    child.unref()
    return { opened: true, windowMode: 'browser' }
  }

  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
  const child = spawn(opener, [editorUrl], { detached: true, stdio: 'ignore' })
  child.unref()
  return { opened: true, windowMode: 'browser' }
}

export async function openCoartEditor(args: { projectDir?: string } = {}): Promise<OpenCoartEditorResult> {
  const paths = resolveCoartPaths(args)
  const session = await getSession(paths.projectDir, paths.canvasDir)
  const editorUrl = new URL('/', `http://${EDITOR_HOST}:${session.port}`)
  editorUrl.searchParams.set('coartMode', 'external')
  editorUrl.searchParams.set('projectDir', session.projectDir)
  editorUrl.searchParams.set('token', session.token)
  const launch = launchBrowser(editorUrl.toString())
  return {
    ok: true,
    editorUrl: editorUrl.toString(),
    projectDir: session.projectDir,
    canvasDir: session.canvasDir,
    ...launch,
    message: launch.windowMode === 'app'
      ? 'Opened Coart in a separate app window. Return to the same Codex conversation after editing.'
      : 'Opened Coart in a browser window. Return to the same Codex conversation after editing.'
  }
}

export async function closeCoartEditorServers(): Promise<void> {
  const active = [...sessions.values()]
  sessions.clear()
  for (const pending of active) {
    const session = await pending
    await closeServer(session.server)
  }
}
