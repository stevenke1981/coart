# Coart Traceability Matrix

| ID | 需求 | 實作位置 | 驗證方式 | 狀態 |
|---|---|---|---|---|
| FR-01 | 開啟 Codex 原生畫布 Widget | `mcp/server.ts`, `mcp/lib/widget.ts` | MCP tools/list + render smoke test | 已實作，待實機 |
| FR-02 | tldraw 無限畫布 | `src/App.jsx` | Vite build + UI smoke test | 已實作，待依賴建置 |
| FR-03 | AI 圖片框 | `CanvasToolbar.jsx`, `GenerationPanel.jsx` | 建立、選取、送出 prompt | 已實作，待實機 |
| FR-04 | AI HTML | `CoartHtmlShapeUtil.jsx`, `insert_coart_html` | 插入／更新 iframe HTML | 已實作，待實機 |
| FR-05 | AI Slides | `SlidesViewer.jsx`, `insert_coart_html` | 建立容器、插入 3 頁、播放 | 已實作，待實機 |
| FR-06 | 標註截圖修改 | `App.jsx`, `prompts.js` | 多選後匯出 PNG 並送 follow-up | 已實作，待實機 |
| FR-07 | 專案內持久化 | `mcp/lib/storage.ts` | 儲存後重開 Widget | 已實作，待整合測試 |
| FR-08 | 參考圖保存 | `save_coart_reference_image` | data URL 寫入 canvas assets | 已實作 |
| FR-09 | 圖片插入／替換 holder | `insert_coart_image` | 單元／MCP 整合測試 | 已實作，待整合測試 |
| NFR-01 | 路徑穿越防護 | `mcp/lib/safety.ts` | `tests/safety.test.ts` | 6/6 測試組合通過 |
| NFR-02 | 無 MCP 前端開發模式 | `coartClient.js` | localStorage 重載 | 已實作，待 UI 驗證 |
| NFR-03 | Clean-room 與品牌隔離 | 全專案、`ANALYSIS.md` | 原始碼／資產盤點 | 已完成 |
