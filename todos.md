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

## 下一版（v0.2）

- [ ] page asset lazy loading
- [ ] HTML DOM 文字編輯器
- [ ] 圖片 slide 與混合 deck
- [ ] Slides 拖放排序
- [ ] 多格式 export（ZIP/PDF/PPTX）
- [ ] image record deletion protection
- [ ] Playwright Widget UI 測試
- [ ] Windows 升級／原地更新腳本

## TypeScript 漸進路線（不阻塞目前修復）

- [ ] 先為 `window.coartMcp`、`window.openai` 與 storage records 加上 JSDoc／`.d.ts` 邊界型別
- [ ] 將 `src/lib/coartClient.js`、prompt 與 autosave hook 轉為 `.ts`
- [ ] 將 React UI 與 tldraw custom shape props 轉為 `.tsx`
- [ ] 最後再評估 MCP/storage `.mjs` 的 TypeScript 編譯流程（避免改變 plugin entrypoint）
