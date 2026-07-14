# Coart Architecture

## 邊界

```text
Codex host
  ↕ MCP Apps protocol
Widget bridge
  ↕ callServerTool / sendMessage
React + tldraw application
  ↕ JSON snapshot / data URLs
MCP server
  ↕ safe filesystem operations
<active-project>/canvas
```

## 前端模組

- `App.jsx`：組合 tldraw、狀態載入、選取同步與面板。
- `CanvasToolbar.jsx`：建立 AI image、AI HTML、Slides slot 與標註操作。
- `GenerationPanel.jsx`：prompt、參考圖、頁數與 follow-up message。
- `SlidesViewer.jsx`：讀取 Slides frame 的子 HTML shape 並播放。
- `CoartHtmlShapeUtil.jsx`：使用 `iframe srcDoc` 顯示單檔 HTML。
- `coartClient.js`：MCP bridge 與 localStorage fallback。
- `prompts.js`：集中管理送給 Codex 的工作流提示詞。

## MCP 模組

- `server.mjs`：工具 schema、註冊與回傳格式。
- `storage.mjs`：路徑、snapshot、資產、選取與視角狀態。
- `widget.mjs`：Vite build、資源 inline、MCP Apps bridge 與 CSP。

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

Codex plugin 使用 stdio MCP；ChatGPT Developer Mode 可透過 `npm run start:http` 啟動 Streamable HTTP `/mcp`，再以 HTTPS tunnel 暴露。

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
