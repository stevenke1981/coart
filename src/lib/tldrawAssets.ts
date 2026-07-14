import iconSpriteUrl from '@tldraw/assets/icons/icon/0_merged.svg?url'
import iconSpriteSource from '@tldraw/assets/icons/icon/0_merged.svg?raw'
import fontsIBMPlexSansBoldWoff2Url from '@tldraw/assets/fonts/IBMPlexSans-Bold.woff2?url'
import fontsIBMPlexSansBoldItalicWoff2Url from '@tldraw/assets/fonts/IBMPlexSans-BoldItalic.woff2?url'
import fontsIBMPlexSansMediumWoff2Url from '@tldraw/assets/fonts/IBMPlexSans-Medium.woff2?url'
import fontsIBMPlexSansMediumItalicWoff2Url from '@tldraw/assets/fonts/IBMPlexSans-MediumItalic.woff2?url'
import translationUrl from '@tldraw/assets/translations/main.json?url'
import translationZhTwUrl from '@tldraw/assets/translations/zh-tw.json?url'
import { iconTypes } from 'tldraw'
import type { TLUiAssetUrls } from 'tldraw'

// The stock @tldraw/assets Vite import pulls every locale and asset variant into
// the main widget bundle. Coart is shipped as a self-contained MCP resource, so
// keep a compact local font set, preserve zh-TW labels, and use the compact
// main translation as the fallback for other locales. Mapping tldraw's family
// aliases to four IBM Plex Sans files removes more than a megabyte from every
// restored Codex Widget renderer without changing editor behavior.
const translationKeys = [
  'ar', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa', 'fi', 'fr', 'gl', 'gu-in',
  'he', 'hi-in', 'hr', 'hu', 'id', 'it', 'ja', 'km-kh', 'kn', 'ko-kr', 'ku', 'languages',
  'main', 'ml', 'mr', 'ms', 'my', 'ne', 'nl', 'no', 'pa', 'pl', 'pt-br', 'pt-pt', 'ro',
  'ru', 'sl', 'so', 'sv', 'ta', 'te', 'th', 'tl', 'tr', 'uk', 'ur', 'vi', 'zh-cn', 'zh-tw'
] as const

function mapKeys<const Keys extends readonly string[]>(keys: Keys, value: string): Record<Keys[number], string> {
  return Object.fromEntries(keys.map((key) => [key, value])) as Record<Keys[number], string>
}

const fontUrls = {
  tldraw_mono_bold: fontsIBMPlexSansBoldWoff2Url,
  tldraw_mono_italic_bold: fontsIBMPlexSansBoldItalicWoff2Url,
  tldraw_mono: fontsIBMPlexSansMediumWoff2Url,
  tldraw_mono_italic: fontsIBMPlexSansMediumItalicWoff2Url,
  tldraw_sans_bold: fontsIBMPlexSansBoldWoff2Url,
  tldraw_sans_italic_bold: fontsIBMPlexSansBoldItalicWoff2Url,
  tldraw_sans: fontsIBMPlexSansMediumWoff2Url,
  tldraw_sans_italic: fontsIBMPlexSansMediumItalicWoff2Url,
  tldraw_serif_bold: fontsIBMPlexSansBoldWoff2Url,
  tldraw_serif_italic_bold: fontsIBMPlexSansBoldItalicWoff2Url,
  tldraw_serif: fontsIBMPlexSansMediumWoff2Url,
  tldraw_serif_italic: fontsIBMPlexSansMediumItalicWoff2Url,
  tldraw_draw_bold: fontsIBMPlexSansBoldWoff2Url,
  tldraw_draw_italic_bold: fontsIBMPlexSansBoldItalicWoff2Url,
  tldraw_draw: fontsIBMPlexSansMediumWoff2Url,
  tldraw_draw_italic: fontsIBMPlexSansMediumItalicWoff2Url
}

const embedIconKeys = [
  'canva', 'codepen', 'codesandbox', 'desmos', 'excalidraw', 'felt', 'figma', 'github_gist',
  'google_calendar', 'google_maps', 'google_slides', 'observable', 'replit', 'scratch',
  'spotify', 'tldraw', 'val_town', 'vimeo', 'youtube'
] as const
const compactEmbedIcon = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22/%3E'
const embedIconUrls = mapKeys(embedIconKeys, compactEmbedIcon)

function iconDataUrl(markup: string): string {
  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(markup)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return `data:image/svg+xml;base64,${btoa(binary)}`
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}

function iconAssetUrl(markup: string): string {
  if (typeof URL !== 'undefined' && typeof Blob !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  }
  return iconDataUrl(markup)
}

function buildIconUrls(): Record<string, string> {
  const fallback = Object.fromEntries(iconTypes.map((key) => [key, `${iconSpriteUrl}#${key}`]))
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return fallback

  const parsed = new DOMParser().parseFromString(iconSpriteSource, 'image/svg+xml')
  const root = parsed.documentElement
  if (!root || root.nodeName.toLowerCase() !== 'svg') return fallback

  const serializer = new XMLSerializer()
  const width = root.getAttribute('width') || '30'
  const height = root.getAttribute('height') || '30'
  const fill = root.getAttribute('fill') || 'none'
  const children = Array.from(root.children)

  const icons = Object.fromEntries(iconTypes.map((key) => {
    const icon = children.find((child) => child.getAttribute('id') === key)
    if (!icon) return [key, `${iconSpriteUrl}#${key}`]
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" fill="${fill}">${serializer.serializeToString(icon)}</svg>`
    return [key, iconAssetUrl(markup)]
  }))
  return icons
}

export const assetUrls: TLUiAssetUrls = {
  fonts: fontUrls,
  icons: buildIconUrls(),
  translations: { ...mapKeys(translationKeys, translationUrl), 'zh-tw': translationZhTwUrl },
  embedIcons: embedIconUrls
}
