# Coart Lessons Log

## 2026-07-14 — 初始 clean-room 架構

- Cowart 的核心價值不是單純 tldraw UI，而是 Codex MCP Widget、host bridge、專案檔案儲存與 AI 工作流的組合。
- 將全部功能集中於大型 `App.jsx` 會提高回歸成本；Coart 從第一版即拆成 components、hooks、client bridge、storage 與 MCP server。
- tldraw snapshot 有「document store snapshot」與「editor document/session snapshot」兩種語意；Coart MCP 儲存契約統一使用 `store.getStoreSnapshot('document')`。
- 自訂 shape API 必須依目前 tldraw 主版本核對；indicator 使用 `getIndicatorPath`，可調整大小的 box shape 使用 `BaseBoxShapeUtil`。
- 原生 Widget 的 HTML 必須自包含並符合 CSP，因此建置流程需要 inline CSS/JS，資產則透過 MCP 讀取與 data URL hydration。
- 在未確認上游授權前，不複製原始碼、圖示、品牌或提示詞全文；以公開行為規格重新實作。
