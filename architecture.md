# Coart Architecture

## 邊界

```text
Codex host
  ↕ MCP Apps protocol
Widget bridge
  ↕ callServerTool / sendMessage
React + Fabric.js application
  ↕ JSON snapshot / data URLs
MCP server
  ↕ safe filesystem operations
<active-project>/canvas

External editor window (Chrome／Edge app mode)
  ↕ token-authenticated loopback HTTP
Coart standalone React + Fabric.js application
  ↕ JSON snapshot / data URLs
MCP storage layer
  ↕ safe filesystem operations
<active-project>/canvas
```

## 前端模組

- `App.tsx`：組合 Fabric.js、狀態載入、選取同步與面板。
- `FabricCanvas.tsx`：建立 Fabric.js canvas、縮放／平移／手繪、框線拖曳、文字編輯與瀏覽器生命週期。
- `CanvasToolbar.tsx`：建立 AI image、AI HTML、Slides slot、框線／文字工具與標註操作。
- `GenerationPanel.tsx`：prompt、參考圖、頁數與 follow-up message。
- `SlidesViewer.tsx`：讀取 Slides frame 的子 HTML shape 並播放。
- `SlidesViewer.tsx`：使用 `iframe srcDoc` 顯示單檔 HTML；畫布上的 HTML slot 以可編輯 Fabric 物件呈現。
- `coartClient.ts`：MCP bridge、standalone editor loopback API 與 localStorage fallback。
- `prompts.ts`：集中管理送給 Codex 的工作流提示詞。
- `fabricCanvas.ts`：Fabric 物件與 Coart `schema/store` 快照之間的轉換 facade。

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
