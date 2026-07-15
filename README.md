# Coart

Coart 是一個以 **clean-room 方式重新實作**的 Codex 原生無限畫布插件。它使用 Fabric.js 顯示與編輯畫布，透過 MCP Widget 與 Codex 溝通，並將畫布與資產保存在使用者目前專案的 `canvas/` 目錄。

> 本專案是依公開功能與公開介面重新設計，不包含 Cowart 原始碼、圖示、品牌文字或圖片資產。

## 已實作

- Codex 原生 MCP Widget（預設 sidebar，inline 為明確指定的 fallback）與獨立 Coart 編輯器視窗。
- `open_coart_editor` 以受 token 保護的 loopback HTTP bridge 開啟外部編輯器，狀態與圖片固定保存到目前專案的 `canvas/`。
- `get_coart_latest_image` 與 `read_coart_asset` 以 MCP image content 將專案圖片讀回同一個 Codex 對話。
- Fabric.js 無限畫布與本機開發模式；inline、sidebar 與外部編輯器共用同一個渲染核心。
- 畫布工具支援拖曳建立框線，以及點擊新增可直接雙擊／輸入編輯的文字物件。
- v2 manifest、per-page snapshot、相容回復副本、選取／視角與資產持久化。
- v1 snapshot 自動相容，下一次保存遷移到 v2。
- 資產 checksum、引用與保護標記。
- AI 圖片框、AI HTML 框、AI Slides 容器。
- 參考圖片保存與 follow-up prompt 傳送。
- 圖片插入／替換、HTML 插入／更新。
- 多選形狀匯出成標註截圖，再交給 Codex 進行修改。
- HTML Slides 預覽與全螢幕播放。
- 無 MCP 時使用瀏覽器 localStorage，方便前端開發。
- 前端與 MCP/scripts/tests 全面使用 TypeScript；Node 22.6+ 直接執行 `.ts` entrypoint。
- Widget 以自包含 HTML 傳輸，並以 Chromium smoke 驗證實際掛載。

## 從 GitHub 安裝到 Codex / ChatGPT desktop

```powershell
git clone https://github.com/stevenke1981/coart.git
cd coart
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```

安裝腳本會先安裝鎖定依賴並跑完整 quality gate，再把 clone 目錄註冊為 `coart-public` marketplace 並安裝 plugin。這個流程是必要的，因為 Git marketplace 本身不保證替 Node MCP server 執行 `npm install`。

安裝後請開啟新的 Codex task；在 ChatGPT desktop 的 Codex／Work 模式，也可從 Plugins 選擇 **Coart**。接著說：

```text
Open the Coart canvas for this project.
```

開啟畫布的預設流程是呼叫 `open_coart_editor`，由 Chrome／Edge 以獨立 app 視窗開啟 Coart；它只監聽 `127.0.0.1`，並以一次性 token 保護該專案的 API。編輯器與 Codex 對話仍使用同一個專案目錄，所有 snapshot 與圖片都寫入 `<projectDir>/canvas/`。完成編輯後回到原對話，要求「讀取最新圖片」即可由 `get_coart_latest_image` 將實際圖片內容回傳給 Codex；原始圖片不會被自動刪除。

獨立視窗沒有 Codex host 的 follow-up bridge，因此畫布內產生的提示詞會先複製到剪貼簿，貼回同一個 Codex 對話即可繼續工作。`render_coart_canvas` 未指定 `displayMode` 時預設要求 Codex host 放到 `sidebar`；需要對話內嵌時才明確指定 `inline`。Widget bridge 只向 MCP Apps SDK 宣告標準的 inline 能力，sidebar 作為 Codex host 的放置偏好傳遞，避免非標準 mode 讓初始化失敗。

Widget autosave 會依序保存 snapshot、selection 與 view state，避免同一個 MCP proxy 同時處理三個寫入請求而回傳 `MCP error -32000`。

若只想快速安裝並已自行跑過驗證，可在上方命令末尾加上 `-SkipQuality`。這只對該次 PowerShell 程序略過簽章政策，不會修改系統全域設定。

## ChatGPT Developer Mode

ChatGPT web 無法直接連接本機 stdio 程序；請啟動 Streamable HTTP MCP：

```bash
npm install
npm run start:http
```

預設 endpoint 是 `http://127.0.0.1:8787/mcp`。以 HTTPS tunnel 暴露該 port 後，在 ChatGPT **Settings → Security and login → Developer mode** 開啟開發者模式，再到 **Settings → Plugins** 建立 app，填入公開 HTTPS URL 加 `/mcp`。MCP metadata 或 tools 更新後需重新整理 app。

正式公開使用時應部署到固定 HTTPS endpoint；localhost/tunnel 僅適合開發驗證。

## 本機開發

```bash
npm install
npm run dev
```

本機開發不依賴 MCP；一般 Vite 頁面會保存到瀏覽器 localStorage。由 `open_coart_editor` 開啟的 standalone 頁面則直接透過 loopback bridge 保存到目前專案的 `canvas/`。

Node.js 22.6+ 以 type stripping 直接執行 MCP entrypoint、tests 與 probe scripts（`scripts/start-mcp.ts` 等），不需額外 TypeScript runtime 編譯步驟。

## Widget HTML 大小與自包含載入

ChatGPT/Codex host 對 Widget HTML 可能有未公開的大小限制。Coart 現在直接傳送自包含 HTML；`npm run probe:mcp` 會檢查 sidebar 預設、inline fallback、資源大小與 bridge 內容，`npm run probe:widget` 會實際啟動 Chrome 驗證 React/Fabric.js 已掛載。外部編輯器沿用同一份自包含 HTML，但由受 token 保護的本機 loopback server 提供，不需要 MCP Apps renderer。

MCP Apps 的[官方規格](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)要求 Widget resource 是有效 HTML5；[Apps SDK 文件](https://developers.openai.com/apps-sdk/build/mcp-server/)說明 CSP metadata 與 resource registration，但沒有公布固定 HTML byte 上限，實際 host 仍應在登入後的 Developer Mode 進行驗收。

## MCP 工具

- `render_coart_canvas`
- `open_coart_editor`
- `get_coart_canvas_state`
- `save_coart_canvas_state`
- `save_coart_selection`
- `save_coart_view_state`
- `get_coart_selection`
- `save_coart_reference_image`
- `read_coart_asset`
- `get_coart_latest_image`
- `insert_coart_image`
- `insert_coart_html`
- `download_coart_file`

## 驗證

```bash
npm run quality
```

此命令執行 syntax check、TypeScript typecheck、unit tests、Vite build、stdio/HTTP MCP probes 與 Chrome widget loader smoke。

## 專案結構

```text
coart/
├─ .codex-plugin/plugin.json
├─ .mcp.json
├─ mcp/
├─ scripts/
├─ skills/
├─ src/
├─ tests/
├─ ANALYSIS.md
├─ architecture.md
├─ AGENTS.md
├─ TEAM.md
├─ START_PROMPT.md
├─ traceability_matrix.md
├─ lessons.md
├─ BUILD_REPORT.md
├─ plan.md
├─ spec.md
├─ todos.md
├─ test.md
└─ final.md
```

## 安全原則

- 所有檔案路徑都必須位於指定專案的 `canvas/` 或使用者 Downloads 內。
- 檔名會清理，避免路徑穿越。
- Widget 僅允許 `data:` 與 `blob:` 資源。
- 不直接在前端保存 API 金鑰，也不內建第三方生圖服務。

## 授權

MIT
