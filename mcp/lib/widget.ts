import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RESOURCE_MIME_TYPE, registerAppResource } from '@modelcontextprotocol/ext-apps/server'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifest = JSON.parse(readFileSync(join(root, '.codex-plugin', 'plugin.json'), 'utf8'))
export const LEGACY_WIDGET_URIS = ['ui://widget/coart/canvas.html']
export const WIDGET_URI = `ui://widget/coart/canvas-v${manifest.version.replaceAll('.', '-')}.html`

function widgetSourceStamp() {
  const files: string[] = [
    join(root, 'index.html'),
    join(root, 'vite.config.ts'),
    join(root, 'package.json')
  ]
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else files.push(path)
    }
  }
  walk(join(root, 'src'))
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file.slice(root.length))
    hash.update(readFileSync(file))
  }
  return hash.digest('hex').slice(0, 12)
}

// Include the source fingerprint so a same-version local reinstall cannot
// accidentally reuse an older bundle left in the shared temporary directory.
export const WIDGET_BUILD_DIR = join(tmpdir(), `coart-widget-${manifest.version}-${widgetSourceStamp()}`)
export const WIDGET_HTML_GUARD_BYTES = 4 * 1024 * 1024
let cachedHtml: string | null = null
let cachedStandaloneHtml: string | null = null
let cachedAppsBundle: string | null = null

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; label?: string } = {}): Promise<void> {
  return new Promise<void>((resolvePromise, reject) => {
    const output: string[] = []
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
    // Vite emits the module script in <head>. Preserve module timing so React
    // mounts only after the parsed document contains #root, including when the
    // compressed loader reparses the document with document.write().
    return `<script type="module">(()=>{${js.replaceAll('</script', '<\\/script')}})();</script>`
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
        requestDisplayMode: async (request = {}) => {
          await ready;
          if (request?.mode === 'sidebar') {
            publish({ displayModePreference: 'sidebar' });
            return { mode: 'sidebar' };
          }
          const mode = ['fullscreen', 'pip'].includes(request?.mode) ? request.mode : 'inline';
          return app.requestDisplayMode({ mode });
        },
        getHostCapabilities: () => app.getHostCapabilities?.()
      };
    };
    const toolResult = (result) => {
      const metadata = result?._meta || {};
      const payload = metadata.widgetData || result?.structuredContent || result || {};
      const target = payload && typeof payload === 'object' ? payload : {};
      publish({
        rawToolResult: result,
        toolOutput: payload,
        widgetData: payload,
        projectDir: target.projectDir,
        canvasDir: target.canvasDir,
        toolResponseMetadata: metadata
      });
      if (payload.preferredDisplayMode && app?.requestDisplayMode) {
        if (payload.preferredDisplayMode === 'sidebar') {
          publish({ displayModePreference: 'sidebar' });
        } else {
          const mode = ['fullscreen', 'pip'].includes(payload.preferredDisplayMode)
            ? payload.preferredDisplayMode
            : 'inline';
          app.requestDisplayMode({ mode }).catch(() => {});
        }
      }
    };
    // Let the Apps SDK measure the final document after Codex has attached its
    // detached widget surface. A one-shot, fixed height can become stale when
    // the conversation view is restored or its width changes.
    // MCP Apps 1.7 only defines inline/fullscreen/pip. Codex's sidebar is a
    // host-level placement preference carried by the tool result; advertising
    // the non-standard value here makes ui/initialize fail before saving works.
    app = new ext.App({ name: 'coart', version: '${manifest.version}' }, { availableDisplayModes: ['inline'] }, { autoResize: true });
    // MCP Apps hosts send ui/resource-teardown before unmounting a view, for
    // example when the user switches conversations. Register the handler
    // before connect() so the SDK can answer the lifecycle request cleanly.
    app.onteardown = async () => ({});
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

export function decodeWidgetHtml(source: string) {
  return source
}

export async function widgetHtml() {
  if (cachedHtml) return cachedHtml
  const base = await inlineBuild()
  const injected = `<script>${appsBundle().replaceAll('</script', '<\\/script')}</script><script>${bridgeScript().replaceAll('</script', '<\\/script')}</script>`
  // The Fabric.js bundle may contain HTML strings of its own, including `</head>`.
  // Inject into the outer document's final closing head tag, never the first
  // embedded template occurrence.
  const headClose = base.lastIndexOf('</head>')
  const assembled = headClose >= 0
    ? `${base.slice(0, headClose)}${injected}${base.slice(headClose)}`
    : `${injected}${base}`
  const bytes = Buffer.byteLength(assembled)
  if (bytes > WIDGET_HTML_GUARD_BYTES) {
    throw new Error(`Coart Widget exceeds the ${WIDGET_HTML_GUARD_BYTES}-byte inline resource guard (${bytes}).`)
  }
  // Return the final document directly. Rebuilding <head>/<body> at runtime
  // caused Codex Desktop's detached MCP webview to lose its composited surface
  // after first paint, and multiplied peak memory for every restored task.
  cachedHtml = assembled
  return cachedHtml
}

export async function standaloneWidgetHtml() {
  if (cachedStandaloneHtml) return cachedStandaloneHtml
  cachedStandaloneHtml = await inlineBuild()
  return cachedStandaloneHtml
}

export function registerCoartWidgetResource(server: any) {
  const metadata = {
    ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: ['data:', 'blob:'], frameDomains: ['data:', 'blob:'] } },
    'openai/widgetDescription': 'Coart native infinite canvas',
    'openai/widgetPrefersBorder': false,
    'openai/widgetCSP': { connect_domains: [], resource_domains: ['data:', 'blob:'], frame_domains: ['data:', 'blob:'] }
  }
  for (const [index, uri] of [WIDGET_URI, ...LEGACY_WIDGET_URIS].entries()) {
    registerAppResource(server, index === 0 ? `coart-canvas-widget-${manifest.version}` : `coart-canvas-widget-legacy-${index}`, uri, {
      title: 'Coart Canvas',
      description: 'A Fabric.js-powered native Codex canvas with project-local persistence.',
      _meta: metadata
    }, async () => ({ contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: await widgetHtml(), _meta: metadata }] }))
  }
}

async function replaceAsync(
  source: string,
  pattern: RegExp,
  replacer: (...args: string[]) => Promise<string>
) {
  const matches = Array.from(source.matchAll(pattern))
  let output = ''
  let cursor = 0
  for (const match of matches) {
    output += source.slice(cursor, match.index)
    output += await replacer(...(match as unknown as string[]))
    cursor = (match.index ?? 0) + match[0].length
  }
  return output + source.slice(cursor)
}
