# Cowart 功能分析與 Coart 重建策略

## 1. 原專案定位

Cowart 不是一般網頁白板，而是由四層組成：

1. **Codex 插件宣告層**：`.codex-plugin/plugin.json` 與 `.mcp.json`。
2. **MCP Widget 層**：註冊原生 Widget 資源與 render tool。
3. **畫布應用層**：React + tldraw，加入 AI 圖片、HTML、Slides、標註與匯出工作流。
4. **專案儲存層**：將 snapshot、選取、視角與 page assets 保存到使用者專案，不寫回插件目錄。

## 2. 觀察到的技術棧

- React 19、Vite 7、tldraw 5。
- `@modelcontextprotocol/sdk` 與 `@modelcontextprotocol/ext-apps`。
- Zod 定義 MCP tool schema。
- HTML2Canvas 用於 HTML／畫布捕捉。
- fractional-indexing 用於 tldraw shape 排序。

## 3. 核心功能

- 原生 Codex widget 開啟無限畫布。
- 畫布 snapshot、page assets、選取與 camera 狀態持久化。
- AI 圖片 slot：依 slot 尺寸與比例產圖，完成後替換 slot。
- AI HTML slot：產生單檔 HTML，嵌入畫布並允許迭代。
- AI Slides：建立多頁 16:9 HTML，縮圖選頁與全螢幕播放。
- 標註工作流：匯出包含圖片、箭頭與文字的截圖，交由 Codex 生成乾淨結果。
- Widget bridge：從前端呼叫 MCP server tool，或向 Codex 發送 follow-up message。

## 4. 原架構風險

- 主畫布程式集中在單一超大型 `App.jsx`，後續維護、測試與多人協作成本高。
- Widget bridge、提示詞、shape UI、匯出、Slides 與 HTML 編輯耦合。
- 無明確 LICENSE 檔時，不應直接複製程式碼或品牌資產。
- snapshot 直接操作 tldraw store record，需要嚴格 schema 相容與資料遺失保護。
- 靜態 Widget 必須符合 CSP，不能依賴外部 JS/CSS/圖片。

## 5. Coart 的改良方向

- 採 clean-room 功能重建，使用新命名、MIT 授權與獨立視覺識別。
- 前端拆成 toolbar、generation panel、slides viewer、client、prompts 與 autosave hook。
- MCP 拆成 server、storage、widget 三層。
- 先使用單一 snapshot + assets 的穩定 MVP，再升級成 per-page snapshot。
- 所有 AI 執行交給 Codex；Coart 負責上下文、檔案、定位、比例與結果插入。
- 增加 Node 測試、路徑安全檢查、原子寫入與可恢復備份。

## 6. 功能對照

| 能力 | Cowart | Coart v0.1 |
|---|---:|---:|
| 原生 MCP Widget | 有 | 有 |
| tldraw 無限畫布 | 有 | 有 |
| 專案內持久化 | 有 | 有 |
| AI 圖片 slot | 有 | 有 |
| 參考圖 | 有 | 有 |
| 標註截圖交給 Codex | 有 | 有，多選匯出 |
| AI HTML | 有 | 有，自訂 HTML shape |
| AI Slides | 有 | 有，HTML slides MVP |
| 圖片／HTML 匯出 | 有 | 基礎下載工具 |
| page-level snapshot | 有 | v0.2 規劃 |
| 懶載入 page assets | 有 | v0.2 規劃；v0.1 讀取時 hydration |
| 完整 DOM 文字編輯 | 有 | v0.2 規劃 |
| 自動避免所有 shape 碰撞 | 有 | 基礎右側排列 |
