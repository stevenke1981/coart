import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { widgetHtml } from '../mcp/lib/widget.ts'

function browserCandidates() {
  const configured = process.env.COART_CHROME || process.env.CHROME_PATH
  const windows = process.platform === 'win32'
    ? [
        join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
        join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
        join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe')
      ]
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  return [...new Set([configured, ...windows].filter(Boolean))]
}

function runBrowser(executable: string, url: string, userDataDir: string, screenshotPath: string): Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--virtual-time-budget=15000',
      `--user-data-dir=${userDataDir}`,
      `--screenshot=${screenshotPath}`,
      '--dump-dom',
      url
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error('Browser widget smoke timed out after 45 seconds.'))
    }, 45_000)
    child.stdout.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      resolve({ code, signal, stdout, stderr })
    })
  })
}

const executable = browserCandidates().find((candidate) => existsSync(candidate))
if (!executable) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'No Chrome/Chromium executable found.' }))
} else {
  const baseHtml = await widgetHtml()
  const canvasProbe = `<script>setTimeout(() => { const scene = document.querySelector('.coart-ferric-scene'); const svg = scene?.querySelector('svg'); const shell = document.querySelector('.coart-ferric-shell'); const rectangleTool = document.querySelector('[data-coart-tool="rectangle"]'); const textTool = document.querySelector('[data-coart-tool="text"]'); const ready = Boolean(scene && svg && shell && rectangleTool && textTool && Number(svg.getAttribute('width')) > 0 && shell.clientHeight >= 640); document.documentElement.setAttribute('data-coart-ferric-mounted', String(ready)); }, 1500)</script>`
  const bodyClose = baseHtml.lastIndexOf('</body>')
  if (bodyClose < 0) throw new Error('Widget HTML is missing its outer closing body tag.')
  const html = `${baseHtml.slice(0, bodyClose)}${canvasProbe}${baseHtml.slice(bodyClose)}`
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(html)
  })
  const userDataDir = await mkdtemp(join(tmpdir(), 'coart-widget-smoke-'))
  const screenshotPath = process.env.COART_WIDGET_SCREENSHOT || join(userDataDir, 'widget-after-10s.png')
  try {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const { port } = server.address() as AddressInfo
    const result = await runBrowser(executable, `http://127.0.0.1:${port}/`, userDataDir, screenshotPath)
    if (result.code !== 0) throw new Error(`Browser exited with code ${result.code ?? 'null'}${result.signal ? ` (${result.signal})` : ''}.\n${result.stderr.slice(-2000)}`)
    const { stdout } = result
    const mounted = stdout.includes('<div id="root"><div class="coart-app">')
      && stdout.includes('coart-ferric-shell')
      && stdout.includes('coart-ferric-scene')
      && stdout.includes('data-coart-tool="rectangle"')
      && stdout.includes('data-coart-tool="text"')
      && stdout.includes('data-coart-ferric-mounted="true"')
    if (!mounted) throw new Error('Widget loader did not mount the React/Ferric canvas in Chromium.')
    if (stdout.includes('data-coart-loader')) throw new Error('Compressed loader marker remained after document hydration.')
    const screenshotBytes = (await stat(screenshotPath)).size
    if (screenshotBytes < 1_000) throw new Error('Widget screenshot was not written after the 10-second smoke interval.')
    console.log(JSON.stringify({
      ok: true,
      browser: executable,
      mounted: true,
      canvasReady: true,
      domBytes: Buffer.byteLength(stdout),
      screenshotBytes,
      ...(process.env.COART_WIDGET_SCREENSHOT ? { screenshot: screenshotPath } : {})
    }))
  } finally {
    server.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
}
