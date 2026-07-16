# Coart v0.2.8 Reliability Delivery

## 2026-07-16 Codex 右側面板模式修正

- 修正 `sidebar` 只寫入自訂偏好、卻沒有觸發 Codex host 面板切換的問題。
- Coart sidebar 現在映射到 MCP Apps 標準 `fullscreen` request；Widget 宣告 `inline`／`fullscreen`，Codex 可將畫布放在畫面右側面板。
- 明確 `displayMode: "inline"` 仍維持對話內嵌；`render_coart_canvas` 的 structured content 同時保留 `requestedDisplayMode` 與 `hostDisplayMode` 供診斷。
- 版本升至 `0.2.8`，避免 Codex／MCP widget cache 重用 v0.2.7 的舊 bridge。

### 本次驗證

- `npm run check`、`npm test`（17/17）、`npm run build`、`npm run probe:mcp`、`npm run probe:http` 與 `npm run probe:widget` 全部通過。
- `probe:mcp` 已驗證 sidebar 預設與明確 sidebar 都輸出標準 `hostDisplayMode: "fullscreen"`，明確 inline 維持 `hostDisplayMode: "inline"`；Codex Desktop 實際右側面板仍需重新安裝／重新載入 `coart@coart-public` v0.2.8，並在新的 task 呼叫 `render_coart_canvas` 做人工確認。

## 2026-07-16 Codex 任務側邊欄預設

- 將 MCP server instructions、Coart open-canvas skill 與 README 統一為 `render_coart_canvas` 的 `sidebar` 預設，讓 Codex 任務直接把畫布放在側邊欄。
- 保留明確 `displayMode: "inline"` 的對話內嵌路徑；sidebar 由標準 fullscreen host mode 實作。

## 2026-07-16 對話內圖片編輯與更新

- Generation／annotation controls 透過 MCP Apps `sendMessage` 直接把工作送入目前 Codex 對話，不再要求複製或貼回提示詞；畫布預設顯示於 Codex 任務側邊欄，明確要求時才使用 `displayMode: "inline"`。
- standalone editor 的 follow-up 改寫入 `canvas/coart-follow-up.json`，新增 FIFO `get_coart_pending_request`／`clear_coart_pending_request` 與 `/api/follow-up`；同一 project 的 enqueue／clear 以 mutex 序列化，讓使用者回到對話後以「繼續處理」取回指令，不需要剪貼簿。
- 新增 `update_coart_image`：對既有 image shape 建立新 project-local asset，保留 shape id、位置、顯示尺寸與舊資產，適合 Codex 直接回寫圖片修改結果。
- 更新 Coart image edit／generation／open canvas skills、README、MCP instructions 與 default prompt，明確要求 direct conversation workflow。

### 驗證與邊界

- `npm run quality` 通過：16/16 tests、TypeScript checks、Vite build、stdio／HTTP MCP probes 與 Chrome Widget smoke（`mounted: true`, `canvasReady: true`）。
- standalone follow-up 仍需要使用者回到對話後說「繼續處理」讓 Codex 讀取 pending request；這是 loopback app window 沒有 host message bridge 的安全邊界，但不再需要貼提示詞。

本交付在獨立 clean-room `coart` 專案上完成 v0.2 儲存與安裝可靠性升級，不依賴 Cowart 原始碼或品牌資產。

## 2026-07-16 文字物件停留修正

- 修正 Ferric 文字物件使用透明 common fill 的問題；文字編輯框關閉後，已提交的文字現在會以保存的 `props.fill` 留在畫布上。
- 文字編輯器進入時會選取目前內容，按 Enter 或失焦即可提交；Shift+Enter 保留換行，Ctrl/Cmd+Enter 仍可快速提交。
- 新建文字不再把「輸入文字」存成實際內容，改由 textarea placeholder 顯示；舊場景中的同名提示也會在編輯時自動清空。
- 文字仍是一般可選取、可移動與可 autosave 的 Coart shape，不會寫入瀏覽器以外的秘密或額外資產。

## 2026-07-16 分區式畫布操作介面

