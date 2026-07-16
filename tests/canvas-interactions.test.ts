import test from 'node:test'
import assert from 'node:assert/strict'
import { EventBus } from '../src/canvas/EventBus.ts'
import { PointerScheduler } from '../src/canvas/PointerScheduler.ts'
import { appendSample, previewPath, simplifyPath } from '../src/canvas/path.ts'
import { contextToolbarMode } from '../src/canvas/context.ts'
import { mixedValue } from '../src/canvas/style.ts'
import { SerialPersistenceQueue } from '../src/canvas/PersistenceQueue.ts'
import type { AnyCanvasShape } from '../src/types.ts'

function shape(type: string, coartKind?: AnyCanvasShape['meta']['coartKind']): AnyCanvasShape {
  return { id: `shape:${type}`, typeName: 'shape', type, parentId: 'page:page', index: 'a1', x: 0, y: 0, props: { w: 100, h: 100 }, meta: { coartKind } }
}

test('PointerScheduler keeps only the latest move per animation frame and supports flush/cancel', () => {
  const callbacks = new Map<number, FrameRequestCallback>()
  const cancelled: number[] = []
  const processed: number[] = []
  let handle = 0
  const scheduler = new PointerScheduler<number>(
    (sample) => processed.push(sample),
    (callback) => { callbacks.set(++handle, callback); return handle },
    (id) => { cancelled.push(id); callbacks.delete(id) }
  )
  for (let index = 0; index < 120; index += 1) scheduler.schedule(index)
  assert.equal(callbacks.size, 1)
  callbacks.get(1)?.(16)
  assert.deepEqual(processed, [119])
  scheduler.schedule(121)
  scheduler.flush()
  assert.deepEqual(processed, [119, 121])
  scheduler.schedule(122)
  scheduler.cancel()
  assert.deepEqual(cancelled, [2])
  assert.equal(scheduler.hasPending(), false)
})

test('draw sampling stays append-only and simplifies a 1000-point path', () => {
  const points: Array<{ x: number; y: number }> = []
  for (let index = 0; index < 1000; index += 1) appendSample(points, { x: index, y: Math.sin(index / 50) * 20 }, .5)
  assert.equal(points.length, 1000)
  const simplified = simplifyPath(points, 1.5)
  assert.ok(simplified.length < 100)
  assert.deepEqual(simplified[0], points[0])
  assert.deepEqual(simplified.at(-1), points.at(-1))
  assert.ok(previewPath(points, 320).length <= 321)
})

test('event bus keeps document, selection, and camera listeners separated', () => {
  type Events = { document: { revision: number }; selection: { ids: string[] }; camera: { zoom: number } }
  const bus = new EventBus<Events>()
  const received: string[] = []
  bus.on('document', ({ revision }) => received.push(`document:${revision}`))
  bus.on('selection', ({ ids }) => received.push(`selection:${ids.join(',')}`))
  bus.on('camera', ({ zoom }) => received.push(`camera:${zoom}`))
  bus.emit('camera', { zoom: 2 })
  bus.emit('selection', { ids: ['shape:a'] })
  assert.deepEqual(received, ['camera:2', 'selection:shape:a'])
})

test('serial persistence queue never overlaps MCP-style writes', async () => {
  const queue = new SerialPersistenceQueue()
  const order: string[] = []
  let active = 0
  const task = (name: string) => queue.enqueue(async () => {
    active += 1
    assert.equal(active, 1)
    order.push(`${name}:start`)
    await Promise.resolve()
    order.push(`${name}:end`)
    active -= 1
  })
  await Promise.all([task('document'), task('selection'), task('view')])
  assert.deepEqual(order, ['document:start', 'document:end', 'selection:start', 'selection:end', 'view:start', 'view:end'])
})

test('context toolbar mode and multi-selection mixed values are deterministic', () => {
  assert.equal(contextToolbarMode([]), null)
  assert.equal(contextToolbarMode([shape('frame', 'ai-image')]), 'ai-image')
  assert.equal(contextToolbarMode([shape('frame', 'ai-html')]), 'ai-html')
  assert.equal(contextToolbarMode([shape('frame', 'slides')]), 'slides')
  assert.equal(contextToolbarMode([shape('text')]), 'text')
  assert.equal(contextToolbarMode([shape('rectangle'), shape('text')]), 'mixed')
  assert.equal(mixedValue(['#fff', '#fff']), '#fff')
  assert.equal(mixedValue(['#fff', '#000']), 'mixed')
})
