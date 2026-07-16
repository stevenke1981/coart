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
2. 我可以在獨立 Coart 視窗編輯目前專案的畫布，並在同一個 Codex 對話讀回專案內圖片。
3. 我可以建立指定比例的 AI 圖片框，輸入 prompt 後讓 Codex 產圖並替換。
4. 我可以加入參考圖片，讓 Codex 取得專案內可讀的檔案路徑。
5. 我可以建立 16:9 AI HTML，讓 Codex 產生單檔 HTML 並嵌入。
6. 我可以建立 Slides 容器，要求 Codex 產生指定頁數，再播放內容。
7. 我可以多選圖片、箭頭與文字，匯出標註截圖要求修改。

## 功能需求

### Canvas

- 使用 Ferric Canvas WebAssembly engine 與受信任 SVG renderer；sidebar 預設 Widget 透過 MCP Apps 標準 fullscreen host mode 進入 Codex 右側面板，明確指定的 inline Widget 與外部 editor 共用同一個 Coart canvas facade。
- 支援 pan、zoom、draw、arrow、text、image、frame 與可拖曳建立的 rectangle 框線。
- 文字物件由 Ferric Scene renderer 顯示；新增後立即進入 Coart DOM editor，既有文字可直接雙擊修改，內容與位置會自動保存。
- 自動保存，debounce 700ms。
- Widget autosave 的 snapshot、selection、view state 寫入必須序列化，避免 MCP proxy 併發請求失敗。
- 保存目前頁面與 camera。

### AI slots

- AI image 預設 3:4，可選 1:1、4:3、16:9、9:16。
- AI HTML 固定預設 1024×576。
- Slides 外框預設 1048×600。
- slot 使用 frame + `meta.coartKind`，結果使用一般 image 或 `coart-html` shape。

### Prompt bridge

- Widget 透過 MCP Apps `sendMessage` 發送 user follow-up。
- standalone editor 透過 loopback API 保存狀態；沒有 host follow-up bridge 時，將 prompt 複製到剪貼簿，交由同一個 Codex task 繼續處理。
- 參考圖片先以 MCP tool 保存，再把本機相對路徑寫入 prompt。
- prompt 必須包含目標 shape id、寬、高、比例、page id 與預期 MCP insertion tool。

### External editor

- `open_coart_editor` 必須將 editor server 綁定至 `127.0.0.1`、固定 active project，並以 token 驗證 state、selection、view 與 reference API。
- `get_coart_latest_image` 與 `read_coart_asset` 對圖片必須回傳標準 MCP image content，並保留結構化 asset metadata。

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
- 呼叫 `open_coart_editor` 可開啟獨立視窗，且 snapshot／資產寫入 active project `canvas/`。
- 呼叫 `get_coart_latest_image` 可在同一個 Codex task 讀回 project-local image content。
- Codex 中呼叫 `render_coart_canvas` 可顯示 Widget。
- 重新開啟 Widget 可還原 snapshot。
- 選取 AI image slot 後，skill 可取得尺寸並插入圖片替換 slot。
- HTML 可在 iframe 顯示，Slides 可切換與全螢幕。