- 將原本會在窄視窗溢出的單列工具列改為 Coart 自有的分區式畫布 chrome：左上文件操作、右側物件樣式、底部創作工具與左下／窄視窗右上縮放控制。
- 底部工具列保留選取、平移、框線、AI 圖片比例與 slot、手繪、文字、AI HTML、Slides 與播放工作流；右側面板可直接調整填色、線色、不透明度、線型與粗細。
- 新增可用的選取物件複製／刪除與平移工具，Ferric scene 會保存新增的 `fill`、`stroke`、`strokeStyle`、`strokeWidth` 與 `opacity` 狀態。
- 控制列改以 viewport 固定定位，保留既有 640px intrinsic height 防白屏邊界，但在較矮的 standalone／Widget viewport 中仍能看見底部工具列。
- Chromium smoke 已驗證頂部文件列、右側樣式面板、底部 dock 與 pan／rectangle／text 工具均實際掛載且位置有效；`npm run quality` 全部通過（14/14 tests、typecheck、build、stdio／HTTP MCP probes 與 Widget smoke）。

### 介面邊界

- 目前仍是單頁工作流，左上「頁面 1」是目前頁面指示；多頁新增、排序與切換尚未實作。
- 樣式面板只修改已選取的 Ferric 物件，不會把偏好寫入 browser localStorage，也不會變更未選取或專案外資產。

## 2026-07-16 Ferric Canvas 重寫

- 前端畫布已由 Fabric.js 改為 Ferric Canvas `@ferric-canvas/web`：Rust WASM scene engine + trusted SVG renderer；Coart schema/store、MCP storage 與 project-local `canvas/` 資產格式維持相容。
- `src/lib/ferricCanvas.ts` 是 Coart facade，將 Coart records 映射到 Ferric Scene JSON，並以 metadata 保留原始 Coart id、props、meta、parent 與 index；`src/components/FerricCanvas.tsx` 負責 SVG scene、選取框、拖曳框線、手繪 preview、DOM textarea 文字編輯與 camera。
- Ferric web package 由 Ferric source revision `8eae06b8a61371f95ae7e916778ddc86c7829e1f` 建置後固定放入 `vendor/ferric-canvas/`，避免安裝時依賴未發佈的 npm 套件或即時 Rust toolchain。
- Chromium widget smoke 已更新為檢查 `.coart-ferric-shell`、`.coart-ferric-scene` 與 Ferric SVG；實際結果 `mounted: true`、`canvasReady: true`、PNG `12,109` bytes，畫面不再出現 tldraw production license overlay。
- 對 Ferric Canvas 的 mutation API、viewport contract、asset resolver、文字編輯協定、schema fixtures 與發佈流程建議已寫入 [`docs/ferric-canvas-feedback.md`](docs/ferric-canvas-feedback.md)。

### Ferric 邊界

- Ferric web API 目前沒有公開的 scene mutation transaction；Coart 結構性變更會重建 engine，輸入事件則透過 bridge 後同步回 Coart records。
- SVG renderer 只接受安全 raster data URL；Coart 會先 hydrate project-local image，其他 image reference 顯示安全 placeholder。
- Ferric package 目前以 vendor artifact 形式提交，升級時必須重新建置 WASM、dist 並更新 `vendor/ferric-canvas/source-revision.txt`。

## 2026-07-15 sidebar 預設與 MCP proxy 儲存失敗修正

- `render_coart_canvas` 未指定模式時現在要求 `sidebar`；明確指定 `inline` 仍可使用，舊 `fullscreen` 請求維持 inline fallback。
- MCP Apps SDK 只宣告標準 inline 能力，sidebar 以 Codex host 的放置偏好傳遞；避免非標準 `availableDisplayModes: ['inline', 'sidebar']` 讓 `ui/initialize` 失敗、造成畫布可見但保存 bridge 不可用。
- autosave 改成依序保存 snapshot、selection、view state，並以 `toolOutput`／`widgetData`／`toolInput` 多路恢復 `projectDir` 與 `canvasDir`，降低 `MCP error -32000`。
- 重新安裝前會保留既有 `D:\coart\canvas`；更新後須重開 Codex task 讓 stdio MCP 與 Widget cache 載入新版本。

## 2026-07-15 sidebar 與 Fabric 畫布直接編輯

