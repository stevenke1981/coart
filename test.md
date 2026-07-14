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
- 圖片／HTML／Slides prompt 是否包含 shape、尺寸與 MCP 插入工具契約。

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

自動啟動 stdio MCP server、驗證 11 個工具、呼叫 render tool、列出並讀取 `ui://widget/coart/canvas.html`，同時確認 Widget 已 inline 且 host bridge 存在。

## HTTP MCP smoke test

```bash
npm run probe:http
```

自動啟動本機 Streamable HTTP `/mcp`、連線並驗證 11 個工具，覆蓋 ChatGPT Developer Mode 所需 transport。

## 手動 UI

- 建立四種比例 AI image slot。
- 建立 AI HTML slot。
- 建立 Slides，插入至少三頁 HTML。
- 多選形狀執行「按標註修改」。
- 重開 Widget，確認形狀、camera 與 selection 可恢復。
- 測試深色／淺色 host theme。

## 安全測試

- 以 `../outside.png` 作為檔名，確認被清理。
- 以 canvas 外的 asset URL 呼叫 read tool，確認拒絕。
- HTML 嘗試 top navigation，確認 sandbox 阻擋。
