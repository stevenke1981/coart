# Coart TODO

## 已完成（v0.1 starter）

- [x] Clean-room 架構與授權說明
- [x] Codex plugin manifest 與 MCP 設定
- [x] React + Vite + tldraw 基礎畫布
- [x] MCP Apps Widget bridge
- [x] snapshot / selection / view state
- [x] AI image / AI HTML / Slides slot
- [x] 參考圖保存與 prompt bridge
- [x] 圖片與 HTML insertion tools
- [x] 標註多選匯出
- [x] HTML Slides viewer
- [x] Node safety／prompt tests、Vite build 與 MCP resource probe

## 已完成（v0.2 reliability）

- [x] per-page snapshot 與 v2 manifest
- [x] v1 單檔 snapshot 相容讀取與下次保存遷移
- [x] manifest asset checksum、引用與保護標記
- [x] manifest/page path traversal 拒絕與 canonical snapshot 回復
- [x] storage unit tests
- [x] ChatGPT Developer Mode Streamable HTTP `/mcp` 與 probe
- [x] Codex/ChatGPT plugin marketplace 安裝包裝
- [x] MCP Widget gzip loader、外層 head 注入與 Chromium mount smoke
- [x] 前端 JavaScript 遷移為嚴格 TypeScript/TSX
- [x] Widget hydration 完成前停用 autosave，避免初始空白快照覆蓋既有畫布
- [x] MCP Apps resource teardown handler，避免切換 Codex 對話時 Widget 進入白頁
- [x] 修正 Widget 壓縮載入器在使用 `document.write()` 時無法執行 `<script type="module">` 導致 ChatGPT Codex 載入後白屏的問題。改用 DOMParser 與手動建立 script 節點執行。
- [x] Widget production build 將 tldraw SVG sprite 拆成單一 icon 的 `blob:` URL，避免 MCP `data:` 文件的 fragment URL 導致 tldraw 工具圖示變成方塊。

## 下一版（v0.2）

- [ ] page asset lazy loading
- [ ] HTML DOM 文字編輯器
- [ ] 圖片 slide 與混合 deck
- [ ] Slides 拖放排序
- [ ] 多格式 export（ZIP/PDF/PPTX）
- [ ] image record deletion protection
- [ ] Playwright Widget UI 測試（目前已有可移植 Chromium headless smoke）
- [ ] Windows 升級／原地更新腳本

## 公開功能對照後的優先工作（clean-room，不複製參考專案）

- [ ] page-local asset lazy read，避免初次 hydrate 全部資產
- [ ] image record deletion guard 與明確的 acknowledge/protect 參數
- [ ] image/HTML insertion 的 placement、collision avoidance、dry-run 與 shape metadata
- [ ] HTML DOM 文字編輯與 HTML/PNG export
- [ ] Slides paste/drag auto-layout、PNG/HTML folder export
- [ ] 補齊 3:2／2:3 aspect presets、aspect lock 與參考圖數量上限

## TypeScript 邊界

- [x] `window.coartMcp`、`window.openai`、MCP results、storage records 與 custom shape props 型別
- [x] React UI、prompt、client、data URL 與 autosave hook 轉為 `.ts/.tsx`
- [ ] 評估 MCP/storage `.mjs` 的 TypeScript 編譯流程（目前保留 `.mjs`，避免改變 plugin entrypoint）
