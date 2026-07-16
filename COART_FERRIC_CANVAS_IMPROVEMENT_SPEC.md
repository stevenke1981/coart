# Coart 使用 Ferric Canvas 改善規格

**文件版本**：v1.0
**日期**：2026-07-17
**適用專案**：`stevenke1981/coart`
**用途**：提供 Codex／OpenCode／開發團隊直接執行的改善規格。
**主要目標**：保留 Coart 的 clean-room、MCP、專案本地資產與 Ferric trusted renderer，同時改善畫布手感、操作直覺與可維護性。

---

# 1. 現況摘要

Coart 目前採用：

```text
React
  ↓
CoartFerricEditor facade
  ↓
Ferric Canvas WASM engine
  ↓
完整 SVG renderer
  ↓
dangerouslySetInnerHTML
```

主要優點：

- Coart schema 與 Ferric engine 解耦。
- 使用可信任 SVG renderer。
- MCP Widget、sidebar、standalone 共用前端。
- 專案資料保存在 `<project>/canvas/`。
- 已支援 AI Image、AI HTML、Slides、標註與資產回寫。

主要問題：

1. pointer move 路徑過重。
2. 結構變更需重建 Ferric engine。
3. SVG 常以完整字串重新渲染。
4. document、selection、camera、tool 共用 change event。
5. autosave 可能被非文件變更觸發。
6. 手繪每次 pointer move 複製完整點陣列。
7. 固定工具列與固定右側面板占用 sidebar 空間。
8. 缺少 resize、rotate、marquee、snap、history 等標準畫布能力。
9. 情境操作不足，使用者需要自行判斷選取物件可執行的動作。
10. 部分 UI 看似可操作但尚未實作，例如頁面下拉。

---

# 2. 目標架構

建議採用雙層模式：

```text
Coart Interaction Layer
  - pointer scheduler
  - transient transforms
  - selection overlay
  - context toolbar
  - keyboard shortcuts
  - autosave policy

Ferric Canvas
  - trusted scene model
  - hit test / transform（Ferric 補齊後）
  - SVG export
  - image export
  - scene validation

Coart Storage
  - Coart schema v2+
  - MCP bridge
  - project-local assets
  - page / selection / view persistence
```

短期在 Ferric API 尚未補齊前：

```text
Local Interactive Draft State
  ↓ pointer up / operation commit
Coart Records
  ↓ low-frequency sync
Ferric Scene
  ↓ trusted render/export
```

也就是：

- 拖曳期間只更新 local transient transform。
- pointer up 後才正式寫回 records。
- 不在每個 pointer move 呼叫完整 Scene reload。
- Ferric 優先負責可信任輸出，不承擔尚未成熟的高頻 DOM 更新。

---

# 3. P0：立即改善卡頓

## 3.1 Pointer Move 改為 rAF Queue

修改：

- `src/components/FerricCanvas.tsx`

新增：

```ts
const pendingPointerRef = useRef<PointerSample | null>(null)
const frameRef = useRef<number | null>(null)

function schedulePointerMove(sample: PointerSample) {
  pendingPointerRef.current = sample
  if (frameRef.current !== null) return

  frameRef.current = requestAnimationFrame(() => {
    frameRef.current = null
    const latest = pendingPointerRef.current
    pendingPointerRef.current = null
    if (!latest) return
    processPointerMove(latest)
  })
}
```

要求：

- 每 frame 最多一次 move update。
- 手繪使用 `getCoalescedEvents()`。
- unmount 時 cancelAnimationFrame。
- pointer up 前先 flush 最後一筆 move。
- pointer cancel 清除 pending state。

### 驗收

- 快速拖曳時不會累積 event backlog。
- selection overlay 不會落後 pointer 多個 frame。
- 120Hz 輸入仍維持穩定。

---

## 3.2 手繪資料改用 Ref

目前不應每次執行：

```ts
const next = [...interaction.points, nextPoint]
```

改為：

```ts
const drawPointsRef = useRef<CanvasPoint[]>([])
const [drawRevision, setDrawRevision] = useState(0)
```

操作：

- pointer down：清空並加入第一點。
- pointer move：`push()`。
- 每個 frame 增加一次 drawRevision。
- preview 只取必要點。
- pointer up 進行 path simplify 後建立正式 shape。

加入：

