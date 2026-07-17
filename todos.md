# Coart TODO

## 已完成（v0.1 starter）

- [x] Clean-room 架構與授權說明
- [x] Codex plugin manifest 與 MCP 設定
- [x] React + Vite + Ferric Canvas WebAssembly／SVG 基礎畫布
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
- [x] tldraw -> Fabric.js -> Ferric Canvas 畫布遷移：inline 與 standalone 共用 Coart facade，保留 Coart schema/store 與 project-local assets
- [x] Ferric Widget 支援 inline／sidebar 語意；sidebar 映射為 MCP Apps 標準 fullscreen，讓 Codex 放入右側面板
- [x] sidebar 成為 render 預設；Widget 初始化宣告標準 inline／fullscreen，避免把 host 專用 mode 傳入 MCP Apps schema
- [x] autosave 序列化 snapshot／selection／view 寫入，並從 toolOutput、widgetData、toolInput 恢復 project target
- [x] Ferric SVG scene 框線拖曳工具與 Coart DOM 文字編輯（新增即進入編輯、既有文字可雙擊）
- [x] Widget hydration 完成前停用 autosave，避免初始空白快照覆蓋既有畫布
- [x] MCP Apps resource teardown handler，避免切換 Codex 對話時 Widget 進入白頁
- [x] 移除 runtime gzip／DOMParser document rewrite；將 Widget 壓至 4 MiB 以下並直接執行 inline module，避免 first paint 後重建 `<head>`／`<body>`。
- [x] （歷史 tldraw 版本）Widget production build 將 SVG sprite 拆成單一 icon 的 `blob:` URL；目前 Ferric Canvas 不需要該資產。
- [x] Codex Desktop v0.2.6 固定採 inline Widget，版本化 resource URI 並保留 legacy alias，避開 stale fullscreen side-panel registration。
- [x] 移除 recurring height pulse 與固定 720px size override；改由 MCP Apps SDK 的 `autoResize` 依文件實際尺寸回報，讓 Codex 在切換／還原對話後重新定位 detached webview。
- [x] （歷史 tldraw 版本）縮減自包含字型與 icon payload；目前 Ferric Canvas bundle 已移除 tldraw/Fabric runtime assets。
- [x] Windows 本機安裝腳本加入 `-ForceReinstall` 與版本不符自動升級，可更新既有安裝快取至目前 manifest 版本。
- [x] Codex Desktop MCP Apps renderer gate 診斷：`enable_mcp_apps` 未啟用時，MCP/resource/Chrome probe 仍會成功但 Desktop 只顯示 JSON；已在本機啟用並補進 open-canvas skill。
- [x] `open_coart_editor` 外部 Chrome／Edge app 視窗、token 保護 loopback bridge 與固定 project-local `canvas/` 持久化。
- [x] `get_coart_latest_image`／`read_coart_asset` 回傳 MCP image content，讓同一個 Codex task 可以讀回實際圖片。
- [x] standalone editor API、最新圖片選取與 project-local storage unit tests。
- [x] 修正 inline iframe 初始高度 0 造成的 SDK `autoResize` 零高度回授：根節點與 Ferric SVG scene shell 保留 intrinsic floor，並以 Chromium smoke 驗證畫布高度維持 640px。
- [x] Widget build 暫存路徑加入 source fingerprint，避免同一個 v0.2.7 版本重用舊 `%TEMP%` bundle。
- [x] 完整退出並重開 Codex Desktop、開新 task，驗證 `canvas-v0-2-7` 至少 16 秒持續可見，且沒有 `Transport closed` 或 host error。
- [x] 畫布 UI 改為分區式操作介面：左上文件列、右側樣式面板、底部創作工具列與獨立縮放控制，並支援實際平移、樣式、複製與刪除操作。
- [x] 修正文字 shape 的透明填色，讓文字編輯提交後仍停留在 Ferric 畫布並可重新選取；Enter／失焦提交、Shift+Enter 換行。
- [x] 文字工具將「輸入文字」改為編輯器 placeholder，避免提示文字在輸入時被當成內容保留；相容既有提示 shape。
- [x] Widget 內 follow-up 直接送入 Codex 對話；standalone editor 改以 project-local pending request 佇列取代剪貼簿。
- [x] `get_coart_pending_request`／`clear_coart_pending_request` 工具與 token-protected `/api/follow-up` bridge。
- [x] `update_coart_image` 保留既有 image shape 的 id、位置與尺寸，並保留舊資產供回復。
- [x] AI 圖片框提供 4:3、3:4、9:16、16:9 與 1:1 比例預設，建立時預設保存 2K 解析度。
- [x] AI 圖片生成面板支援 2K／4K 解析度選擇，prompt 帶出比例與對應像素尺寸。

## 已完成（Ferric Canvas 互動與效能改善）

- [x] pointer move 以 animation frame 合併，支援 coalesced events、append-only draw buffer、preview 上限與 RDP 簡化
- [x] 拖曳、縮放、旋轉與框選採 local transient layer，互動結束才同步 Ferric engine
- [x] typed document／selection／camera／tool／interaction／render 事件與分離 autosave 節流
- [x] undo/redo、clipboard、duplicate/delete、layer、lock、fit/selection zoom 與鍵盤快捷鍵
- [x] 八方向 resize、rotate handle、框選、多選與 mixed style values
- [x] 第一層工具列、情境工具列、生成面板、參考圖縮圖與 responsive style panel
- [x] Playwright 使用本機 Chrome 的真實 Widget 互動、五種 viewport 與 500 shapes 壓力驗收
- [x] `canvas/` ignore 規則限縮為根目錄 `/canvas/`，確保 `src/canvas/` 來源可追蹤

## 已完成（v0.3 Ferric Canvas 創作工作流）

- [x] 同步 Ferric Canvas `a3e7403` 並改用 incremental add／update／remove／reorder transaction
- [x] snap guides、圖片拖放／貼上／裁切／替換／alt text、箭頭／線條／便條／橡皮擦與基本形狀
- [x] group／ungroup、lock、前後層、多頁新增／切換／排序、圖層面板與物件命名
- [x] Slides 子物件拖入、縮圖排序、自動 layout、情境式 HTML 匯出與播放
- [x] HTML runtime 直接互動、sandbox preview 與 DOM source 編輯
- [x] zoom-to-fit、zoom-to-selection 與 minimap

## 下一版

- [x] 安裝 preflight 檢查 `codex features list` 的 `enable_mcp_apps`，在宿主旗標關閉時顯示可操作錯誤與重啟提示。
- [ ] page asset lazy loading
- [x] HTML DOM 文字編輯器（不包含 Ferric 畫布上的一般文字物件）
- [ ] 圖片 slide 與混合 deck
- [x] Slides 拖放排序
- [ ] 多格式 export（ZIP/PDF/PPTX）
- [ ] image record deletion protection
- [x] Playwright Widget UI 測試（使用本機 Chrome，覆蓋拖曳、resize、rotate、undo/redo、框選、clipboard、中文、長筆跡、pan、zoom 與生成 draft）
- [ ] Chrome／Edge standalone editor app-mode UI smoke 與跨平台 launcher coverage
- [x] standalone／Widget bitmap crop editor（非破壞性參數並可輸出替換來源；尚未包含自由筆刷 paint）

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
