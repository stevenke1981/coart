# Coart v0.2.1 Build Report

日期：2026-07-14

## 驗證結果

| 驗證 | 結果 |
|---|---|
| MCP／script JavaScript syntax check | 通過 |
| Node unit tests | 11/11 通過 |
| Vite production build | 通過，2696 modules transformed |
| MCP tools/list | 通過，共 11 個工具 |
| `render_coart_canvas` | 通過 |
| Widget resource list/read | 通過 |
| MCP Apps host bridge injection | 通過 |
| Widget inline HTML | 通過，約 6.05 MB；已加入 8 MiB 回歸防護 |
| Streamable HTTP `/mcp` | 通過，共 11 個工具 |
| Plugin manifest validator | 通過 |

## Build 輸出

- `dist/index.html`
- `dist/assets/style-*.css`
- `dist/assets/index-*.js`
- `dist/assets/sanitizeSvg-*.js`

主要 bundle 約 5.6 MB，Vite 提示 chunk 大於 500 kB。Widget HTML 曾因 `String.replace` replacement-string semantics 被錯誤放大到 31.8 MB；改用 replacement callback 後恢復約 6.05 MB。Apps SDK 官方文件沒有公布固定 HTML byte limit，因此保留 8 MiB regression guard。

## 本輪實際發現並修正

- `package-lock.json` 的 resolved URL 指向不可解析的內部 Artifactory；已只替換 registry host，保留版本與 integrity，公開環境可從 npmjs 安裝。
- plugin validator 發現 `interface.developerName` 缺漏；補齊後驗證通過。
- 原專案只有 stdio MCP，無法供 ChatGPT Developer Mode 連線；新增 Streamable HTTP `/mcp` 與自動 probe。
- v1 單檔 snapshot 缺少版本化提交點；新增 v2 manifest、per-page/shared files、checksum 與 canonical recovery。

## 尚未完成的驗證

容器中的 Chromium 對 `about:blank` 也會因 DBus／sandbox 環境限制逾時，所以未產出可靠 UI 截圖。請在 Windows 10 或一般 Linux 桌面環境進行 Native Widget 與瀏覽器 fallback 的視覺及互動驗收。
