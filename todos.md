# Coart TODO

## 已完成（v0.1 starter）

- [x] Clean-room 架構與授權說明
- [x] Codex plugin manifest 與 MCP 設定
- [x] React + Vite + Fabric.js 基礎畫布
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
- [x] tldraw -> Fabric.js 畫布遷移：inline 與 standalone 共用 canvas facade，保留 Coart schema/store 與 project-local assets
- [x] Fabric Widget 支援 inline／sidebar 顯示模式；保留 fullscreen 請求的 inline 相容 fallback
- [x] sidebar 成為 render 預設；標準 MCP Apps 初始化只宣告 inline，避免 host 專用 mode 造成 bridge handshake 失敗
- [x] autosave 序列化 snapshot／selection／view 寫入，並從 toolOutput、widgetData、toolInput 恢復 project target
- [x] Fabric 畫布框線拖曳工具與 IText 直接文字編輯（新增即進入編輯、既有文字可雙擊）
- [x] Widget hydration 完成前停用 autosave，避免初始空白快照覆蓋既有畫布
- [x] MCP Apps resource teardown handler，避免切換 Codex 對話時 Widget 進入白頁
- [x] 移除 runtime gzip／DOMParser document rewrite；將 Widget 壓至 4 MiB 以下並直接執行 inline module，避免 first paint 後重建 `<head>`／`<body>`。
- [x] （歷史 tldraw 版本）Widget production build 將 SVG sprite 拆成單一 icon 的 `blob:` URL；目前已由 Fabric.js 取代，不再打包該資產。
- [x] Codex Desktop v0.2.6 固定採 inline Widget，版本化 resource URI 並保留 legacy alias，避開 stale fullscreen side-panel registration。
- [x] 移除 recurring height pulse 與固定 720px size override；改由 MCP Apps SDK 的 `autoResize` 依文件實際尺寸回報，讓 Codex 在切換／還原對話後重新定位 detached webview。
- [x] （歷史 tldraw 版本）縮減自包含字型與 icon payload；目前 Fabric.js bundle 已移除 tldraw assets，Widget 約 853 KB。
- [x] Windows 本機安裝腳本加入 `-ForceReinstall` 與版本不符自動升級，可更新既有安裝快取至目前 manifest 版本。
- [x] Codex Desktop MCP Apps renderer gate 診斷：`enable_mcp_apps` 未啟用時，MCP/resource/Chrome probe 仍會成功但 Desktop 只顯示 JSON；已在本機啟用並補進 open-canvas skill。
- [x] `open_coart_editor` 外部 Chrome／Edge app 視窗、token 保護 loopback bridge 與固定 project-local `canvas/` 持久化。
- [x] `get_coart_latest_image`／`read_coart_asset` 回傳 MCP image content，讓同一個 Codex task 可以讀回實際圖片。
- [x] standalone editor API、最新圖片選取與 project-local storage unit tests。
- [x] 修正 inline iframe 初始高度 0 造成的 SDK `autoResize` 零高度回授：根節點與 Fabric.js canvas shell 保留 intrinsic floor，並以 host harness 驗證 15 秒內 canvas 高度維持 640px。
- [x] Widget build 暫存路徑加入 source fingerprint，避免同一個 v0.2.7 版本重用舊 `%TEMP%` bundle。
- [x] 完整退出並重開 Codex Desktop、開新 task，驗證 `canvas-v0-2-7` 至少 16 秒持續可見，且沒有 `Transport closed` 或 host error。

## 下一版（v0.2）

- [x] 安裝 preflight 檢查 `codex features list` 的 `enable_mcp_apps`，在宿主旗標關閉時顯示可操作錯誤與重啟提示。
- [ ] page asset lazy loading
- [ ] HTML DOM 文字編輯器（不包含 Fabric 畫布上的一般文字物件）
- [ ] 圖片 slide 與混合 deck
- [ ] Slides 拖放排序
- [ ] 多格式 export（ZIP/PDF/PPTX）
- [ ] image record deletion protection
- [ ] Playwright Widget UI 測試（目前已有可移植 Chromium headless smoke）
- [ ] Chrome／Edge standalone editor app-mode UI smoke 與跨平台 launcher coverage
- [ ] standalone bitmap crop／paint editor（目前外部視窗提供 Fabric.js 畫布、圖片配置與標註流程）

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
- [x] MCP/storage/scripts/tests 全面改為 `.ts`；Node 22.6+ 直接執行（type stripping），`tsconfig.node.json` 負責 Node 層 typecheck；plugin entrypoint 改為 `scripts/start-mcp.ts`