- `render_coart_canvas` 現在保留 `inline` 穩定預設，並正式支援 `sidebar`；Widget bridge 宣告 `availableDisplayModes: ['inline', 'sidebar']`，舊 `fullscreen` 請求仍回退到 inline 以維持相容性。
- Fabric 畫布新增「框線」工具，可直接拖曳建立可選取、可移動與可調整大小的矩形框線。
- Fabric 畫布新增「文字」工具，點擊後立即建立可編輯的 IText；新增文字會自動選取全部內容，既有文字可直接雙擊編輯，文字內容會隨 autosave 保存。
- `scripts/probe-mcp.ts` 已加入 sidebar／fullscreen fallback 回歸檢查；Chromium widget smoke 仍驗證實際 Fabric canvas 掛載。

## 2026-07-15 Fabric.js 畫布遷移

- 因 tldraw SDK 的 production license gate 會在 inline 與 standalone bundle 顯示授權提示，前端已全面改用 Fabric.js；`package.json` 與 lockfile 已移除 `tldraw`／`@tldraw/assets`。
- `FabricCanvas` 與 `CoartFabricEditor` 現在提供選取、框架建立、手繪、縮放、平移、圖片載入、標註匯出與 autosave；MCP 既有 `schema/store` 快照格式維持相容，既有 `canvas/` 圖片不需搬移。
- inline Widget 與 Chrome／Edge standalone editor 使用同一份 Fabric.js bundle，避免兩種畫布模式行為分叉，也不再需要 tldraw asset/license 設定。
- `probe:mcp` 與 Chromium widget smoke 已改為驗證 `.coart-fabric-canvas` 實際掛載；本次 `npm run quality` 全部通過：13/13 tests、Node/frontend typecheck、build、stdio/HTTP probes 與 Chromium smoke，Widget `855,420` bytes，`mounted: true`、`canvasReady: true`。

### Fabric 邊界

- `coart-html` shape 在 Fabric 畫布上以可選取的 HTML slot placeholder 呈現；完整 HTML 仍由既有 Slides viewer 以 sandbox iframe 播放。
- Fabric.js 目前保存可編輯物件與原始 Coart records；若要加入 pixel-level crop／paint，仍需另建影像編輯工具層。

## 2026-07-15 外部編輯器視窗交付（後續由 2026-07-16 對話內流程補強）

- `open_coart_editor` 以 token 保護的 `127.0.0.1` loopback server 提供自包含 Coart 頁面，並由 Chrome／Edge app mode 開啟獨立視窗；目前預設開啟流程已改為 Codex 內的 `render_coart_canvas` inline Widget。
- standalone 頁面透過同一個 project-bound API 寫入 `<projectDir>/canvas/`；不依賴 Codex Desktop 的 MCP Apps inline renderer，也不會把專案檔案暴露成任意靜態檔案。
- `get_coart_latest_image` 與 `read_coart_asset` 會回傳標準 MCP image content，讓同一個 Codex task 能看見實際圖片並繼續對話。外部視窗的 follow-up 現在寫入 project-local pending request，由對話工具取回，不再使用剪貼簿。

### 邊界與後續

- 目前 standalone 視窗是 Fabric.js 畫布、圖片配置與標註編輯器，不是 Photoshop 類的 pixel-level crop／paint 編輯器；該項目已列入 `todos.md`。
- 已完成 server/API 與 Chromium mount smoke；尚未將 Chrome／Edge app-mode 的真實桌面視窗操作納入自動化 UI test，後續補 cross-platform launcher coverage。
- `install-local.ps1 -ForceReinstall` 的 quality gate 已通過，但本次 Codex 程序持有舊 plugin cache 鎖，Windows 拒絕替換 cache；plugin registry 仍指向 `D:\coart`。若新 task 仍讀不到更新後技能，完整退出 Codex Desktop 後重新執行該命令。

### 本次驗證

- `npm run quality`：通過；13/13 tests、Vite build、stdio MCP probe、Streamable HTTP probe 與 Chromium widget loader smoke 均通過。
- MCP probe：13 個 tools，Widget `ui://widget/coart/canvas-v0-2-7.html`，inline HTML `2,865,039` bytes。
- Widget smoke：`mounted: true`、`canvasReady: true`，Chrome 實際掛載 React/Fabric.js。

## 交付內容