- 最小距離門檻，例如 world space 1.5–3px。
- Ramer–Douglas–Peucker 簡化。
- 最大 preview points 上限。
- pointer pressure 預留欄位。

---

## 3.3 Change Event 分流

修改 `EditorLike`：

```ts
interface EditorChangeMap {
  document: DocumentChangeEvent
  selection: SelectionChangeEvent
  camera: CameraChangeEvent
  tool: ToolChangeEvent
  transient: TransientChangeEvent
}

editor.on('document', listener)
editor.on('selection', listener)
editor.on('camera', listener)
editor.on('tool', listener)
editor.on('transient', listener)
```

禁止：

- camera 改變觸發完整 snapshot 保存。
- selection 改變觸發 Ferric scene reload。
- tool 改變觸發 autosave。
- viewport resize 觸發 document save。

---

## 3.4 Autosave 重構

修改：

- `src/hooks/useAutosave.ts`
- `src/lib/coartClient.ts`

策略：

### Document

- 監聽 `document`。
- debounce 700–1000ms。
- pointer up／transaction complete 後才保存。
- 儲存鏈保持 serial。
- 記錄 document revision。
- 保存完成後只在失敗時顯示 toast。

### Selection

- 監聽 `selection`。
- throttle 150–250ms。
- 只保存 ID 與必要摘要。
- 不包含重複完整 shape payload，除非 MCP 工具確實需要。

### View

- 監聽 `camera`。
- debounce 300–500ms。
- widget teardown 時 flush。
- 不影響 document dirty state。

### 驗收

- pan 10 秒不會連續保存完整 snapshot。
- drag 過程不保存，pointer up 後保存一次。
- snapshot、selection、view 仍維持 MCP proxy 串行呼叫。
- 儲存失敗可重試，且不丟失較新 revision。

---

## 3.5 移除互動期間的完整 `loadScene()`

修改：

- `src/lib/ferricCanvas.ts`

新增狀態：

```ts
private transientTransforms = new Map<string, TransientTransform>()
private documentRevision = 0
private renderRevision = 0
```

短期策略：

- engine pointer move 回傳 transform 時，不立即同步完整 `sceneJson()`。
- React overlay 直接顯示 transient bounds。
- pointer up 才從 engine 同步受影響物件。
- style slider 連續變更使用 preview，停止操作後 commit。
- create/delete/duplicate 可排隊，但不得與 pointer move 交錯重建 engine。

若 Ferric 尚未提供 incremental mutation：

- 結構性操作才允許 queueReload。
- queueReload 前後保留 selection、camera。
- queueReload 合併同一 microtask／frame 內多次請求。
- 已排隊但尚未執行的 reload 應使用最新 Scene，不逐筆重建。

---

# 4. P1：改善操作直覺

## 4.1 工具列重新分類

目前底部工具過多，建議改成：

### 第一層

```text
選取｜手掌｜文字｜手繪｜形狀｜AI
```

### 形狀 popover

```text
矩形｜圓形｜線條｜箭頭｜便條｜Frame
```

### AI popover

```text
AI 圖片｜AI HTML｜AI Slides
```

### 更多

```text
匯入圖片｜匯出｜頁面｜設定
```

固定工具列不應同時出現：

- 標註兩次。
- Slides 播放兩次。
- 漢堡與三點共同控制同一選單。
- 尚未完成的頁面 dropdown。

---

## 4.2 新增 Context Toolbar

新增：

- `src/components/ContextToolbar.tsx`

依選取物件顯示：

### 一般形狀

- fill。
- stroke。
- line width。
- opacity。
- duplicate。
- delete。
- lock。
- layer order。

### 文字

- font size。
- weight。
- color。
- alignment。
- edit text。

### Image

- crop。
- replace。
- download。
- alt text。
- 按標註修改。
- 產生 HTML。

### AI Image Holder

- aspect ratio。
- resolution。
- generate。
- replace holder。

### AI HTML

- edit DOM。
- export HTML。
- export image。
- 按標註修改。
- 按標註生圖。

### Slides

- play。
- export。
- add page。
- reorder。
- generate pages。
- annotate。

位置：

- 優先顯示在 selection bounds 上方。
- 不足空間時顯示在下方。
- sidebar 太窄時改成 bottom sheet。

---

## 4.3 右側 Style Panel 按需出現

現況不應永久占用右側 192px。

規則：

