# Coart v0.2 Reliability Delivery

本交付在獨立 clean-room `coart` 專案上完成 v0.2 儲存與安裝可靠性升級，不依賴 Cowart 原始碼或品牌資產。

## 交付內容

- 可安裝的 Codex plugin manifest。
- MCP Native Widget server。
- React + tldraw 畫布。
- AI 圖片、AI HTML、AI Slides 與標註工作流。
- v2 manifest、per-page snapshot、shared records 與相容回復 snapshot。
- v1 snapshot 相容讀取與保存時遷移。
- asset checksum、引用與保護清單。
- stdio 與 Streamable HTTP 兩種 MCP transport。
- 公開 GitHub marketplace 與本機 Codex 安裝流程。
- 三個 Codex skills。
- 分析、架構、規格、計畫、TODO、測試、Agent 團隊、追蹤矩陣與啟動提示詞。

## 已知限制

- page asset lazy loading 尚未完成；目前讀取時會組合完整 snapshot。
- image record deletion protection 尚未提供刪除／回收流程；v2 manifest 先將現有資產標記為 protected，且沒有自動刪檔。
- Slides viewer 以 HTML slide 為主，圖片 slide 與完整匯出留待後續版本。
- tldraw 與 MCP ext-apps 版本更新時，可能需要調整 API 相容性。
- Production bundle 的主要 JS 約 5.6 MB；原生 Widget inline 後約 31.8 MB，v0.2 應評估拆包與縮減 host bridge 體積。
- 容器內 Chromium 即使開啟空白頁也會因系統限制逾時，因此本次沒有完成像素級瀏覽器截圖檢查；Vite build 與 MCP Widget resource probe 均已通過。
- `codex review --uncommitted` 對 53-file 初始 repo 的全量 review 在 184 秒逾時，未產生可用報告；改採針對 storage/manifest 提交協定的人工審查，並修正內容世代原子性與損壞 fallback 依賴問題。

## 已完成驗證

- `npm run check`：通過。
- `npm test`：11/11 通過（path、storage v2、immutable generations/assets、migration、recovery、prompt）。
- `npm run build`：Vite production build 通過。
- `npm run probe:mcp`：11 個 MCP tools、render tool、Widget resource 與 host bridge 通過。
- `npm run probe:http`：Streamable HTTP `/mcp` 與 11 個 tools 通過。
- Codex 安裝快取：`coart@coart-public` 已安裝，且從快取執行 stdio/HTTP probes 均通過。

## 建議第一個 Codex 實機驗證

```bash
npm install
npm run quality
```

接著 clone 並安裝本機 marketplace，開新 task 後呼叫：

```powershell
git clone https://github.com/stevenke1981/coart.git
cd coart
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```
