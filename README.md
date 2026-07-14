# Coart

Coart 是一個以 **clean-room 方式重新實作**的 Codex 原生無限畫布插件。它使用 tldraw 顯示畫布，透過 MCP Widget 與 Codex 溝通，並將畫布與資產保存在使用者目前專案的 `canvas/` 目錄。

> 本專案是依公開功能與公開介面重新設計，不包含 Cowart 原始碼、圖示、品牌文字或圖片資產。

## 已實作

- Codex 原生 MCP Widget，可切換 inline / fullscreen。
- tldraw 無限畫布與本機開發模式。
- v2 manifest、per-page snapshot、相容回復副本、選取／視角與資產持久化。
- v1 snapshot 自動相容，下一次保存遷移到 v2。
- 資產 checksum、引用與保護標記。
- AI 圖片框、AI HTML 框、AI Slides 容器。
- 參考圖片保存與 follow-up prompt 傳送。
- 圖片插入／替換、HTML 插入／更新。
- 多選形狀匯出成標註截圖，再交給 Codex 進行修改。
- HTML Slides 預覽與全螢幕播放。
- 無 MCP 時使用瀏覽器 localStorage，方便前端開發。

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

本機開發不依賴 MCP；畫布會保存到瀏覽器 localStorage。原生 Widget 模式才會保存到目前專案的 `canvas/`。

## MCP 工具

- `render_coart_canvas`
- `get_coart_canvas_state`
- `save_coart_canvas_state`
- `save_coart_selection`
- `save_coart_view_state`
- `get_coart_selection`
- `save_coart_reference_image`
- `read_coart_asset`
- `insert_coart_image`
- `insert_coart_html`
- `download_coart_file`

## 驗證

```bash
npm run quality
```

此命令執行 syntax check、unit tests、Vite build、stdio MCP probe 與 Streamable HTTP MCP probe。

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
