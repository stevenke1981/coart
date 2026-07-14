# Coart Lessons Log

## 2026-07-14 — 初始 clean-room 架構

- Cowart 的核心價值不是單純 tldraw UI，而是 Codex MCP Widget、host bridge、專案檔案儲存與 AI 工作流的組合。
- 將全部功能集中於大型 `App.jsx` 會提高回歸成本；Coart 從第一版即拆成 components、hooks、client bridge、storage 與 MCP server。
- tldraw snapshot 有「document store snapshot」與「editor document/session snapshot」兩種語意；Coart MCP 儲存契約統一使用 `store.getStoreSnapshot('document')`。
- 自訂 shape API 必須依目前 tldraw 主版本核對；indicator 使用 `getIndicatorPath`，可調整大小的 box shape 使用 `BaseBoxShapeUtil`。
- 原生 Widget 的 HTML 必須自包含並符合 CSP，因此建置流程需要 inline CSS/JS，資產則透過 MCP 讀取與 data URL hydration。
- 在未確認上游授權前，不複製原始碼、圖示、品牌或提示詞全文；以公開行為規格重新實作。

## 2026-07-14 — v0.2 reliability 與發布

- manifest 只有在被引用的 shared/page files 與可變 HTML assets 都採用不可變世代檔名時，才能真正作為原子提交點；只把 manifest 本身 atomic rename 仍可能讀到半套新資料。
- `coart-canvas.json` 可保留為相容回復副本，但有效 v2 manifest 的讀取不能先解析該副本，否則損壞的 fallback 會反過來拖垮健康的主要儲存。
- Codex 本機 plugin 使用 stdio MCP；ChatGPT Developer Mode 需要 Streamable HTTP `/mcp` 與公開 HTTPS。兩條 transport 必須各自有 smoke probe。
- 公開 repo 的 `package-lock.json` 不得保留特定環境的私有 registry `resolved` URL；替換 host 時必須保留版本與 integrity，然後重新安裝及驗證。
- Git marketplace 不保證替 Node MCP server 安裝依賴。Coart 的可靠安裝流程是 clone、鎖檔安裝與 quality gate 後，再註冊該本機 repo marketplace。
