import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { startCoartEditorServer } from '../mcp/lib/editor.ts'
import { saveCanvasSnapshot } from '../mcp/lib/storage.ts'

function snapshot() {
  return {
    schema: { schemaVersion: 2, sequences: {} },
    store: {
      'document:document': { id: 'document:document', typeName: 'document', name: 'Coart' },
      'page:one': { id: 'page:one', typeName: 'page', name: 'One', index: 'a1' }
    }
  }
}

test('standalone editor serves authenticated project state and persists updates', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'coart-editor-'))
  await saveCanvasSnapshot({ projectDir }, snapshot())
  const editor = await startCoartEditorServer(projectDir)
  try {
  const page = await fetch(`${editor.baseUrl}/?coartMode=external&projectDir=${encodeURIComponent(projectDir)}&token=${editor.token}`)
    assert.equal(page.status, 200)
    assert.match(await page.text(), /Coart Canvas/)

    const health = await fetch(`${editor.baseUrl}/health`)
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { ok: true, service: 'coart-editor' })

    const unauthorized = await fetch(`${editor.baseUrl}/api/state`)
    assert.equal(unauthorized.status, 401)

    const state = await fetch(`${editor.baseUrl}/api/state`, {
      headers: { 'x-coart-editor-token': editor.token }
    })
    assert.equal(state.status, 200)
    const loaded = await state.json()
    assert.equal(loaded.projectDir, projectDir)
    assert.equal(loaded.snapshot.store['page:one'].name, 'One')

    const changed = snapshot()
    changed.store['page:one'].name = 'Edited'
    const saved = await fetch(`${editor.baseUrl}/api/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-coart-editor-token': editor.token
      },
      body: JSON.stringify({ snapshot: changed })
    })
    assert.equal(saved.status, 200)
    assert.equal((await saved.json()).ok, true)

    const reloaded = await fetch(`${editor.baseUrl}/api/state`, {
      headers: { 'x-coart-editor-token': editor.token }
    })
    assert.equal((await reloaded.json()).snapshot.store['page:one'].name, 'Edited')
  } finally {
    await editor.close()
  }
})
