import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RESOURCE_MIME_TYPE, registerAppResource } from '@modelcontextprotocol/ext-apps/server'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifest = JSON.parse(readFileSync(join(root, '.codex-plugin', 'plugin.json'), 'utf8'))
export const WIDGET_URI = 'ui://widget/coart/canvas.html'
export const WIDGET_BUILD_DIR = join(tmpdir(), `coart-widget-${manifest.version}`)
let cachedHtml = null
let cachedAppsBundle = null

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const output = []
    const child = spawn(command, args, {
      cwd: options.cwd || root,
      env: { ...process.env, ...(options.env || {}), BROWSER: 'none', FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const capture = (chunk) => output.push(String(chunk))
    child.stdout.on('data', capture)
    child.stderr.on('data', capture)
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`${options.label || command} failed (${code}).\n${output.slice(-80).join('')}`)))
  })
}

async function ensureBuild() {
  if (existsSync(join(WIDGET_BUILD_DIR, 'index.html'))) return
  const vite = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite')
  if (!existsSync(vite)) {
    await run(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm', 'install']
      : ['install'], { label: 'npm install' })
  }
  await run(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', WIDGET_BUILD_DIR, '--emptyOutDir'], {
    env: { COART_WIDGET_BUILD: '1' },
    label: 'Coart widget build'
  })
}

