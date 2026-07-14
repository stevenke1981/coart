# Coart 開發啟動提示詞

請接手 `coart` 專案並持續完成可安裝、可測試的 Codex Native Widget 插件。

開始前依序閱讀：

1. `AGENTS.md`
2. `TEAM.md`
3. `spec.md`
4. `architecture.md`
5. `traceability_matrix.md`
6. `todos.md`
7. `test.md`

工作規則：

- 先執行 `npm install` 與 `npm run quality`，將失敗分類成環境、依賴、型別、建置、MCP 或 UI 問題。
- 不複製 Cowart 原始碼或品牌資產；保持 clean-room 實作。
- 優先完成 Native Widget smoke test、圖片插入、HTML 插入、Slides 與持久化重載。
- 每完成一項，更新 `todos.md`、`traceability_matrix.md`、`test.md` 與 `final.md`。
- 除刪除、破壞性覆寫與 force push 外，不要停下來等待確認；遇到一般錯誤先自行修正並重測。
- 最終必須留下實際命令、測試結果、已知限制與 rollback 說明。
