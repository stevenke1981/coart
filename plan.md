# Coart 開發計畫

## Phase 0：Clean-room 基線

- 確立功能清單、命名、授權與不複製原碼原則。
- 建立 Codex plugin、MCP、React、tldraw 專案結構。

## Phase 1：可運行 MVP

- 原生 Widget render tool。
- Canvas snapshot、selection、view state。
- AI image / AI HTML / Slides slot。
- prompt 與參考圖送交 Codex。
- `insert_coart_image`、`insert_coart_html`。
- 標註多選匯出與 Slides viewer。

## Phase 2：可靠性

- per-page snapshot、manifest 與 page-local assets。
- asset lazy loading、checksum、備份與復原。
- tldraw schema migration。
- 影像刪除保護與衝突檢測。

## Phase 3：完整創作工作流

- HTML DOM 文字編輯與安全 sandbox。
- Slides 拖放排序、縮圖、圖片 slide、匯出 ZIP/PDF/PPTX。
- 批次多圖／多 HTML 生成與 placement engine。
- 可設定的 aspect presets 與 prompt templates。

## Phase 4：產品化

- Windows/macOS/Linux 安裝器。
- 自動更新、診斷工具、錯誤報告。
- i18n、無障礙、效能與大型畫布壓力測試。
