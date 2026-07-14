# Coart v0.2.6 Reliability Delivery

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
- 低於 4 MiB 的直接自包含 Widget HTML，不在 runtime 重建 document。
- 以公開 Cowart 功能說明作 clean-room 對照，保留 Coart 自有名稱、schema、UI 文案與資產；差異化缺口已寫入 `todos.md`，未複製參考專案程式碼。
- 分析、架構、規格、計畫、TODO、測試、Agent 團隊、追蹤矩陣與啟動提示詞。

## 2026-07-14 畫布載入 hotfix

- 修正 Widget 在既有 snapshot 非同步 hydrate 完成前掛載 autosave 的競速。
- autosave 現在只會在 hydration 完成（或載入失敗已明確處理）後啟用，避免初始空白 store 覆蓋已保存的 image shape。
- 已恢復八駿圖分鏡素材至 `canvas/assets/eight-steeds-storyboard-16x9-fixed.png`，並確認 hydrated snapshot 會把圖片轉為 data URL。

## 2026-07-14 MCP Apps lifecycle hotfix

- 在 `app.connect()` 前註冊 `app.onteardown`，讓 Codex 切換對話送出的 `ui/resource-teardown` 得到合法回應，避免 Widget 被宿主留在白色空頁。
- `scripts/probe-widget-loader.mjs` 會檢查生成的 Widget bridge 包含 teardown handler。

## 2026-07-14 v0.2.6 Codex Desktop Widget 白屏修正

- 實機重現確認不是 MCP bridge 中斷或 React/tldraw crash：畫面消失後 Widget 仍持續成功呼叫 `get_coart_canvas_state`／save tools，Crashpad 也沒有 renderer dump；留下的是 Codex 對話中的灰色 placeholder。
- Codex Desktop 26.707.9981 會把 MCP App `<webview>` 移到 detached portal，再由 placeholder 的 `ResizeObserver` 維持座標。宿主 log 在白屏期間連續回報 `ResizeObserver loop completed with undelivered notifications`，符合 portal webview 已存活但覆蓋座標／可見性失效。
- 舊 Widget 的 runtime gzip loader 會在 first paint 後整頁替換 `<head>`／`<body>`；舊版為嘗試修補宿主座標而加入的 2 秒 height pulse，更會讓已恢復對話持續觸發宿主 ResizeObserver。v0.2.6 已完全移除兩者，只送出一次穩定的 720px intrinsic height。
- tldraw 字型由 16 個檔案縮為 4 個 IBM Plex Sans variant，未使用的 provider embed icon 改為單一輕量 fallback；production JS 由約 3.94 MB 降至約 2.44 MB，最終 Widget HTML 由 decoded 約 4.36 MB 降至直接可載入的約 2.86 MB。
- Widget resource 改用版本化 URI `ui://widget/coart/canvas-v0-2-6.html`，同時保留 legacy URI 相容舊 tool result；Codex Desktop 僅宣告 inline，避免舊 fullscreen side-panel registration 把後續 render 導向不可見容器。
- `probe:mcp` 會拒絕 gzip loader、`DecompressionStream`、document rewrite 與 recurring layout pulse；`probe:widget` 以 Headless Chrome 實際掛載 React/tldraw 與驗證 icon mask。

## 2026-07-14 tldraw icon sprite 修正

- Widget build 會以本機 SVG source 解析每個 icon，為每個圖示建立不含 fragment 的單一 SVG `blob:` URL；這符合 tldraw 使用 CSS mask 的資產方式，也避開 MCP `data:` 文件的 fragment URL 被瀏覽器拒絕。
- `scripts/probe-mcp.mjs` 會驗證 Widget bundle 包含 DOMParser、`createObjectURL` 與 SVG MIME path；`scripts/probe-widget-loader.mjs` 另外在 Headless Chrome 確認 tldraw icon 實際取得 CSS mask URL，不需載入外部 icon 資源。

## 2026-07-14 Codex Desktop host 相容邊界

