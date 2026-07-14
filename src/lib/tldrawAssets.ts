import iconSpriteUrl from '@tldraw/assets/icons/icon/0_merged.svg?url'
import embedIconsCanvaPngUrl from '@tldraw/assets/embed-icons/canva.png?url'
import embedIconsCodepenPngUrl from '@tldraw/assets/embed-icons/codepen.png?url'
import embedIconsCodesandboxPngUrl from '@tldraw/assets/embed-icons/codesandbox.png?url'
import embedIconsDesmosPngUrl from '@tldraw/assets/embed-icons/desmos.png?url'
import embedIconsExcalidrawPngUrl from '@tldraw/assets/embed-icons/excalidraw.png?url'
import embedIconsFeltPngUrl from '@tldraw/assets/embed-icons/felt.png?url'
import embedIconsFigmaPngUrl from '@tldraw/assets/embed-icons/figma.png?url'
import embedIconsGithubGistPngUrl from '@tldraw/assets/embed-icons/github_gist.png?url'
import embedIconsGoogleCalendarPngUrl from '@tldraw/assets/embed-icons/google_calendar.png?url'
import embedIconsGoogleMapsPngUrl from '@tldraw/assets/embed-icons/google_maps.png?url'
import embedIconsGoogleSlidesPngUrl from '@tldraw/assets/embed-icons/google_slides.png?url'
import embedIconsObservablePngUrl from '@tldraw/assets/embed-icons/observable.png?url'
import embedIconsReplitPngUrl from '@tldraw/assets/embed-icons/replit.png?url'
import embedIconsScratchPngUrl from '@tldraw/assets/embed-icons/scratch.png?url'
import embedIconsSpotifyPngUrl from '@tldraw/assets/embed-icons/spotify.png?url'
import embedIconsTldrawPngUrl from '@tldraw/assets/embed-icons/tldraw.png?url'
import embedIconsValTownPngUrl from '@tldraw/assets/embed-icons/val_town.png?url'
import embedIconsVimeoPngUrl from '@tldraw/assets/embed-icons/vimeo.png?url'
import embedIconsYoutubePngUrl from '@tldraw/assets/embed-icons/youtube.png?url'
import fontsIBMPlexMonoBoldWoff2Url from '@tldraw/assets/fonts/IBMPlexMono-Bold.woff2?url'
import fontsIBMPlexMonoBoldItalicWoff2Url from '@tldraw/assets/fonts/IBMPlexMono-BoldItalic.woff2?url'
import fontsIBMPlexMonoMediumWoff2Url from '@tldraw/assets/fonts/IBMPlexMono-Medium.woff2?url'
import fontsIBMPlexMonoMediumItalicWoff2Url from '@tldraw/assets/fonts/IBMPlexMono-MediumItalic.woff2?url'
import fontsIBMPlexSansBoldWoff2Url from '@tldraw/assets/fonts/IBMPlexSans-Bold.woff2?url'
import fontsIBMPlexSansBoldItalicWoff2Url from '@tldraw/assets/fonts/IBMPlexSans-BoldItalic.woff2?url'
import fontsIBMPlexSansMediumWoff2Url from '@tldraw/assets/fonts/IBMPlexSans-Medium.woff2?url'
import fontsIBMPlexSansMediumItalicWoff2Url from '@tldraw/assets/fonts/IBMPlexSans-MediumItalic.woff2?url'
import fontsIBMPlexSerifBoldWoff2Url from '@tldraw/assets/fonts/IBMPlexSerif-Bold.woff2?url'
import fontsIBMPlexSerifBoldItalicWoff2Url from '@tldraw/assets/fonts/IBMPlexSerif-BoldItalic.woff2?url'
import fontsIBMPlexSerifMediumWoff2Url from '@tldraw/assets/fonts/IBMPlexSerif-Medium.woff2?url'
import fontsIBMPlexSerifMediumItalicWoff2Url from '@tldraw/assets/fonts/IBMPlexSerif-MediumItalic.woff2?url'
import fontsShantellSansInformalBoldWoff2Url from '@tldraw/assets/fonts/Shantell_Sans-Informal_Bold.woff2?url'
import fontsShantellSansInformalBoldItalicWoff2Url from '@tldraw/assets/fonts/Shantell_Sans-Informal_Bold_Italic.woff2?url'
import fontsShantellSansInformalRegularWoff2Url from '@tldraw/assets/fonts/Shantell_Sans-Informal_Regular.woff2?url'
import fontsShantellSansInformalRegularItalicWoff2Url from '@tldraw/assets/fonts/Shantell_Sans-Informal_Regular_Italic.woff2?url'
import translationUrl from '@tldraw/assets/translations/main.json?url'
import translationZhTwUrl from '@tldraw/assets/translations/zh-tw.json?url'
import { iconTypes } from 'tldraw'
import type { TLUiAssetUrls } from 'tldraw'

