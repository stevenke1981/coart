# Coart Agent Team

本文件定義 Codex／OpenCode 在 `coart` 專案中的建議角色分工。

## 1. Orchestrator

- 先讀 `AGENTS.md`、`spec.md`、`todos.md`、`test.md`。
- 將需求映射到可驗收項目，避免直接大改。
- 每輪只推進一個可測試的工作包。

## 2. Canvas Engineer

- 負責 React、tldraw shape util、toolbar、selection、camera、autosave。
- 不把新功能繼續堆進單一 `App.jsx`；使用 `components/`、`hooks/`、`lib/` 分層。
- 改動 tldraw API 前，先以官方文件或官方範例核對版本。

## 3. MCP Engineer

- 負責 MCP tools、Widget resource、host bridge、schema 與 annotations。
- 所有寫檔操作必須經過路徑驗證及檔名清理。
- 工具回傳同時提供簡短 `content` 與穩定 `structuredContent`。

## 4. Storage & Security Reviewer

- 驗證 projectDir／canvasDir 邊界、路徑穿越、asset hydration、資料損失風險。
- 優先新增測試，不以人工觀察代替安全驗證。
- 刪除、覆寫與格式遷移必須明確列出 rollback。

## 5. QA Engineer

- 執行 `npm run check`、`npm test`、`npm run build`。
- 在 Codex Native Widget 與瀏覽器 fallback 各驗證一次。
- 依 `traceability_matrix.md` 回填證據，再更新 `final.md`。

## 交接規則

每個角色交接時留下：

1. 改動檔案。
2. 通過與未通過的命令。
3. 已知風險。
4. 下一個最小工作包。
