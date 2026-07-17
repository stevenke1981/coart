import { existsSync } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { chromium, type Page } from 'playwright-core'
import { widgetHtml } from '../mcp/lib/widget.ts'

function browserCandidates(): string[] {
  const configured = process.env.COART_CHROME || process.env.CHROME_PATH
  const windows = process.platform === 'win32'
    ? [
        join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
        join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
        join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe')
      ]
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  return [...new Set([configured, ...windows].filter((value): value is string => Boolean(value)))]
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function numericAttribute(page: Page, name: string): Promise<number> {
  return Number(await page.locator('.coart-ferric-shell').getAttribute(name) ?? 0)
}

async function drag(page: Page, start: { x: number; y: number }, end: { x: number; y: number }, steps = 12): Promise<void> {
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps })
  await page.mouse.up()
}

const executable = browserCandidates().find((candidate) => existsSync(candidate))
if (!executable) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'No Chrome/Chromium executable found.' }))
} else {
  const html = await widgetHtml()
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(html)
  })
  const userDataDir = await mkdtemp(join(tmpdir(), 'coart-playwright-'))
  const screenshotPath = process.env.COART_WIDGET_SCREENSHOT || join(userDataDir, 'coart-ferric-after-interactions.png')
  let browser
  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    browser = await chromium.launch({
      executablePath: executable,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      timeout: 45_000
    })
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    await page.addInitScript(() => {
      Object.defineProperty(window, 'coartMcp', { configurable: true, get: () => undefined, set: () => undefined })
    })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.locator('.coart-ferric-shell').waitFor({ state: 'visible', timeout: 30_000 })
    await page.locator('.coart-ferric-scene svg').waitFor({ state: 'attached', timeout: 30_000 })
    await page.locator('.coart-toolbar').waitFor({ state: 'visible' })
    assert(await page.locator('.coart-style-panel').count() === 0, 'Style panel must not occupy the canvas before selection.')

    const shell = page.locator('.coart-ferric-shell')
    const shellBox = await shell.boundingBox()
    assert(shellBox && shellBox.height >= 640, 'Ferric canvas did not preserve the 640px intrinsic height floor.')

    await page.getByTitle('形狀', { exact: true }).click()
    await page.locator('[data-coart-tool="rectangle"]').click()
    const activeCanvasTool = await shell.getAttribute('data-tool')
    assert(activeCanvasTool === 'rectangle', `Toolbar and canvas editor instances diverged (canvas tool=${activeCanvasTool}).`)
    await drag(page, { x: 210, y: 180 }, { x: 410, y: 320 })
    await page.locator('.coart-selection-transform').waitFor({ state: 'visible' })
    await page.locator('.coart-style-panel').waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined)
    const stylePanelCount = await page.locator('.coart-style-panel').count()
    const selectedMode = await page.locator('.coart-context-toolbar').getAttribute('data-context-mode').catch(() => null)
    assert(stylePanelCount > 0 && await page.locator('.coart-style-panel').isVisible(), `Style panel did not appear for a selected rectangle (count=${stylePanelCount}, context=${selectedMode}).`)
    await page.getByTitle('固定面板').click()

    const selection = await page.locator('.coart-selection-transform').boundingBox()
    assert(selection, 'Selection bounds were unavailable after rectangle creation.')
    const loadSceneBeforeDrag = await numericAttribute(page, 'data-load-scene-count')
    await page.mouse.move(selection.x + selection.width / 2, selection.y + selection.height / 2)
    await page.mouse.down()
    await page.mouse.move(selection.x + selection.width / 2 + 72, selection.y + selection.height / 2 + 38, { steps: 18 })
    await page.waitForTimeout(50)
    const loadSceneDuringDrag = await numericAttribute(page, 'data-load-scene-count')
    assert(loadSceneDuringDrag === loadSceneBeforeDrag, `Drag rebuilt the Ferric engine (${loadSceneBeforeDrag} -> ${loadSceneDuringDrag}).`)
    await page.mouse.up()

    const resizeHandle = await page.locator('.coart-resize-handle.is-se').boundingBox()
    assert(resizeHandle, 'South-east resize handle was not rendered.')
    await drag(page, { x: resizeHandle.x + 5, y: resizeHandle.y + 5 }, { x: resizeHandle.x + 64, y: resizeHandle.y + 40 })
    const rotateHandle = await page.locator('.coart-rotate-handle').boundingBox()
    assert(rotateHandle, 'Rotate handle was not rendered.')
    await drag(page, { x: rotateHandle.x + 5, y: rotateHandle.y + 5 }, { x: rotateHandle.x + 42, y: rotateHandle.y + 16 })

    await page.keyboard.press('Control+d')
    await page.waitForTimeout(100)
    const selectedAfterDuplicate = await numericAttribute(page, 'data-selected-count')
    const idsAfterDuplicate = await shell.getAttribute('data-selected-ids')
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(100)
    const selectedAfterUndo = await numericAttribute(page, 'data-selected-count')
    const idsAfterUndo = await shell.getAttribute('data-selected-ids')
    await page.keyboard.press('Control+Shift+z')
    await page.waitForTimeout(100)
    const selectedAfterRedo = await numericAttribute(page, 'data-selected-count')
    const idsAfterRedo = await shell.getAttribute('data-selected-ids')
    await page.locator('.coart-selection-transform').waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined)
    assert(await page.locator('.coart-selection-transform').isVisible(), `Undo/redo lost the active selection overlay (duplicate=${selectedAfterDuplicate}:${idsAfterDuplicate}, undo=${selectedAfterUndo}:${idsAfterUndo}, redo=${selectedAfterRedo}:${idsAfterRedo}).`)

    const duplicatedBounds = await page.locator('.coart-selection-transform').boundingBox()
    assert(duplicatedBounds, 'Duplicated shape bounds were unavailable for marquee selection.')
    await page.keyboard.press('Escape')
    await drag(page,
      { x: Math.max(80, duplicatedBounds.x - 42), y: Math.max(90, duplicatedBounds.y - 42) },
      { x: duplicatedBounds.x + duplicatedBounds.width + 16, y: duplicatedBounds.y + duplicatedBounds.height + 16 })
    await page.waitForTimeout(80)
    assert(await numericAttribute(page, 'data-selected-count') >= 2, 'Marquee did not select both the original and duplicated shape.')
    await page.getByTitle('群組').click()
    await page.getByTitle('取消群組').waitFor({ state: 'visible' })
    await page.getByTitle('取消群組').click()
    await page.getByTitle('群組').waitFor({ state: 'visible' })
    await page.keyboard.press('Control+c')
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(80)
    assert(await numericAttribute(page, 'data-selected-count') >= 2, 'Clipboard paste did not preserve the multi-shape selection.')

    await page.locator('[data-coart-tool="text"]').click()
    assert(await shell.getAttribute('data-tool') === 'text', 'Text tool did not activate.')
    await page.mouse.click(650, 390)
    const textEditor = page.locator('.coart-ferric-text-editor')
    await textEditor.waitFor({ state: 'visible' })
    await textEditor.fill('中文畫布互動驗收')
    await textEditor.press('Enter')
    await textEditor.waitFor({ state: 'detached' })

    await page.locator('[data-coart-tool="draw"]').click()
    const revisionBeforeDraw = await numericAttribute(page, 'data-document-revision')
    await page.mouse.move(90, 470)
    await page.mouse.down()
    await page.mouse.move(560, 520, { steps: 1000 })
    await page.mouse.up()
    await page.waitForTimeout(100)
    assert(await numericAttribute(page, 'data-document-revision') > revisionBeforeDraw, 'The 1000-point draw sequence did not commit a document change.')

    const transformBeforePan = await page.locator('.coart-ferric-scene').getAttribute('style')
    await page.keyboard.down('Space')
    await drag(page, { x: 760, y: 510 }, { x: 810, y: 545 })
    await page.keyboard.up('Space')
    const transformAfterPan = await page.locator('.coart-ferric-scene').getAttribute('style')
    assert(transformAfterPan !== transformBeforePan, 'Space pan did not change the canvas camera transform.')
    const zoomBefore = await numericAttribute(page, 'data-document-revision')
    await page.mouse.move(600, 360)
    await page.mouse.wheel(0, -240)
    await page.waitForTimeout(50)
    assert(await numericAttribute(page, 'data-document-revision') === zoomBefore, 'Camera zoom incorrectly changed the document revision.')

    await page.getByTitle('AI 建立').click()
    await page.getByRole('button', { name: 'AI 圖片' }).click()
    const generationPanel = page.locator('.coart-panel')
    await generationPanel.waitFor({ state: 'visible' })
    assert(await page.locator('.coart-context-toolbar[data-context-mode="ai-image"]').isVisible(), 'AI Image context toolbar did not appear.')
    const prompt = generationPanel.locator('textarea')
    await prompt.fill('海邊現代建築，日落時分')
    await prompt.evaluate((element) => {
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAwUBAScY42YAAAAASUVORK5CYII='), (character) => character.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], 'reference.png', { type: 'image/png' }))
      element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }))
    })
    await page.locator('.coart-reference-grid img').waitFor({ state: 'visible' })
    await page.getByTitle('關閉').click()
    await page.locator('.coart-context-toolbar .is-primary').click()
    await generationPanel.waitFor({ state: 'visible' })
    assert(await prompt.inputValue() === '海邊現代建築，日落時分', 'Per-shape generation draft was not restored after close/reopen.')
    assert(await page.locator('.coart-reference-grid img').count() === 1, 'Reference image draft was not retained after close/reopen.')

    await page.getByTitle('關閉').click()
    const recordsBeforeImagePaste = await numericAttribute(page, 'data-record-count')
    await shell.evaluate((element) => {
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAwUBAScY42YAAAAASUVORK5CYII='), (character) => character.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }))
      element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }))
    })
    await page.waitForFunction((count) => Number(document.querySelector('.coart-ferric-shell')?.getAttribute('data-record-count') || 0) > count, recordsBeforeImagePaste)
    await page.locator('.coart-context-toolbar[data-context-mode="image"]').waitFor({ state: 'visible' })
    await page.getByTitle('裁切、替換與 alt text').click()
    const mediaPanel = page.locator('.coart-media-inspector')
    await mediaPanel.waitFor({ state: 'visible' })
    await mediaPanel.getByPlaceholder('描述圖片內容').fill('一個貼入畫布的測試圖片')
    await mediaPanel.getByRole('button', { name: '套用裁切' }).click()
    await mediaPanel.waitFor({ state: 'detached' })

    await page.getByTitle('AI 建立').click()
    await page.getByRole('button', { name: 'AI HTML' }).click()
    await page.getByTitle('直接編輯 HTML DOM').click()
    const htmlPanel = page.locator('.coart-html-editor-panel')
    await htmlPanel.waitFor({ state: 'visible' })
    await htmlPanel.locator('textarea').fill('<main style="font:32px sans-serif;padding:32px">HTML DOM 驗收</main>')
    await htmlPanel.getByRole('button', { name: '儲存 HTML' }).click()
    await page.locator('.coart-html-runtime.is-interactive').waitFor({ state: 'visible' })

    const pageSelect = page.locator('.coart-page-select')
    const firstPage = await pageSelect.inputValue()
    await page.getByTitle('新增頁面').click()
    assert(await pageSelect.locator('option').count() === 2, 'Page creation did not add a second page.')
    await pageSelect.selectOption(firstPage)

    await page.getByTitle('更多').click()
    await page.getByRole('button', { name: '圖層面板' }).click()
    await page.locator('.coart-layer-panel').waitFor({ state: 'visible' })
    assert(await page.locator('.coart-layer-list button').count() > 0, 'Layer panel did not list canvas objects.')
    assert(await page.locator('.coart-minimap').isVisible(), 'Minimap was not visible on the desktop canvas.')

    await page.setViewportSize({ width: 1536, height: 1024 })
    await page.waitForTimeout(100)
    await page.screenshot({ path: screenshotPath, animations: 'disabled' })
    const screenshotBytes = (await stat(screenshotPath)).size
    assert(screenshotBytes > 10_000, 'Playwright implementation screenshot was not written.')

    await page.keyboard.press('Escape')
    const viewports = [
      { width: 320, height: 640 },
      { width: 480, height: 720 },
      { width: 768, height: 640 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 }
    ]
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(30)
      const toolbar = await page.locator('.coart-toolbar').boundingBox()
      const canvas = await shell.boundingBox()
      assert(toolbar && toolbar.x >= 0 && toolbar.x < viewport.width && toolbar.y < viewport.height, `Toolbar escaped ${viewport.width}x${viewport.height}.`)
      assert(canvas && canvas.height >= 640, `Canvas height collapsed at ${viewport.width}x${viewport.height}.`)
    }

    const performanceContext = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 })
    const performancePage = await performanceContext.newPage()
    const performanceSnapshot = {
      schema: { schemaVersion: 2, sequences: { 'coart.ferric': 1 } },
      store: Object.fromEntries([
        ['document:document', { id: 'document:document', typeName: 'document', props: {}, meta: {} }],
        ['page:page', { id: 'page:page', typeName: 'page', name: 'Page 1', index: 'a1', props: {}, meta: {} }],
        ...Array.from({ length: 500 }, (_, index) => {
          const column = index % 25
          const row = Math.floor(index / 25)
          return [`shape:stress-${index}`, {
            id: `shape:stress-${index}`,
            typeName: 'shape',
            type: 'rectangle',
            parentId: 'page:page',
            index: `a${index + 1}`,
            x: column * 54,
            y: row * 42,
            rotation: 0,
            opacity: 1,
            props: { w: 44, h: 32, fill: index % 2 ? '#ffffff' : '#eff6ff', stroke: '#94a3b8', strokeWidth: 1 },
            meta: { coartVersion: 1 }
          }]
        })
      ])
    }
    await performancePage.addInitScript((snapshot) => {
      Object.defineProperty(window, 'coartMcp', { configurable: true, get: () => undefined, set: () => undefined })
      localStorage.setItem('coart:canvas:v1', JSON.stringify(snapshot))
    }, performanceSnapshot)
    const performanceStart = Date.now()
    await performancePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    const performanceShell = performancePage.locator('.coart-ferric-shell')
    await performancePage.locator('.coart-ferric-scene svg').waitFor({ state: 'attached', timeout: 30_000 })
    await performancePage.locator('.coart-toolbar').waitFor({ state: 'visible' })
    await performancePage.waitForFunction(() => Number(document.querySelector('.coart-ferric-shell')?.getAttribute('data-record-count') ?? 0) >= 502, undefined, { timeout: 30_000 })
    const stressLoadBefore = await numericAttribute(performancePage, 'data-load-scene-count')
    await performancePage.keyboard.down('Space')
    await drag(performancePage, { x: 720, y: 520 }, { x: 780, y: 570 }, 20)
    await performancePage.keyboard.up('Space')
    await performancePage.mouse.move(600, 360)
    await performancePage.mouse.wheel(0, -180)
    await performancePage.waitForTimeout(100)
    const stressLoadAfter = await numericAttribute(performancePage, 'data-load-scene-count')
    const performanceDurationMs = Date.now() - performanceStart
    assert(await numericAttribute(performancePage, 'data-record-count') >= 502, '500-shape stress snapshot did not hydrate completely.')
    assert(stressLoadAfter === stressLoadBefore, `500-shape pan/zoom rebuilt Ferric (${stressLoadBefore} -> ${stressLoadAfter}).`)
    assert(await performanceShell.isVisible(), '500-shape stress canvas became invisible.')
    assert(performanceDurationMs < 12_000, `500-shape pan/zoom stress exceeded 12 seconds (${performanceDurationMs}ms).`)
    await performanceContext.close()

    const expectedHostlessErrors = errors.filter((message) => message.includes('MCP error -32601'))
    const unexpectedErrors = errors.filter((message) => !message.includes('MCP error -32601'))
    assert(unexpectedErrors.length === 0, `Browser console/page errors:\n${unexpectedErrors.join('\n')}`)
    const pointerMoves = await numericAttribute(page, 'data-pointer-move-count')
    assert(pointerMoves > 0, 'Pointer interaction diagnostics did not record any engine moves.')
    console.log(JSON.stringify({
      ok: true,
      browser: executable,
      mounted: true,
      playwright: true,
      dragLoadSceneCount: { before: loadSceneBeforeDrag, during: loadSceneDuringDrag },
      pointerMoves,
      hostlessBridgeErrors: expectedHostlessErrors.length,
      stress500: { durationMs: performanceDurationMs, loadSceneBefore: stressLoadBefore, loadSceneAfter: stressLoadAfter },
      viewports,
      screenshotBytes,
      ...(process.env.COART_WIDGET_SCREENSHOT ? { screenshot: screenshotPath } : {})
    }))
  } finally {
    await browser?.close().catch(() => undefined)
    server.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
}
