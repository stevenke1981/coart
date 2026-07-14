import assert from 'node:assert/strict'
import test from 'node:test'
import { htmlPrompt, imagePrompt, slidesPrompt } from '../src/lib/prompts.ts'

const shape = { id: 'shape:test', props: { w: 1024, h: 576 } }

test('image prompt includes shape contract and insertion tool', () => {
  const output = imagePrompt({ userPrompt: '夜景海報', shape, pageId: 'page:1', references: [] })
  assert.match(output, /shape:test/)
  assert.match(output, /1024 × 576/)
  assert.match(output, /insert_coart_image/)
})

test('html and slides prompts name their insertion workflow', () => {
  assert.match(htmlPrompt({ userPrompt: '產品頁', shape, pageId: 'page:1' }), /insert_coart_html/)
  assert.match(slidesPrompt({ userPrompt: '季度報告', shape, pageId: 'page:1', slideCount: 5 }), /頁數：5/)
})
