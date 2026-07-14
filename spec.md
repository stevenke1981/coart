# Coart Product & Engineering Specification

## 目標

在 Codex 對話中提供一個原生、可持久化的無限畫布，讓使用者能以視覺方式安排 AI 圖片、HTML 與簡報頁面，並將選取位置、比例、參考圖與標註交給 Codex 執行。

## 非目標

- 不在前端保存模型 API key。
- 不綁定特定生圖服務。
- 不直接複製 Cowart UI、原碼、圖示或品牌。
- v0.1 不提供多人即時協作。

## 使用者故事

1. 我可以在目前專案開啟 Coart，重新開啟後畫布仍存在。
2. 我可以建立指定比例的 AI 圖片框，輸入 prompt 後讓 Codex 產圖並替換。
3. 我可以加入參考圖片，讓 Codex 取得專案內可讀的檔案路徑。
4. 我可以建立 16:9 AI HTML，讓 Codex 產生單檔 HTML 並嵌入。
5. 我可以建立 Slides 容器，要求 Codex 產生指定頁數，再播放內容。
6. 我可以多選圖片、箭頭與文字，匯出標註截圖要求修改。

## 功能需求

### Canvas

- 使用 tldraw。
- 支援 pan、zoom、draw、arrow、text、image 與 frame。
- 自動保存，debounce 700ms。
- 保存目前頁面與 camera。

### AI slots

- AI image 預設 3:4，可選 1:1、4:3、16:9、9:16。
- AI HTML 固定預設 1024×576。
- Slides 外框預設 1048×600。
- slot 使用 frame + `meta.coartKind`，結果使用一般 image 或 `coart-html` shape。

### Prompt bridge

- Widget 透過 MCP Apps `sendMessage` 發送 user follow-up。
- 參考圖片先以 MCP tool 保存，再把本機相對路徑寫入 prompt。
- prompt 必須包含目標 shape id、寬、高、比例、page id 與預期 MCP insertion tool。

### Storage

- 所有 canvas files 都在 active project `canvas/`。
- 寫入使用 temporary file + rename。
- 禁止 `..`、絕對路徑逃逸與未清理檔名。

### Security

- Widget shell 不載入外部資源。
- HTML shape 使用 sandbox iframe；預設只允許 scripts 與 forms，不允許 top navigation。
- HTML 資產不得直接讀任意本機檔案。

## 驗收標準

- `npm run check` 通過。
- `npm test` 通過。
- 安裝依賴後 `npm run build` 通過。
- Codex 中呼叫 `render_coart_canvas` 可顯示 Widget。
- 重新開啟 Widget 可還原 snapshot。
- 選取 AI image slot 後，skill 可取得尺寸並插入圖片替換 slot。
- HTML 可在 iframe 顯示，Slides 可切換與全螢幕。