- 可安裝的 Codex plugin manifest。
- MCP Native Widget server。
- React + Fabric.js 畫布。
- AI 圖片、AI HTML、AI Slides 與標註工作流。
- v2 manifest、per-page snapshot、shared records 與相容回復 snapshot。
- v1 snapshot 相容讀取與保存時遷移。
- asset checksum、引用與保護清單。
- stdio 與 Streamable HTTP 兩種 MCP transport。
- 公開 GitHub marketplace 與本機 Codex 安裝流程。
- 三個 Codex skills。
- 前端全面改為嚴格 TypeScript/TSX，集中 bridge、storage、prompt 與 Fabric/Coart record 型別。
- 低於 4 MiB 的直接自包含 Widget HTML，不在 runtime 重建 document。
- 以公開 Cowart 功能說明作 clean-room 對照，保留 Coart 自有名稱、schema、UI 文案與資產；差異化缺口已寫入 `todos.md`，未複製參考專案程式碼。
- 分析、架構、規格、計畫、TODO、測試、Agent 團隊、追蹤矩陣與啟動提示詞。

## 2026-07-14 畫布載入 hotfix

- 修正 Widget 在既有 snapshot 非同步 hydrate 完成前掛載 autosave 的競速。
- autosave 現在只會在 hydration 完成（或載入失敗已明確處理）後啟用，避免初始空白 store 覆蓋已保存的 image shape。
- 已恢復八駿圖分鏡素材至 `canvas/assets/eight-steeds-storyboard-16x9-fixed.png`，並確認 hydrated snapshot 會把圖片轉為 data URL。

## 2026-07-14 MCP Apps lifecycle hotfix

- 在 `app.connect()` 前註冊 `app.onteardown`，讓 Codex 切換對話送出的 `ui/resource-teardown` 得到合法回應，避免 Widget 被宿主留在白色空頁。
- `scripts/probe-widget-loader.ts` 會檢查生成的 Widget bridge 包含 teardown handler。

## 2026-07-14 v0.2.7 對話切換後消失修正

- 以 Cowart 公開 repository 的 Widget 行為做 clean-room 對照後，確認 Coart v0.2.6 關閉 MCP Apps SDK 的自動尺寸回報、並在 connect 後固定回報 720px；Cowart 讓 SDK 依實際 document 尺寸處理該協定。
- Coart 現在由 SDK 的 `autoResize` 以動畫幀節流及 `ResizeObserver` 回報實際寬高；移除 Coart 自行發出的固定高度通知。這讓 Codex 重新附著 detached webview、改變對話寬度或切回 task 時能拿到目前尺寸，而不是過期的 720px。
- manifest 與 Widget resource URI 升為 `0.2.7`，避免 Codex Desktop 沿用 v0.2.6 的已快取 bridge；保留 legacy URI 作為舊 tool result 相容入口。
- `probe:mcp` 會拒絕固定 height override 與 recurring layout pulse，並檢查 bridge 明確啟用 MCP Apps `autoResize`。

## 2026-07-14 v0.2.6 Codex Desktop Widget 白屏修正

- 實機重現確認不是 MCP bridge 中斷或 React/tldraw crash：畫面消失後 Widget 仍持續成功呼叫 `get_coart_canvas_state`／save tools，Crashpad 也沒有 renderer dump；留下的是 Codex 對話中的灰色 placeholder。
- Codex Desktop 26.707.9981 會把 MCP App `<webview>` 移到 detached portal，再由 placeholder 的 `ResizeObserver` 維持座標。宿主 log 在白屏期間連續回報 `ResizeObserver loop completed with undelivered notifications`，符合 portal webview 已存活但覆蓋座標／可見性失效。
- 舊 Widget 的 runtime gzip loader 會在 first paint 後整頁替換 `<head>`／`<body>`；舊版為嘗試修補宿主座標而加入的 2 秒 height pulse，更會讓已恢復對話持續觸發宿主 ResizeObserver。v0.2.6 已完全移除兩者，但當時改成固定 720px intrinsic height；v0.2.7 已以 SDK-managed automatic sizing 取代該暫時處理。
- tldraw 字型由 16 個檔案縮為 4 個 IBM Plex Sans variant，未使用的 provider embed icon 改為單一輕量 fallback；production JS 由約 3.94 MB 降至約 2.44 MB，最終 Widget HTML 由 decoded 約 4.36 MB 降至直接可載入的約 2.86 MB。
- Widget resource 改用版本化 URI `ui://widget/coart/canvas-v0-2-6.html`，同時保留 legacy URI 相容舊 tool result；Codex Desktop 僅宣告 inline，避免舊 fullscreen side-panel registration 把後續 render 導向不可見容器。
- `probe:mcp` 會拒絕 gzip loader、`DecompressionStream`、document rewrite 與 recurring layout pulse；`probe:widget` 以 Headless Chrome 實際掛載 React/tldraw 與驗證 icon mask。

