# Coart v0.2.4 Reliability Delivery

本交付在獨立 clean-room `coart` 專案上完成 v0.2 儲存與安裝可靠性升級，不依賴 Cowart 原始碼或品牌資產。

## 交付內容

- 可安裝的 Codex plugin manifest。
- MCP Native Widget server。
- React + tldraw 畫布。
- AI 圖片、AI HTML、AI Slides 與標註工作流。
- v2 manifest、per-page snapshot、shared records 與相容回復 snapshot。
- v1 snapshot 相容讀取與保存時遷移。
- asset checksum、引用與保護清單。
- stdio 與 Streamable HTTP 兩種 MCP transport。
- 公開 GitHub marketplace 與本機 Codex 安裝流程。
- 三個 Codex skills。
- 前端全面改為嚴格 TypeScript/TSX，集中 bridge、storage、prompt 與 tldraw shape 型別。
- gzip/base64 自包含 Widget loader，避免 MCP HTML resource 超過 host 支援上限。
- 以公開 Cowart 功能說明作 clean-room 對照，保留 Coart 自有名稱、schema、UI 文案與資產；差異化缺口已寫入 `todos.md`，未複製參考專案程式碼。
- 分析、架構、規格、計畫、TODO、測試、Agent 團隊、追蹤矩陣與啟動提示詞。

## 2026-07-14 畫布載入 hotfix

- 修正 Widget 在既有 snapshot 非同步 hydrate 完成前掛載 autosave 的競速。
- autosave 現在只會在 hydration 完成（或載入失敗已明確處理）後啟用，避免初始空白 store 覆蓋已保存的 image shape。
- 已恢復八駿圖分鏡素材至 `canvas/assets/eight-steeds-storyboard-16x9-fixed.png`，並確認 hydrated snapshot 會把圖片轉為 data URL。

## 2026-07-14 MCP Apps lifecycle hotfix

- 在 `app.connect()` 前註冊 `app.onteardown`，讓 Codex 切換對話送出的 `ui/resource-teardown` 得到合法回應，避免 Widget 被宿主留在白色空頁。
- `scripts/probe-widget-loader.mjs` 會檢查生成的 Widget bridge 包含 teardown handler。

## 2026-07-14 Widget Loader module script 白屏修正

- 修正 Widget 壓縮載入器使用 `document.write()` 時，因瀏覽器規格限制不執行 `<script type="module">`，導致 React/tldraw 主程式無法執行、畫面短暫顯示後即變白屏的問題。
- 改用 `DOMParser` 解析解壓後的 HTML，逐一將 `<head>`、`<body>` 的靜態節點與屬性導入 live document，並對所有 `<script>`（包含 `type="module"` 腳本）透過 `document.createElement` 重新建立與插入以觸發瀏覽器載入與執行。
- 透過 `npm run probe:widget` 在 Headless Chrome 進行端到端加載測試，確認 React 與 tldraw canvas 完全 Mount 成功，無白屏問題。

## 已知限制

- page asset lazy loading 尚未完成；目前讀取時會組合完整 snapshot。
- image record deletion protection 尚未提供刪除／回收流程；v2 manifest 先將現有資產標記為 protected，且沒有自動刪檔。
- Slides viewer 以 HTML slide 為主，圖片 slide 與完整匯出留待後續版本。
- tldraw 與 MCP ext-apps 版本更新時，可能需要調整 API 相容性。
- Production bundle 的主要 JS 約 3.89 MB；Widget decoded HTML 約 4.31 MB，但 MCP transport envelope 以 gzip + base64 壓至約 2.81 MB。4 MiB 是專案回歸防護線，不代表 Apps SDK 公布的固定限制；官方文件未公布固定 byte limit。
- Widget 注入固定使用外層最後一個 `</head>`，主 bundle 使用 inline module timing，並以 single-bundle build 消除 `ui://` 資源無法追載的 lazy chunk。
- Headless Chromium smoke 已確認 loader 解壓後實際掛載 `.coart-app`、tldraw container；尚未完成登入後的 ChatGPT Developer Mode host-level 驗收與像素級截圖。
- `codex review --uncommitted` 對 53-file 初始 repo 的全量 review 在 184 秒逾時，未產生可用報告；改採針對 storage/manifest 提交協定的人工審查，並修正內容世代原子性與損壞 fallback 依賴問題。
- TypeScript 目前採前端完整遷移、MCP `.mjs` 保留的邊界：前端可由 `tsc --noEmit` 嚴格檢查；MCP 入口仍由 Node 直接執行，避免 plugin entrypoint 引入額外 runtime。
- 目前已開啟的舊 Widget 實例仍可能持有舊版 bundle；重啟 Coart MCP bridge 後需重新開啟畫布才能套用 hydration hotfix。

## 已完成驗證

- `npm run check`：通過。
- `npm run typecheck`：通過。
- `npm test`：11/11 通過（path、storage v2、immutable generations/assets、migration、recovery、prompt）。
- `npm run build`：Vite production build 通過。
- `npm run probe:mcp`：11 個 MCP tools、render tool、Widget resource 與 host bridge 通過。
- `npm run probe:mcp`：驗證 envelope、外層 head 注入位置、壓縮 Widget 2,806,326 bytes，decoded 4,307,181 bytes。
- `npm run probe:http`：Streamable HTTP `/mcp` 與 11 個 tools 通過。
- `npm run probe:widget`：Chrome headless 實際掛載 React/tldraw，`mounted: true`。
- hydration hotfix：直接讀取 `readCanvasState(..., { hydrateAssets: true })` 確認 image asset 會回傳 data URL，且 snapshot 保留 image shape。
- Codex 安裝快取：`coart@coart-public` v0.2.4 安裝後，需從快取重新執行 stdio/HTTP/widget probes。

## 建議第一個 Codex 實機驗證

```bash
npm install
npm run quality
```

接著 clone 並安裝本機 marketplace，開新 task 後呼叫：

```powershell
git clone https://github.com/stevenke1981/coart.git
cd coart
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```