async function inlineBuild() {
  await ensureBuild()
  let html = await readFile(join(WIDGET_BUILD_DIR, 'index.html'), 'utf8')
  html = html.replace(/<link\s+rel="modulepreload"[^>]*>\s*/g, '')
  html = await replaceAsync(html, /<link\s+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g, async (_all, href) => {
    const css = await readFile(join(WIDGET_BUILD_DIR, href.replace(/^\//, '')), 'utf8')
    return `<style>${css.replaceAll('</style', '<\\/style')}</style>`
  })
  html = await replaceAsync(html, /<script\s+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/g, async (_all, src) => {
    const js = await readFile(join(WIDGET_BUILD_DIR, src.replace(/^\//, '')), 'utf8')
    return `<script>(()=>{${js.replaceAll('</script', '<\\/script')}})();</script>`
  })
  const assetsDir = join(WIDGET_BUILD_DIR, 'assets')
  if (existsSync(assetsDir)) {
    const leftovers = (await readdir(assetsDir)).filter((name) => html.includes(`/assets/${name}`))
    if (leftovers.length) throw new Error(`Widget contains non-inlined assets: ${leftovers.join(', ')}`)
  }
  return html
}

function appsBundle() {
  if (cachedAppsBundle) return cachedAppsBundle
  const source = readFileSync(require.resolve('@modelcontextprotocol/ext-apps/app-with-deps'), 'utf8')
  const exportIndex = source.lastIndexOf('export{')
  if (exportIndex < 0) throw new Error('Unable to expose MCP Apps browser exports.')
  const block = source.slice(exportIndex).match(/^export\{([^}]+)\};?\s*$/s)
  if (!block) throw new Error('Unable to parse MCP Apps browser exports.')
  const map = new Map()
  for (const raw of block[1].split(',')) {
    const [local, exported = local] = raw.trim().split(/\s+as\s+/)
    if (local) map.set(exported, local)
  }
  const names = ['App', 'applyDocumentTheme', 'applyHostFonts', 'applyHostStyleVariables']
  for (const name of names) {
    if (!map.has(name)) throw new Error(`Missing MCP Apps browser export: ${name}`)
  }
  cachedAppsBundle = `${source.slice(0, exportIndex)};globalThis.__COART_EXT_APPS__={${names.map((name) => `${JSON.stringify(name)}:${map.get(name)}`).join(',')}};`
  return cachedAppsBundle
}

function bridgeScript() {
  return `(() => {
    const ext = globalThis.__COART_EXT_APPS__;
    if (!ext?.App) return;
    let app;
    let ready = Promise.resolve();
    const publish = (values) => {
      window.openai = Object.assign(window.openai || {}, values || {});
      window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: window.openai } }));
    };
    const contextChanged = (context) => {
      try {
        if (context?.theme) ext.applyDocumentTheme?.(context.theme);
        if (context?.styles?.variables) ext.applyHostStyleVariables?.(context.styles.variables);
        if (context?.styles?.css?.fonts) ext.applyHostFonts?.(context.styles.css.fonts);
      } catch (_) {}
      publish({ hostContext: context, displayMode: context?.displayMode, widgetInstanceId: context?.widgetInstanceId || context?.widgetId });
    };
    const install = () => {
      window.coartMcp = {
        callServerTool: async (request, options) => { await ready; return app.callServerTool(request, options); },
        sendFollowUpMessage: async (message) => {
          await ready;
          return app.sendMessage({ role: 'user', content: [{ type: 'text', text: String(message?.prompt || message || '') }] });
        },
        requestDisplayMode: async (mode) => { await ready; return app.requestDisplayMode(typeof mode === 'string' ? { mode } : mode); },
        getHostCapabilities: () => app.getHostCapabilities?.()
      };
    };
    const toolResult = (result) => {
      const metadata = result?._meta || {};
      const payload = metadata.widgetData || result?.structuredContent || result || {};
      publish({ rawToolResult: result, toolOutput: payload, toolResponseMetadata: metadata });
      if (payload.preferredDisplayMode && app?.requestDisplayMode) {
        app.requestDisplayMode({ mode: payload.preferredDisplayMode }).catch(() => {});
      }
    };
    app = new ext.App({ name: 'coart', version: '${manifest.version}' }, { availableDisplayModes: ['inline', 'fullscreen'] }, { autoResize: true });
    install();
    app.addEventListener('hostcontextchanged', contextChanged);
    app.addEventListener('toolresult', toolResult);
    window.addEventListener('message', (event) => {
      const result = event.data?.params?.result;
      if (event.data?.method === 'ui/notifications/tool-result' && result) toolResult(result);
    });
    ready = app.connect().then(() => {
      install();
      contextChanged(app.getHostContext?.());
      publish({ hostCapabilities: app.getHostCapabilities?.(), hostInfo: app.getHostVersion?.() });
    }).catch((error) => {
      globalThis.__COART_BRIDGE_ERROR__ = error;
      throw error;
    });
  })();`
}

export async function widgetHtml() {
  if (cachedHtml) return cachedHtml
  const base = await inlineBuild()
  const injected = `<script>${appsBundle().replaceAll('</script', '<\\/script')}</script><script>${bridgeScript().replaceAll('</script', '<\\/script')}</script>`
  // Use a replacement function: minified bundles can contain `$&`, `$`` or `$'`,
  // which String#replace interprets when a replacement string is supplied.
  cachedHtml = base.includes('</head>') ? base.replace('</head>', () => `${injected}</head>`) : `${injected}${base}`
  return cachedHtml
}

export function registerCoartWidgetResource(server) {
  const metadata = {
    ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: ['data:', 'blob:'], frameDomains: ['data:', 'blob:'] } },
    'openai/widgetDescription': 'Coart native infinite canvas',
    'openai/widgetPrefersBorder': false,
    'openai/widgetCSP': { connect_domains: [], resource_domains: ['data:', 'blob:'], frame_domains: ['data:', 'blob:'] }
  }
  registerAppResource(server, 'coart-canvas-widget', WIDGET_URI, {
    title: 'Coart Canvas',
    description: 'A tldraw-powered native Codex canvas with project-local persistence.',
    _meta: metadata
  }, async () => ({ contents: [{ uri: WIDGET_URI, mimeType: RESOURCE_MIME_TYPE, text: await widgetHtml(), _meta: metadata }] }))
}

async function replaceAsync(source, pattern, replacer) {
  const matches = Array.from(source.matchAll(pattern))
  let output = ''
  let cursor = 0
  for (const match of matches) {
    output += source.slice(cursor, match.index)
    output += await replacer(...match)
    cursor = match.index + match[0].length
  }
  return output + source.slice(cursor)
}