## 2026-07-14 tldraw icon sprite 修正

- Widget build 會以本機 SVG source 解析每個 icon，為每個圖示建立不含 fragment 的單一 SVG `blob:` URL；這符合 tldraw 使用 CSS mask 的資產方式，也避開 MCP `data:` 文件的 fragment URL 被瀏覽器拒絕。
- `scripts/probe-mcp.ts` 會驗證 Widget bundle 包含 DOMParser、`createObjectURL` 與 SVG MIME path；`scripts/probe-widget-loader.ts` 另外在 Headless Chrome 確認 tldraw icon 實際取得 CSS mask URL，不需載入外部 icon 資源。

## 2026-07-14 Codex Desktop host 相容邊界

- 這次問題包含 Codex Desktop 本身的 restored-task／MCP App lifecycle 缺陷，並非 Coart 專案檔案損壞。相同 26.707 系列已有公開的 restored task 逐一啟動 plugin MCP、renderer 記憶體累積與 UI blank/reload 報告：<https://github.com/openai/codex/issues/32942>。
- 本機診斷曾觀察到 26 個 ChatGPT renderer 使用約 5.33 GiB working set；多次測試建立的舊 Widget 即使 bridge 已停止，仍可把 timer 留在 renderer。v0.2.6 移除 Coart 可控制的高風險來源，但 Codex 宿主是否回收已恢復任務的 webview/MCP process 仍需由上游修正。
- `scripts/install-local.ps1 -ForceReinstall` 會移除舊安裝並安裝 manifest 目前版本；本次已安裝至 `C:\Users\eda\.codex\plugins\cache\coart-public\coart\0.2.7`。
- 實際新 task 呼叫 `render_coart_canvas`（`projectDir: D:\coart`, `displayMode: inline`）後，resource read 與 Widget tools 均成功；v0.2.6 掛載後宿主 log 不再出現舊版每 2 秒成批的 ResizeObserver pulse error。

## 已知限制

- page asset lazy loading 尚未完成；目前讀取時會組合完整 snapshot。
- image record deletion protection 尚未提供刪除／回收流程；v2 manifest 先將現有資產標記為 protected，且沒有自動刪檔。
- Slides viewer 以 HTML slide 為主，圖片 slide 與完整匯出留待後續版本。
- Fabric.js 與 MCP ext-apps 版本更新時，可能需要調整 API 相容性。
- Production bundle 的主要 JS 約 2.44 MB；最終 Widget HTML 約 2.86 MB，直接經 MCP resource 傳送，不再使用 gzip/base64 runtime loader。4 MiB 是專案回歸防護線，不代表 Apps SDK 公布的固定限制。
- Widget 注入固定使用外層最後一個 `</head>`，主 bundle 使用 inline module timing，並以 single-bundle build 消除 `ui://` 資源無法追載的 lazy chunk。
- Headless Chromium smoke 已確認直接 HTML 實際掛載 `.coart-app`、Fabric canvas；Windows 在最後一次 host 驗收時拒絕桌面擷取（Win32 error 5），因此以 Codex host log、tool call continuity 與 headless 像素渲染交叉驗證，未把 `PrintWindow`（無法擷取 detached webview surface）的灰色 placeholder 當成失敗證據。
- `codex review --uncommitted` 對 53-file 初始 repo 的全量 review 在 184 秒逾時，未產生可用報告；改採針對 storage/manifest 提交協定的人工審查，並修正內容世代原子性與損壞 fallback 依賴問題。
- TypeScript 已涵蓋前端與 MCP/scripts/tests；前端 `tsc --noEmit` 嚴格檢查，Node 層由 `tsconfig.node.json` 檢查，MCP 入口由 Node type stripping 直接執行 `.ts`。
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
- v0.2.7 widget smoke：Chrome 在 15 秒 virtual-time interval 後輸出 26,817-byte PNG，實際畫面包含完整 tldraw canvas、工具列與色彩面板；probe 會驗證 screenshot 已生成。
- v0.2.7 Codex Desktop：完整退出並重開後，`render_coart_canvas(projectDir: D:\\coart, displayMode: inline)` 已載入 fingerprint build；Widget 維持超過 16 秒，resource URI 為 `ui://widget/coart/canvas-v0-2-7.html`。
- 目前機器的再現診斷：Codex Desktop `26.707.9981`／CLI `0.144.3` 的 `apps` 為 `true`，但 `enable_mcp_apps` 原本是 `under development / false`；這會造成 MCP tool 成功、resource probe 成功，卻不呼叫 `read-mcp-resource`、只顯示 JSON。已執行 `codex features enable enable_mcp_apps`，完整重啟 Desktop 後才能在同一宿主進行最終 inline 驗證。
- `scripts/install-local.ps1` 現在會在安裝前檢查 `enable_mcp_apps`，避免日後出現「安裝成功但只看到 JSON」的假成功；關閉時會直接給出啟用與重啟指令。
- hydration hotfix：直接讀取 `readCanvasState(..., { hydrateAssets: true })` 確認 image asset 會回傳 data URL，且 snapshot 保留 image shape。
- 10 秒 host harness：以 MCP Apps message bridge 載入 Widget，實際等待 10 秒後 `coart: true`、`tldraw: true`、`toolbar: true`、`loader: false`，page error 為 0，並輸出像素截圖。
- Codex 安裝快取：`coart@coart-public` v0.2.7 已以 `-ForceReinstall` 更新；快取內 `probe:mcp` 通過，manifest、Widget bridge、MCP probe 與 widget smoke script 均與來源 SHA-256 一致。