- 這次問題包含 Codex Desktop 本身的 restored-task／MCP App lifecycle 缺陷，並非 Coart 專案檔案損壞。相同 26.707 系列已有公開的 restored task 逐一啟動 plugin MCP、renderer 記憶體累積與 UI blank/reload 報告：<https://github.com/openai/codex/issues/32942>。
- 本機診斷曾觀察到 26 個 ChatGPT renderer 使用約 5.33 GiB working set；多次測試建立的舊 Widget 即使 bridge 已停止，仍可把 timer 留在 renderer。v0.2.6 移除 Coart 可控制的高風險來源，但 Codex 宿主是否回收已恢復任務的 webview/MCP process 仍需由上游修正。
- `scripts/install-local.ps1 -ForceReinstall` 會移除舊安裝並安裝 manifest 目前版本；本次已安裝至 `C:\Users\eda\.codex\plugins\cache\coart-public\coart\0.2.6`。
- 實際新 task 呼叫 `render_coart_canvas`（`projectDir: D:\coart`, `displayMode: inline`）後，resource read 與 Widget tools 均成功；v0.2.6 掛載後宿主 log 不再出現舊版每 2 秒成批的 ResizeObserver pulse error。

## 已知限制

- page asset lazy loading 尚未完成；目前讀取時會組合完整 snapshot。
- image record deletion protection 尚未提供刪除／回收流程；v2 manifest 先將現有資產標記為 protected，且沒有自動刪檔。
- Slides viewer 以 HTML slide 為主，圖片 slide 與完整匯出留待後續版本。
- tldraw 與 MCP ext-apps 版本更新時，可能需要調整 API 相容性。
- Production bundle 的主要 JS 約 2.44 MB；最終 Widget HTML 約 2.86 MB，直接經 MCP resource 傳送，不再使用 gzip/base64 runtime loader。4 MiB 是專案回歸防護線，不代表 Apps SDK 公布的固定限制。
- Widget 注入固定使用外層最後一個 `</head>`，主 bundle 使用 inline module timing，並以 single-bundle build 消除 `ui://` 資源無法追載的 lazy chunk。
- Headless Chromium smoke 已確認直接 HTML 實際掛載 `.coart-app`、tldraw container；Windows 在最後一次 host 驗收時拒絕桌面擷取（Win32 error 5），因此以 Codex host log、tool call continuity 與 headless 像素渲染交叉驗證，未把 `PrintWindow`（無法擷取 detached webview surface）的灰色 placeholder 當成失敗證據。
- `codex review --uncommitted` 對 53-file 初始 repo 的全量 review 在 184 秒逾時，未產生可用報告；改採針對 storage/manifest 提交協定的人工審查，並修正內容世代原子性與損壞 fallback 依賴問題。
- TypeScript 目前採前端完整遷移、MCP `.mjs` 保留的邊界：前端可由 `tsc --noEmit` 嚴格檢查；MCP 入口仍由 Node 直接執行，避免 plugin entrypoint 引入額外 runtime。
- 目前已開啟的舊 Widget 實例仍可能持有舊版 bundle 與 timer；bridge 重啟不會清掉已在 Codex renderer 中執行的舊 JavaScript，需關閉／重新載入舊 task 或完整重啟 Codex 才能回收。

## 已完成驗證

- `npm run check`：通過。
- `npm run typecheck`：通過。
- `npm test`：11/11 通過（path、storage v2、immutable generations/assets、migration、recovery、prompt）。
- `npm run build`：Vite production build 通過。
- `npm run probe:mcp`：11 個 MCP tools、render tool、Widget resource 與 host bridge 通過。
- `npm run probe:mcp`：驗證 envelope、外層 head 注入位置、無 runtime loader／recurring pulse，Widget 2,863,529 bytes。
- `npm run probe:http`：Streamable HTTP `/mcp` 與 11 個 tools 通過。
- `npm run probe:widget`：Chrome headless 實際掛載 React/tldraw，並確認 tldraw icons，`mounted: true`, `iconsMasked: true`。
- hydration hotfix：直接讀取 `readCanvasState(..., { hydrateAssets: true })` 確認 image asset 會回傳 data URL，且 snapshot 保留 image shape。
- 10 秒 host harness：以 MCP Apps message bridge 載入 Widget，實際等待 10 秒後 `coart: true`、`tldraw: true`、`toolbar: true`、`loader: false`，page error 為 0，並輸出像素截圖。
- Codex 安裝快取：`coart@coart-public` v0.2.6 已以 `-ForceReinstall` 更新；快取內 `probe:mcp` 與 `probe:widget` 均通過，13 個交付檔案曾與來源 SHA-256 一致。

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
