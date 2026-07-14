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
- [x] MCP Widget 直接自包含 HTML、外層 head 注入與 Chromium mount smoke
- [x] 前端 JavaScript 遷移為嚴格 TypeScript/TSX
- [x] Widget hydration 完成前停用 autosave，避免初始空白快照覆蓋既有畫布
- [x] MCP Apps resource teardown handler，避免切換 Codex 對話時 Widget 進入白頁
- [x] 移除 runtime gzip／DOMParser document rewrite；將 Widget 壓至 4 MiB 以下並直接執行 inline module，避免 first paint 後重建 `<head>`／`<body>`。
- [x] Widget production build 將 tldraw SVG sprite 拆成單一 icon 的 `blob:` URL，避免 MCP `data:` 文件的 fragment URL 導致 tldraw 工具圖示變成方塊。
- [x] Codex Desktop v0.2.6 固定採 inline Widget，版本化 resource URI 並保留 legacy alias，避開 stale fullscreen side-panel registration。
- [x] 移除 recurring height pulse 與固定 720px size override；改由 MCP Apps SDK 的 `autoResize` 依文件實際尺寸回報，讓 Codex 在切換／還原對話後重新定位 detached webview。
- [x] tldraw 自包含資產由 16 個字型縮為 4 個，移除未使用的 provider icon payload，Widget HTML 由約 4.36 MB 降至約 2.86 MB。
- [x] Windows 本機安裝腳本加入 `-ForceReinstall` 與版本不符自動升級，可更新既有安裝快取至目前 manifest 版本。

## 下一版（v0.2）

- [ ] page asset lazy loading
- [ ] HTML DOM 文字編輯器
- [ ] 圖片 slide 與混合 deck
- [ ] Slides 拖放排序
- [ ] 多格式 export（ZIP/PDF/PPTX）
- [ ] image record deletion protection
- [ ] Playwright Widget UI 測試（目前已有可移植 Chromium headless smoke）

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
