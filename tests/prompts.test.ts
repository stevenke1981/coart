import assert from 'node:assert/strict'
import test from 'node:test'
import { htmlPrompt, imagePrompt, slidesPrompt } from '../src/lib/prompts.ts'

const shape = { id: 'shape:test', props: { w: 1024, h: 576 } }

test('image prompt includes shape contract and insertion tool', () => {
  const output = imagePrompt({ userPrompt: '夜景海報', shape, pageId: 'page:1', references: [] })
  assert.match(output, /shape:test/)
  assert.match(output, /1024 × 576/)
  assert.match(output, /insert_coart_image/)
  assert.match(output, /目標解析度：2K/)
})

test('image prompt supports 4K output while preserving the selected ratio', () => {
  const output = imagePrompt({
    userPrompt: '直式商品主視覺',
    shape: { id: 'shape:portrait', props: { w: 576, h: 1024 }, meta: { coartAspectRatio: '9:16' } },
    pageId: 'page:1',
    resolution: '4K'
  })
  assert.match(output, /目標比例：9:16/)
  assert.match(output, /目標解析度：4K（2304 × 4096 px）/)
})

test('html and slides prompts name their insertion workflow', () => {
  assert.match(htmlPrompt({ userPrompt: '產品頁', shape, pageId: 'page:1' }), /insert_coart_html/)
  assert.match(slidesPrompt({ userPrompt: '季度報告', shape, pageId: 'page:1', slideCount: 5 }), /頁數：5/)
})

test('existing image prompts target the preserving update workflow', () => {
  const output = imagePrompt({
    userPrompt: '把背景改成夕陽',
    shape: { id: 'shape:image', type: 'image', props: { w: 640, h: 480 }, meta: {} },
    pageId: 'page:1',
    references: []
  })
  assert.match(output, /update_coart_image/)
  assert.doesNotMatch(output, /replaceHolder 設為 true/)
})