// The stock @tldraw/assets Vite import pulls every locale and asset variant into
// the main widget bundle. Coart is shipped as a self-contained MCP resource, so
// keep all font families and provider icons local, preserve zh-TW labels, and
// use the compact main translation as the fallback for other locales.
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
  tldraw_mono_bold: fontsIBMPlexMonoBoldWoff2Url,
  tldraw_mono_italic_bold: fontsIBMPlexMonoBoldItalicWoff2Url,
  tldraw_mono: fontsIBMPlexMonoMediumWoff2Url,
  tldraw_mono_italic: fontsIBMPlexMonoMediumItalicWoff2Url,
  tldraw_sans_bold: fontsIBMPlexSansBoldWoff2Url,
  tldraw_sans_italic_bold: fontsIBMPlexSansBoldItalicWoff2Url,
  tldraw_sans: fontsIBMPlexSansMediumWoff2Url,
  tldraw_sans_italic: fontsIBMPlexSansMediumItalicWoff2Url,
  tldraw_serif_bold: fontsIBMPlexSerifBoldWoff2Url,
  tldraw_serif_italic_bold: fontsIBMPlexSerifBoldItalicWoff2Url,
  tldraw_serif: fontsIBMPlexSerifMediumWoff2Url,
  tldraw_serif_italic: fontsIBMPlexSerifMediumItalicWoff2Url,
  tldraw_draw_bold: fontsShantellSansInformalBoldWoff2Url,
  tldraw_draw_italic_bold: fontsShantellSansInformalBoldItalicWoff2Url,
  tldraw_draw: fontsShantellSansInformalRegularWoff2Url,
  tldraw_draw_italic: fontsShantellSansInformalRegularItalicWoff2Url
}

const embedIconUrls = {
  canva: embedIconsCanvaPngUrl,
  codepen: embedIconsCodepenPngUrl,
  codesandbox: embedIconsCodesandboxPngUrl,
  desmos: embedIconsDesmosPngUrl,
  excalidraw: embedIconsExcalidrawPngUrl,
  felt: embedIconsFeltPngUrl,
  figma: embedIconsFigmaPngUrl,
  github_gist: embedIconsGithubGistPngUrl,
  google_calendar: embedIconsGoogleCalendarPngUrl,
  google_maps: embedIconsGoogleMapsPngUrl,
  google_slides: embedIconsGoogleSlidesPngUrl,
  observable: embedIconsObservablePngUrl,
  replit: embedIconsReplitPngUrl,
  scratch: embedIconsScratchPngUrl,
  spotify: embedIconsSpotifyPngUrl,
  tldraw: embedIconsTldrawPngUrl,
  val_town: embedIconsValTownPngUrl,
  vimeo: embedIconsVimeoPngUrl,
  youtube: embedIconsYoutubePngUrl
}

export const assetUrls: TLUiAssetUrls = {
  fonts: fontUrls,
  icons: Object.fromEntries(iconTypes.map((key) => [key, `${iconSpriteUrl}#${key}`])),
  translations: { ...mapKeys(translationKeys, translationUrl), 'zh-tw': translationZhTwUrl },
  embedIcons: embedIconUrls
}
