import type { CoartMcpBridge, OpenAiBridge } from './types'

declare global {
  const __COART_WIDGET_BUILD__: boolean | undefined

  interface Window {
    coartMcp?: CoartMcpBridge
    openai?: OpenAiBridge
  }
}

export {}