- 無選取：隱藏。
- 單選：顯示該類型屬性。
- 多選：顯示共同屬性。
- 選取 AI 物件且生成面板開啟：style panel 折疊。
- 小於 700px：bottom sheet。
- 使用者可 pin。
- panel 狀態保存在 local UI settings，不寫入 project snapshot。

修正多選：

- App 不應只保存 `selectedShape`。
- 改為 `selectedShapes`。
- style update 可套用多個 shape。
- mixed value 顯示「—」。

---

## 4.4 AI Generation Panel 改成情境面板

修改：

- `src/components/GenerationPanel.tsx`

要求：

- 根據選取物件 screen bounds 定位。
- prompt 可使用 Ctrl/Cmd+Enter 送出。
- prompt 欄可直接貼上剪貼簿圖片。
- 參考圖顯示 thumbnail。
- 每個 shape 保留未送出的 draft prompt。
- Escape 關閉但不清空 draft。
- 點擊外部關閉。
- 上傳最多張數顯示明確。
- 送出中鎖定重複 submit。
- failure 保留 prompt 與 reference。
- Slides 頁數使用 3／5／10／自訂。

---

## 4.5 移除假操作

### 頁面按鈕

在多頁功能完成前：

- 改成純文字「頁面 1」。
- 移除 Chevron。
- 移除 button hover。
- 不提供無功能 dropdown。

### 手動儲存

自動儲存正常時：

- 將手動儲存放入更多選單。
- 頂部顯示簡潔狀態：已儲存／儲存中／失敗。
- 成功不跳 toast。

---

# 5. P1：標準畫布能力

## 5.1 Selection Handles

新增 overlay：

- 8 個 resize handles。
- rotate handle。
- selection bounds。
- hover bounds。
- multi-selection bounds。
- locked indicator。

新增 API：

```ts
editor.getSelectionBounds()
editor.beginResize(handle, pointer)
editor.updateResize(pointer)
editor.commitResize()
editor.cancelResize()

editor.beginRotate(pointer)
editor.updateRotate(pointer)
editor.commitRotate()
```

短期可由 Coart overlay 實作，Ferric 補齊後改由 engine。

---

## 5.2 Marquee Selection

Select 工具空白處 pointer down：

- 建立 marquee。
- pointer move 更新 rect。
- pointer up hit-test。
- Shift 為 additive。
- Alt 可預留 subtractive。

---

## 5.3 Keyboard Shortcuts

必須支援：

| 快捷鍵 | 功能 |
|---|---|
| Space | 暫時 hand tool |
| V | Select |
| H | Hand |
| R | Rectangle |
| T | Text |
| D | Draw |
| Delete / Backspace | Delete |
| Ctrl/Cmd+D | Duplicate |
| Ctrl/Cmd+C | Copy |
| Ctrl/Cmd+V | Paste |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z | Redo |
| Arrow | Nudge 1 |
| Shift+Arrow | Nudge 10 |
| 0 | Zoom to fit |
| 1 | 100% |
| F | Zoom to selection |
| Escape | Cancel／clear selection |

文字編輯與表單 focus 時不得攔截一般文字快捷鍵。

---

## 5.4 Zoom 與 Pan

修正：

- wheel normalization。
- trackpad 連續縮放。
- Ctrl+wheel／pinch。
- zoom at cursor。
- middle mouse pan。
- Alt pan 可保留，但 Space 為主要方式。
- fit selection。
- fit content。
- reset zoom。

Zoom control 改成：

```text
[-] 100% [+] ▾
```

dropdown：

- Fit。
- Selection。
- 50%。
- 100%。
- 200%。

---

## 5.5 Snapping

短期由 Coart 實作：

- grid。
- edges。
- centers。
- equal spacing。
- snap guides。
- Shift 暫時停用 snap。

長期移入 Ferric core。

---

# 6. P2：功能對齊

依序補齊：

1. Ellipse。
2. Line。
3. Arrow。
4. Note。
5. Eraser。
6. Frame。
7. Image drag/drop。
8. Clipboard image paste。
9. Image crop。
10. Group／ungroup。
11. Lock／unlock。
12. Layer order。
13. Pages。
14. Layers panel。
15. Minimap。
16. Slides child drag/drop。
17. Slides reorder。
18. HTML DOM editing。
19. Multi-format export。

---

# 7. 建議程式模組拆分