## 2026-07-14 inline Widget 零高度回授修正

- 以 MCP Apps message bridge 建立初始 iframe 高度為 0 的宿主 harness，重現了「先出現、再消失」：舊 CSS 讓 SDK 第一次回報 `height: 0`，宿主照協定把 iframe 設為 0，形成零高度回授。
- 修正 `src/styles.css`：`html`、`body`、`#root`、`.coart-app` 與 tldraw 直接子層 `.coart-app > .tl-container` 保留 640px intrinsic floor，讓 tldraw 的 `height: 100%` 有可解析的非零高度；沒有加入固定 720px override、手動 size notification 或 recurring timer。
- 修正 `mcp/lib/widget.ts`：Widget build 暫存路徑加入 `src`／build input fingerprint，避免同一個 `0.2.7` 版本沿用舊 `%TEMP%\coart-widget-0.2.7` bundle。
- `npm run quality` 已通過：check、typecheck、11/11 tests、build、MCP probe、HTTP probe、Chromium widget probe；host harness 於 15 秒內量到 `html/body/root/app/tldraw/canvas = 640px`，bridge error 為空，父 iframe 維持 640px。
- 實機 host 交叉檢查：`staticDir` 為 `...\coart-widget-0.2.7-3c9c513a6c14`；重開後近期實際 MCP/host log targets 的 556 筆紀錄中，`Transport closed`、`host error`、`resource-teardown`、renderer error 與 ResizeObserver error 均為 0。畫布 surface 在本次 16 秒觀察窗內維持於目前 inline task。

## 2026-07-14 全專案 TypeScript 遷移

- 將剩餘 JavaScript 全面改為 TypeScript：`mcp/**`、`scripts/**`、`tests/**`、`vite.config.ts`。
- Plugin entrypoint 由 `scripts/start-mcp.mjs` 改為 `scripts/start-mcp.ts`（`.mcp.json` 同步更新）。
- 新增 `tsconfig.node.json` 負責 Node 層 typecheck；前端維持 `tsconfig.json` 嚴格模式。
- `npm run check` 改為 `tsc -p tsconfig.node.json --noEmit`（Node 的 `node --check` 無法檢查 `.ts` 語法）。
- 執行模型：Node 22.6+ type stripping 直接執行 `.ts`，不引入 tsc emit 或額外 runtime 依賴。
- 已安裝 `@types/node`；MCP storage 以動態 tldraw JSON 邊界（`any` / `AnyRecord`）維持既有行為，未重寫業務邏輯。
- 驗證：`npm run check`、`npm run typecheck`、`npm test`（11/11）、`npm run build`、`probe:mcp`、`probe:http`、`probe:widget` 均通過。

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
