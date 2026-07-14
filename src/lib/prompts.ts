import type {
  AnnotationPromptArgs,
  HtmlPromptArgs,
  ImagePromptArgs,
  PromptReference,
  SlidesPromptArgs
} from '../types'

function ratio(width: number, height: number): string {
  return `${width}:${height} (${(width / height).toFixed(4)})`
}

function referenceLines(references: PromptReference[] = []): string {
  if (!references?.length) return ''
  return `\n參考圖片（已保存到目前專案）：\n${references.map((item) => `- ${item.assetPathRelativeToProject || item.assetPath}`).join('\n')}`
}

export function imagePrompt({ userPrompt, shape, pageId, references = [] }: ImagePromptArgs): string {
  const width = shape.props?.w || 512
  const height = shape.props?.h || 512
  return [
    '[@coart](plugin://coart@personal) 生成圖片',
    '',
    userPrompt.trim(),
    '',
    `目標 pageId：${pageId}`,
    `目標 AI 圖片框 shapeId：${shape.id}`,
    `目標尺寸：${width} × ${height} canvas units`,
    `目標比例：${ratio(width, height)}`,
    '請依此比例構圖，避免事後裁切或拉伸。',
    '使用目前可用的圖片生成能力產生最終 bitmap。',
    '產生完成後呼叫 insert_coart_image，anchorShapeId 設為上述 shapeId，replaceHolder 設為 true。',
    referenceLines(references)
  ].filter(Boolean).join('\n')
}

export function htmlPrompt({ userPrompt, shape, pageId, references = [] }: HtmlPromptArgs): string {
  const width = shape.props?.w || 1024
  const height = shape.props?.h || 576
  return [
    '[@coart](plugin://coart@personal) 生成 AI HTML',
    '',
    userPrompt.trim(),
    '',
    `目標 pageId：${pageId}`,
    `目標 AI HTML 框 shapeId：${shape.id}`,
    `目標尺寸：${width} × ${height}`,
    '產生完整、可執行、單檔 HTML；CSS 與 JavaScript 盡量內嵌。',
    '不要引用遠端圖片；需要圖片時先保存到 Coart assets，或使用 data URL。',
    '完成後呼叫 insert_coart_html，anchorShapeId 設為上述 shapeId，replaceHolder 設為 true。',
    referenceLines(references)
  ].filter(Boolean).join('\n')
}

export function slidesPrompt({ userPrompt, shape, pageId, slideCount, references = [] }: SlidesPromptArgs): string {
  return [
    '[@coart](plugin://coart@personal) 生成 AI Slides',
    '',
    userPrompt.trim(),
    '',
    `目標 pageId：${pageId}`,
    `Slides 容器 shapeId：${shape.id}`,
    `頁數：${slideCount}`,
    '每頁必須是獨立、完整、可執行的 1024 × 576 單檔 HTML。',
    '整套簡報需保持視覺、字體、配色與敘事一致。',
    '逐頁呼叫 insert_coart_html，slidesShapeId 設為上述容器 shapeId，replaceHolder 設為 false。',
    referenceLines(references)
  ].filter(Boolean).join('\n')
}

export function annotationPrompt({ pageId, screenshot }: AnnotationPromptArgs): string {
  return [
    '[@coart](plugin://coart@personal) 按標註修改',
    '',
    '請根據 Coart 匯出的標註截圖產生乾淨的新結果。',
    `pageId：${pageId}`,
    `標註截圖：${screenshot.assetPathRelativeToProject || screenshot.assetPath}`,
    '把箭頭與文字視為修改要求，不要將標註、選框或工具列帶入結果。',
    '保留原圖與原標註，將新圖片插入原選取內容右側。',
    '完成後呼叫 insert_coart_image；不要覆蓋原始圖片。'
  ].join('\n')
}