```text
src/
├─ canvas/
│  ├─ CoartEditor.ts
│  ├─ EventBus.ts
│  ├─ HistoryManager.ts
│  ├─ PointerScheduler.ts
│  ├─ SelectionManager.ts
│  ├─ TransformManager.ts
│  ├─ ViewportManager.ts
│  ├─ ClipboardManager.ts
│  ├─ SnapManager.ts
│  └─ ferric/
│     ├─ FerricAdapter.ts
│     ├─ FerricSceneMapper.ts
│     ├─ FerricRenderScheduler.ts
│     └─ FerricAssetResolver.ts
├─ components/
│  ├─ CanvasSurface.tsx
│  ├─ CanvasOverlay.tsx
│  ├─ MainToolbar.tsx
│  ├─ ContextToolbar.tsx
│  ├─ StylePanel.tsx
│  ├─ GenerationPanel.tsx
│  └─ ZoomControl.tsx
├─ hooks/
│  ├─ useDocumentAutosave.ts
│  ├─ useSelectionPersistence.ts
│  ├─ useViewPersistence.ts
│  └─ useKeyboardShortcuts.ts
└─ tests/
```

---

# 8. 資料與事件模型

## 8.1 Event Types

```ts
type CoartEditorEvent =
  | { type: 'document.changed'; revision: number; changedIds: string[] }
  | { type: 'selection.changed'; ids: string[] }
  | { type: 'camera.changed'; camera: CanvasCamera }
  | { type: 'tool.changed'; tool: CanvasTool }
  | { type: 'interaction.started'; interaction: string }
  | { type: 'interaction.updated'; interaction: string }
  | { type: 'interaction.committed'; interaction: string }
  | { type: 'interaction.cancelled'; interaction: string }
  | { type: 'render.requested'; revision: number }
```

## 8.2 Dirty State

```ts
interface DirtyState {
  documentRevision: number
  savedDocumentRevision: number
  selectionRevision: number
  savedSelectionRevision: number
  viewRevision: number
  savedViewRevision: number
}
```

---

# 9. Ferric Adapter 邊界

Coart 不應在 UI component 中直接操作 Ferric engine。

```ts
interface FerricAdapter {
  load(snapshot: CanvasSnapshot): Promise<void>
  commitOperations(operations: CoartOperation[]): Promise<CommitResult>
  renderFull(): string
  renderExport(selection?: string[]): Promise<Blob>
  hitTest?(point: CanvasPoint): HitResult[]
  dispose(): void
}
```

Ferric 尚未補齊前：

- `hitTest` 可由 Coart bounds fallback。
- rotation／path hit-test 可能不準，需標示 technical debt。
- export 始終使用 Ferric。
- 互動 preview 不依賴完整 Ferric SVG rerender。

Ferric 補齊後：

- 移除 fallback。
- mutation、transform、hit-test、history 逐步下放。

---

# 10. 測試計畫

## 10.1 Unit

- PointerScheduler。
- draw point sampling。
- path simplify。
- selection event。
- camera event。
- document event。
- autosave revision。
- reload coalescing。
- context toolbar mode。
- multi-select mixed styles。

## 10.2 Integration

- drag pointer sequence。
- pointer cancel。
- resize。
- rotate。
- text edit。
- selection persistence。
- view persistence。
- reload 後 selection／camera 恢復。
- GenerationPanel draft。

## 10.3 Playwright

必測 viewport：

- 320×640。
- 480×720。
- 768×640。
- 1024×768。
- standalone full window。

互動：

1. 建立矩形。
2. 拖曳矩形。
3. resize。
4. rotate。
5. marquee 多選。
6. Space pan。
7. trackpad/wheel zoom。
8. 1000 點手繪。
9. 新增中文文字。
10. undo／redo。
11. duplicate。
12. delete。
13. 選取 AI Image 顯示 GenerationPanel。
14. 貼上參考圖。
15. 重新載入後恢復 snapshot／selection／view。

## 10.4 Performance

- Chrome Performance trace。
- React profiler。
- long task > 50ms。
- pointer latency。
- SVG replacement count。
- `loadScene()` call count。
- WASM memory。
- DOM node count。
- autosave count。

### 硬性規則

- drag 過程 `loadScene()` 次數必須是 0。
- pointer move 每 frame最多一次處理。
- camera move 不保存 document snapshot。
- 成功 autosave 不反覆顯示 toast。
- 500 shape pan／zoom 不出現持續卡頓。
- 1000 點 draw 不產生 O(n²) 陣列複製。

