# Ferric Canvas integration feedback

這份文件記錄 Coart 以 Ferric Canvas `8eae06b8a61371f95ae7e916778ddc86c7829e1f` 整合時遇到的實際介面需求，供 Ferric Canvas 後續改進。Coart 目前只使用 Ferric 的 WASM scene engine、`renderSvg()` 與 pointer/keyboard bridge；Coart 的持久化 schema 仍維持獨立格式。

## 優先建議

### 1. 提供 scene mutation / transaction API

目前 web facade 主要提供 `loadScene()`、`renderSvg()` 與輸入事件；新增、修改、刪除物件時，host 必須重新組合完整 Scene JSON、重新建立 WASM engine，再自行維持 selection 與物件 id 對照。對小型畫布可行，但每次文字編輯、圖片插入或拖曳同步都會增加序列化與 WASM 重建成本。

建議提供類似以下的 typed API：

```ts
engine.addObject(object)
engine.updateObject(id, patch)
engine.removeObject(id)
engine.setSelection(ids)
engine.transaction(() => { /* multiple scene changes */ })
```

每個 mutation 最好回傳結構化 diff 或單一 `scene_changed` effect，讓 React host 不必以整份 JSON 取代場景。

### 2. 明確定義 viewport 的 renderer contract

目前 `Scene.viewport` 可被 bridge 用於輸入座標映射，但 SVG renderer 的輸出仍以固定 `viewBox="0 0 width height"` 呈現。Coart 因此必須在 SVG 外層自行套用 CSS camera transform，並另外做 screen/world 座標換算。

建議二選一：

1. `renderSvg({ viewport })` 直接把 pan/zoom 反映到 `viewBox` 或 root transform。
2. 文件明確說明 renderer 刻意不套用 viewport，並回傳可直接套用的 viewport transform / viewBox。

同時建議補一組 pan、zoom、selection、pointer 的 browser fixture，避免不同 host 各自推導座標規則。

### 3. 圖片 asset resolver 與安全限制

目前 SVG renderer 對外部或不安全 image reference 會拒絕，實際 web host 需要先把 project-local `/assets/...` hydrate 成安全 raster data URL。這個安全預設是合理的，但 host 只能自行處理 asset 讀取、mime 檢查與資料 URL 轉換。

建議提供 allowlisted `assetResolver(assetRef)` 或 `resolveImageSource()` callback，並由套件統一執行：只允許指定來源、限制 mime、byte size 與像素尺寸，拒絕 SVG/script/外部網路 URL。這可保留安全邊界，也減少各 host 的重複實作。

### 4. 補齊文字編輯協定

目前 bridge 有 composition event 支援，但文字 caret、selection range、DOM input overlay 的生命週期仍由 host 自行處理。Coart 必須在 SVG 上方建立 `<textarea>`，再把文字結果寫回 Scene。

建議提供 `beginTextEdit(id)`、`updateText(id, value)`、`commitTextEdit()`、`cancelTextEdit()` 以及 caret/selection range 的 typed result，讓瀏覽器 host 可以一致支援雙擊、IME、鍵盤選取與 undo。

### 5. 穩定的跨語言 schema fixtures

Rust scene schema 與 TypeScript declaration 已能支援基本 rect、ellipse、line、path、text、image、group，但整合者仍需要自行猜測部分欄位的預設值與 image/path payload 形狀。建議在 repository 提供版本化 JSON fixtures，至少涵蓋：空 scene、旋轉/縮放、透明度、文字、data URL 圖片、group、path、selection 與 viewport。

每個 fixture 最好同時由 Rust renderer test 與 web package test 驗證，並在 schema 變更時提供 migration note。

## 發佈與開發體驗建議

- source checkout 目前需要先建立 WASM target、安裝 `wasm-pack`，再產生 `wasm/` 與 `dist/` 才能使用 web package。建議 CI 產生 release artifact，或提供一個單一 `npm run build:web` / `npm pack` 流程，讓 clone 後不必理解 Rust toolchain 細節。
- 建議把 `@ferric-canvas/web` 發佈到 npm，並在 README 說明 package 與 Rust source revision 的對應方式。
- 建議在 web package 加入一個最小的 `createEmptyScene()` helper，避免每個 host 重複撰寫 schema_version、size、background、viewport 的初始化 JSON。
- 建議公開 `sceneToSvg()` 或 `renderSvg({ width, height, viewport })` 的選項，並說明 SVG 是 trusted engine output；對 imported/custom SVG 的 sanitize 邊界則維持現有警告。
- 建議提供 browser smoke example，驗證 WASM 載入、`renderSvg()`、pointer bridge、IME composition 與 engine `free()`，方便整合者快速定位是資產、WASM、host CSP 或事件座標問題。

## Coart 目前的暫時性 workaround

- Coart 將 Coart shape id、原始 props/meta 與 parent/index 放入 Ferric object metadata，避免改變既有 `canvas/` snapshot 格式。
- Coart 在每次結構性變更後重建 Ferric engine；拖曳與鍵盤操作則先使用 bridge，再同步回 Coart records。
- Coart 只把 project-local raster image hydrate 成 data URL；其他 image reference 先呈現安全 placeholder，不會把任意路徑交給 renderer。
- Coart 以 DOM textarea 完成文字編輯，完成後再將文字內容 commit 回 scene 與 Coart snapshot。
