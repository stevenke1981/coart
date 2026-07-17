# Coart Architecture

## 邊界

```text
Codex host
  ↕ MCP Apps protocol
Widget bridge
  ↕ callServerTool / sendMessage
React + Ferric Canvas WASM/SVG application
  ↕ JSON snapshot / data URLs
MCP server
  ↕ safe filesystem operations
<active-project>/canvas

External editor window (Chrome／Edge app mode)
  ↕ token-authenticated loopback HTTP
Coart standalone React + Ferric Canvas WASM/SVG application
  ↕ JSON snapshot / data URLs
MCP storage layer
  ↕ safe filesystem operations
<active-project>/canvas
```

## 前端模組

- `App.tsx`：組合 Ferric canvas facade、狀態載入、選取同步與面板。
- `FerricCanvas.tsx`：掛載 Ferric Canvas SVG scene、暫態手勢層、框選、縮放／旋轉控制點、手繪 preview、文字編輯與瀏覽器生命週期。
- `CanvasToolbar.tsx`：第一層創作工具、文件操作、縮放選單與 shape／AI 建立入口。
- `ContextToolbar.tsx`：依一般、文字、圖片、AI 圖片、AI HTML、Slides 與混合選取切換的情境工具列。
- `GenerationPanel.tsx`：每個 shape 獨立的 prompt、參考圖、頁數與 follow-up draft。
- `CanvasStylePanel.tsx`：單選／多選樣式、mixed value 與 pin/collapse 狀態。
- `MediaInspector.tsx`：圖片 alt text、非破壞性裁切參數、替換與 raster crop。
- `HtmlEditorPanel.tsx`：sandbox live preview 與 HTML source／DOM 回寫。
- `LayerPanel.tsx`：物件選取、命名、群組與鎖定；`Minimap.tsx` 提供全頁概覽及 camera 導航。
- `SlidesViewer.tsx`：讀取 Slides frame 的子 HTML shape、縮圖拖曳排序與播放；情境工具列另提供自包含 HTML 匯出。
- `src/canvas/EventBus.ts`：文件、選取、相機、工具、互動與 render diagnostics 的型別化事件匯流排。
- `src/canvas/PointerScheduler.ts` 與 `path.ts`：每 frame 合併 pointer move、coalesced event 採樣、preview 上限與 RDP 路徑簡化。
- `src/canvas/PersistenceQueue.ts`：snapshot、selection、view 共用的序列化持久化佇列。
- `coartClient.ts`：MCP bridge、project target recovery、standalone editor loopback API 與 localStorage fallback。
- `prompts.ts`：集中管理送給 Codex 的工作流提示詞。
- `ferricCanvas.ts`：Ferric Scene JSON 與 Coart `schema/store` 快照之間的轉換 facade；records 是互動期間的唯一狀態來源，Ferric engine 透過 incremental transaction 同步 add／update／remove／reorder，並提供 history、clipboard、snap、group、page、Slides parenting/layout 與 media metadata 操作。

## 互動與持久化資料流

```text
raw pointer events
  → PointerScheduler（每個 animation frame 一次）
  → local transient gesture／preview
  → interaction commit
  → Coart records + history
  → Ferric incremental transaction sync
  → typed document event
  → SerialPersistenceQueue

selection event → throttle save
camera event    → debounce save
```

拖曳、縮放、旋轉、框選與手繪期間不重建 Ferric scene；提交時以增量 transaction 同步，取消互動則回復 transaction 前狀態。對齊會比較其他 shape 的邊緣／中心與 16px grid；拖入 Slides 容器後會更新 namespaced parent metadata。React UI 可以訂閱彙總事件更新介面，但 autosave 只接受分離的 document／selection／camera 事件，避免純縮放或選取變更誤寫完整 snapshot。

## MCP 模組

- `server.ts`：工具 schema、註冊與回傳格式。
- `editor.ts`：建立 token 保護的 loopback editor server，並以 Chrome／Edge app mode 開啟外部視窗。
- `storage.ts`：路徑、snapshot、資產、選取與視角狀態。
- `widget.ts`：Vite build、資源 inline、MCP Apps bridge 與 CSP。
- `scripts/start-mcp.ts`：stdio MCP entrypoint（Node 直接執行 TypeScript）。
- `tsconfig.json`：前端嚴格型別；`tsconfig.node.json`：MCP/scripts/tests Node 層 typecheck。

## 儲存格式

```text
canvas/
├─ coart-manifest.json
├─ coart-canvas.json
├─ coart-shared-<snapshot-hash>.json
├─ coart-selection.json
├─ coart-view-state.json
├─ pages/
│  └─ page-<page-hash>-<snapshot-hash>.json
└─ assets/
   ├─ generated-*.png
   ├─ reference-*.png
   └─ draft-*.html
```

`coart-manifest.json` 是 v2 原子提交點，列出內容世代化的 shared/page 檔、資產雜湊、引用與保護狀態。`coart-shared-<snapshot-hash>.json` 保存 document、asset 等跨頁記錄，每個 `pages/*.json` 保存單頁與其 shapes；`coart-canvas.json` 保留為相容與回復副本。若只有 v1 單檔 snapshot，讀取仍可運作，下一次保存會遷移到 v2。舊世代檔與資產不會被自動刪除，避免保存中斷或回復時遺失使用者內容。

圖片 asset 使用 `/assets/<name>`。Widget 載入時 MCP 會回傳 hydrated snapshot，將本機資產暫時轉為 data URL；磁碟上的 snapshot 仍維持相對 URL。

Codex plugin 使用 stdio MCP；`open_coart_editor` 另外建立只監聽 `127.0.0.1` 的短生命週期 editor server，將 standalone Widget 與固定的 `projectDir` 綁定，並以 token 驗證 state／selection／view／reference API。ChatGPT Developer Mode 可透過 `npm run start:http` 啟動 Streamable HTTP `/mcp`，再以 HTTPS tunnel 暴露；這是遠端 MCP 連線，與本機外部編輯器的 loopback bridge 分開。

MCP Widget 的預設放置語意是 Codex host sidebar；由於 MCP Apps 標準沒有 `sidebar` mode，Widget 初始化宣告標準 `inline`／`fullscreen`，並將 Coart 的 sidebar 請求映射到 `fullscreen`，讓 Codex 將畫布放入右側面板。Widget 會先保存 snapshot，再依序保存 selection 與 view，避免 proxy 併發寫入造成 `-32000`。

## 主要資料標記

```js
shape.meta.coartKind === 'ai-image'
shape.meta.coartKind === 'ai-html'
shape.meta.coartKind === 'slides'
shape.type === 'coart-html'
```

## 後續擴充點

- Provider adapter：OpenAI、Gemini、ComfyUI、本機模型。
- per-page snapshot 與 lazy asset read。
- Undo-aware server merge。
- 多人協作與 CRDT。
- PDF / PPTX export worker。