---

# 11. 分階段執行

## Sprint 1：效能止血

- PointerScheduler。
- draw ref。
- change event 分流。
- autosave 分流。
- reload coalescing。
- 成功 toast 移除。

## Sprint 2：UI 簡化

- toolbar 分類。
- 移除假頁面 dropdown。
- ContextToolbar。
- StylePanel 按需顯示。
- GenerationPanel 定位與貼圖。

## Sprint 3：標準互動

- marquee。
- resize。
- rotate。
- Space pan。
- zoom fit。
- shortcuts。
- history facade。

## Sprint 4：進階工具

- clipboard。
- snapping。
- image crop。
- arrows／notes／ellipse。
- groups／layers。

## Sprint 5：Ferric API 整合

待 Ferric 提供：

- incremental mutation。
- hit test。
- transform。
- history。
- SVG patches。

逐步刪除 Coart fallback。

---

# 12. 檔案級任務清單

## `src/components/FerricCanvas.tsx`

- [ ] rAF pointer queue。
- [ ] coalesced events。
- [ ] drawPointsRef。
- [ ] Space pan。
- [ ] cursor per tool。
- [ ] marquee overlay。
- [ ] resize/rotate overlay。
- [ ] double click hit-test。
- [ ] flush pointer move before pointer up。
- [ ] cancel lifecycle。

## `src/lib/ferricCanvas.ts`

- [ ] event bus。
- [ ] document/selection/camera/tool events。
- [ ] reload coalescing。
- [ ] transient transform。
- [ ] revision。
- [ ] selection bounds。
- [ ] hit-test fallback。
- [ ] transform facade。
- [ ] history facade。
- [ ] clipboard facade。

## `src/components/CanvasToolbar.tsx`

- [ ] MainToolbar 重構。
- [ ] tool popover。
- [ ] AI popover。
- [ ] 移除重複操作。
- [ ] 移除假 dropdown。

## `src/components/CanvasStylePanel.tsx`

- [ ] 無選取隱藏。
- [ ] multi-select。
- [ ] mixed values。
- [ ] bottom sheet。
- [ ] pin state。

## `src/components/GenerationPanel.tsx`

- [ ] contextual placement。
- [ ] clipboard images。
- [ ] thumbnails。
- [ ] per-shape draft。
- [ ] Escape／outside close。
- [ ] retry preserves data。
- [ ] slide presets。

## `src/hooks/useAutosave.ts`

- [ ] 拆成三個 hooks。
- [ ] revision aware。
- [ ] document-only snapshot。
- [ ] selection throttle。
- [ ] view debounce。
- [ ] teardown flush。
- [ ] failure retry。

## `scripts/probe-widget-loader.ts`

目前只驗證 mounted，必須新增或改用 Playwright：

- [ ] click tool。
- [ ] create shape。
- [ ] drag shape。
- [ ] zoom。
- [ ] type text。
- [ ] screenshot diff。
- [ ] narrow viewport。
- [ ] no console error。

---

# 13. Definition of Done

本輪改善完成的最低條件：

- 拖曳期間不重建 Ferric engine。
- pointer move 採 rAF 合併。
- 手繪不再複製完整 points array。
- document、selection、camera 事件完全分離。
- camera 變更不保存完整 snapshot。
- 多選可調整共同樣式。
- 無選取時右側面板不占空間。
- 工具列無重複按鈕。
- 不再顯示無功能頁面 dropdown。
- Image／HTML／Slides 具有情境工具列。
- Space pan、undo／redo、duplicate、zoom fit 可用。
- Playwright 測試實際拖曳與文字輸入。
- 500 物件 pan／zoom 達到可接受手感。
- quality gate 與新增 interaction tests 全部通過。

---

# 14. 最終架構建議

短期：

```text
Coart local interaction state
  + React/DOM overlay
  + low-frequency Ferric sync
  + Ferric trusted export
```

中期：

```text
Coart UI
  ↓
Ferric incremental editor API
  ↓
Ferric SVG patch renderer
  ↓
Coart MCP persistence
```

不要以增加更多固定按鈕解決「不直覺」；應優先解決：

1. 每個動作的即時回饋。
2. 選到什麼就顯示什麼操作。
3. 高頻互動不觸發完整場景重建。
4. 文件保存與視角保存分離。
5. 標準畫布行為一致。
