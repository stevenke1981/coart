# Coart Test Plan

## 靜態檢查

```bash
npm run check
```

檢查 MCP 與 scripts 的 JavaScript 語法。

## 單元測試

```bash
npm test
```

涵蓋：

- 專案與 canvas path 解析。
- 安全子路徑判斷。
- 檔名清理。
- data URL 解析。
- v2 manifest、per-page snapshot 與 asset checksum。
- v1 snapshot 遷移與不安全 page manifest 回復。
- standalone editor loopback state persistence、token authorization、pending follow-up queue 與 project-local latest image lookup。
- existing image shape update preserving shape identity and protected previous assets。
- 圖片／HTML／Slides prompt 是否包含 shape、尺寸與 MCP 插入工具契約。
- pointer scheduler 每 frame 合併、1000 點路徑簡化、typed event separation 與 serial persistence queue。
- context mode 與多選 mixed style value。

## Build

```bash
npm install
npm run build
```

預期產生 `dist/index.html` 與 assets。

## MCP smoke test

```bash
npm run probe:mcp
```

自動啟動 stdio MCP server、驗證 16 個工具、呼叫 render tool、列出並讀取版本化 Widget resource，確認 sidebar 預設映射到標準 fullscreen、明確 inline 保持 inline、Ferric Canvas SVG scene 已掛載且 host bridge 存在。

## HTTP MCP smoke test

```bash
npm run probe:http
```

自動啟動本機 Streamable HTTP `/mcp`、連線並驗證 16 個工具，覆蓋 ChatGPT Developer Mode 所需 transport。

## Standalone editor smoke test

`npm test` 會在暫存專案啟動 token-authenticated loopback editor server，確認 standalone HTML 可載入、未授權請求被拒絕，以及 state POST 後能從同一個 project-local `canvas/` 讀回變更。

手動驗收時，優先呼叫 `render_coart_canvas`（`displayMode: "inline"`），在對話內選取圖片並送出修改，使用 `update_coart_image` 回寫同一個 shape。若呼叫 `open_coart_editor`，回到對話後說「繼續處理」，再呼叫 `get_coart_pending_request`；成功處理後以 `clear_coart_pending_request` 清除，並用 `get_coart_latest_image` 驗證 MCP image content。

## 手動 UI

- 建立四種比例 AI image slot。
- 建立 AI HTML slot。
- 建立 Slides，插入至少三頁 HTML。
- 多選形狀執行「按標註修改」。
- 重開 Widget，確認形狀、camera 與 selection 可恢復。
- 測試深色／淺色 host theme。

## 2026-07-17 Ferric Canvas 改善驗證紀錄

工作目錄：`D:\\coart`

| 指令 | 結果 | 證據 |
| --- | --- | --- |
| `npm run check` | PASS | Node/MCP TypeScript check exit 0 |
| `npm test` | PASS | 23/23 tests passed |
| `npm run build` | PASS | Vite production build completed |
| `npm run probe:mcp` | PASS | 16 tools、`canvas-v0-3-0`、sidebar→fullscreen 與 inline assertions passed |
| `npm run probe:http` | PASS | Streamable HTTP `/mcp`、16 tools passed |
| `npm run probe:widget` | PASS | 本機 Chrome 真實互動、五種 viewport 與 500 shapes 壓力測試通過 |

Widget probe 覆蓋：建立與拖曳矩形、resize、rotate、undo/redo、框選、group/ungroup、copy/paste、中文文字、1000 點手繪、Space pan、wheel zoom、AI generation draft、圖片貼上／alt text／裁切、HTML DOM 編輯、多頁建立／切換、圖層面板與 minimap。Viewport 為 320×640、480×720、768×640、1024×768、1440×900；500 shapes 壓力頁互動期間完整 scene `loadScene 2→2`。

Coverage gap: Codex Desktop 的實際右側面板仍需在安裝目前版本、重開 Desktop／新 task 後人工確認；本機 probe 已驗證 Widget 本體與送出的標準 `fullscreen` request。

## 安全測試

- 以 `../outside.png` 作為檔名，確認被清理。
- 以 canvas 外的 asset URL 呼叫 read tool，確認拒絕。
- HTML 嘗試 top navigation，確認 sandbox 阻擋。
