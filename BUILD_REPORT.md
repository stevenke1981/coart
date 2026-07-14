# Coart v0.2.4 Build Report

日期：2026-07-14

## 驗證結果

| 驗證 | 結果 |
|---|---|
| MCP／script JavaScript syntax check | 通過 |
| TypeScript strict typecheck | 通過，`tsc --noEmit` |
| Node unit tests | 11/11 通過 |
| Vite production build | 通過，2644 modules transformed |
| MCP tools/list | 通過，共 11 個工具 |
| `render_coart_canvas` | 通過 |
| Widget resource list/read | 通過 |
| MCP Apps host bridge injection | 通過 |
| Widget compressed resource | 通過，2,806,326 bytes；4 MiB transport guard |
| Widget decoded HTML | 通過，4,307,181 bytes；Chrome 實際掛載 React/tldraw |
| Chromium widget loader smoke | 通過，`mounted: true`，無 loader marker 殘留 |
| Streamable HTTP `/mcp` | 通過，共 11 個工具 |
| Plugin manifest validator | 通過 |

## Build 輸出

- `dist/index.html`
- `dist/assets/style-*.css`
- `dist/assets/index-*.js`

主要 bundle 約 3.89 MB（gzip 約 2.01 MB），Vite 提示 chunk 大於 500 kB。Widget 以 gzip + base64 自包含 loader 傳輸，MCP resource 本身約 2.81 MB，瀏覽器解壓後約 4.31 MB；4 MiB 是本專案的回歸防護線，不是平台公布的限制。Vite 以單一 bundle 輸出，避免 `ui://` 資源在執行時追載第二個 lazy chunk。

## 本輪實際發現並修正

- `package-lock.json` 的 resolved URL 指向不可解析的內部 Artifactory；已只替換 registry host，保留版本與 integrity，公開環境可從 npmjs 安裝。
- plugin validator 發現 `interface.developerName` 缺漏；補齊後驗證通過。
- 原專案只有 stdio MCP，無法供 ChatGPT Developer Mode 連線；新增 Streamable HTTP `/mcp` 與自動 probe。
- v1 單檔 snapshot 缺少版本化提交點；新增 v2 manifest、per-page/shared files、checksum 與 canonical recovery。
- MCP widget 的第一個 `</head>` 可能是 tldraw 內嵌字串，不可用第一個 match 注入；改為外層最後一個 `</head>`。
- Vite 將主 bundle 放在 `<head>` 時，改以 inline module timing，確保 `#root` 建立後才掛載 React。
- 原先約 6 MB HTML 直接傳送會觸發 ChatGPT/Codex host 大小錯誤；改為 browser-native `DecompressionStream('gzip')` loader，並裁掉重複的 tldraw locale 資產，傳輸 envelope 降至約 2.81 MB。
- 前端已完成 `.tsx/.ts` 遷移，補上 bridge、MCP result、storage、prompt 與 tldraw custom shape 型別；MCP server 仍保留 `.mjs` 以維持 plugin entrypoint。

## 尚未完成的驗證

目前已完成 headless Chromium 的 DOM 掛載 smoke；尚未在 ChatGPT Developer Mode 實際註冊遠端 HTTPS app，也未做像素級截圖驗收。該 host-level 驗收仍需在登入中的桌面環境進行。
