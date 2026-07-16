import { useEffect, useMemo, useRef, useState } from 'react'
import { PointerScheduler } from '../canvas/PointerScheduler'
import { appendSample, previewPath, simplifyPath } from '../canvas/path'
import { CoartFerricEditor, type DraftRectangle } from '../lib/ferricCanvas'
import type { AnyCanvasShape, CanvasBounds, CanvasCamera, CanvasPoint, CanvasTool, EditorLike, ResizeHandle } from '../types'

interface FerricCanvasProps {
  onReady: (editor: EditorLike | null) => void
  interactive: boolean
}

type InteractionMode = 'select' | 'pan' | 'rectangle' | 'draw' | 'marquee' | 'resize' | 'rotate'

interface InteractionState {
  pointerId: number
  mode: InteractionMode
  lastScreen: CanvasPoint
  startScreen: CanvasPoint
  additive?: boolean
}

interface PointerSample {
  pointerId: number
  point: CanvasPoint
}

interface TextEditState {
  id: string
  value: string
}

const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function screenPoint(element: HTMLElement, event: { clientX: number; clientY: number }): CanvasPoint {
  const rect = element.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function draftStyle(draft: DraftRectangle, camera: CanvasCamera): React.CSSProperties {
  const zoom = camera.z
  return {
    left: camera.x + Math.min(draft.start.x, draft.end.x) * zoom,
    top: camera.y + Math.min(draft.start.y, draft.end.y) * zoom,
    width: Math.abs(draft.end.x - draft.start.x) * zoom,
    height: Math.abs(draft.end.y - draft.start.y) * zoom
  }
}

function screenBounds(start: CanvasPoint, end: CanvasPoint): React.CSSProperties {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

function worldBounds(editor: CoartFerricEditor, start: CanvasPoint, end: CanvasPoint): CanvasBounds {
  const first = editor.worldPointFromScreen(start)
  const second = editor.worldPointFromScreen(end)
  return {
    left: Math.min(first.x, second.x),
    top: Math.min(first.y, second.y),
    right: Math.max(first.x, second.x),
    bottom: Math.max(first.y, second.y)
  }
}

function hitShape(editor: CoartFerricEditor, point: CanvasPoint): AnyCanvasShape | null {
  const world = editor.worldPointFromScreen(point)
  return [...editor.getCurrentPageShapes()].reverse().find((shape) => {
    if (shape.isLocked) return false
    const left = numberValue(shape.x, 0)
    const top = numberValue(shape.y, 0)
    const right = left + numberValue(shape.props.w, 1)
    const bottom = top + numberValue(shape.props.h, 1)
    return world.x >= left && world.x <= right && world.y >= top && world.y <= bottom
  }) ?? null
}

export function FerricCanvas({ onReady, interactive }: FerricCanvasProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<InteractionState | null>(null)
  const drawPointsRef = useRef<CanvasPoint[]>([])
  const pendingDrawSamplesRef = useRef<CanvasPoint[]>([])
  const processMoveRef = useRef<(sample: PointerSample) => void>(() => undefined)
  const schedulerRef = useRef<PointerScheduler<PointerSample> | null>(null)
  const spaceToolRef = useRef<CanvasTool | null>(null)
  const [editor, setEditor] = useState<CoartFerricEditor | null>(null)
  const [svg, setSvg] = useState('')
  const [camera, setCamera] = useState<CanvasCamera>({ x: 0, y: 0, z: 1 })
  const [draft, setDraft] = useState<DraftRectangle | null>(null)
  const [marquee, setMarquee] = useState<{ start: CanvasPoint; end: CanvasPoint } | null>(null)
  const [drawRevision, setDrawRevision] = useState(0)
  const [textEdit, setTextEdit] = useState<TextEditState | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  if (!schedulerRef.current && typeof window !== 'undefined') {
    schedulerRef.current = new PointerScheduler(
      (sample) => processMoveRef.current(sample),
      (callback) => window.requestAnimationFrame(callback),
      (handle) => window.cancelAnimationFrame(handle)
    )
  }

  useEffect(() => {
    let active = true
    let nextEditor: CoartFerricEditor | null = null
    let stopResizeListener = (): void => undefined
    const start = async (): Promise<void> => {
      try {
        nextEditor = await CoartFerricEditor.create({
          onRender: (nextSvg, nextCamera) => {
            if (!active) return
            setSvg(nextSvg)
            setCamera(nextCamera)
          },
          onChange: () => setRevision((value) => value + 1),
          onDraftRectangle: setDraft,
          onTextEditRequest: (id) => {
            if (!active || !nextEditor) return
            const record = nextEditor.getShape(id)
            if (!record || record.type !== 'text') return
            const savedText = String(record.props.text ?? '')
            setTextEdit({ id, value: savedText === '輸入文字' ? '' : savedText })
          },
          onError: (message) => {
            if (active) setError(message)
          }
        })
        if (!active) {
          nextEditor.dispose()
          return
        }
        setEditor(nextEditor)
        onReady(nextEditor)
        const resize = (): void => {
          const shell = shellRef.current
          if (!shell) return
          const rect = shell.getBoundingClientRect()
          nextEditor?.setViewportSize(rect.width, Math.max(640, rect.height))
        }
        resize()
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
        if (shellRef.current) observer?.observe(shellRef.current)
        stopResizeListener = () => observer?.disconnect()
      } catch (caught: unknown) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        onReady(null)
      }
    }
    void start()
    return () => {
      active = false
      schedulerRef.current?.cancel()
      stopResizeListener()
      nextEditor?.dispose()
      onReady(null)
    }
  }, [onReady])

  useEffect(() => {
    const isFormTarget = (target: EventTarget | null): boolean => target instanceof HTMLElement && (target.matches('input, textarea, select, [contenteditable="true"]'))
    const pressKey = (event: KeyboardEvent): void => {
      if (!interactive || !editor || isFormTarget(event.target)) return
      if (event.code === 'Space' && !event.repeat && spaceToolRef.current === null) {
        event.preventDefault()
        spaceToolRef.current = editor.getCurrentTool()
        editor.setCurrentTool('pan')
        return
      }
      if (editor.handleKeyDown(event)) event.preventDefault()
    }
    const releaseSpace = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || !editor || spaceToolRef.current === null) return
      editor.setCurrentTool(spaceToolRef.current)
      spaceToolRef.current = null
    }
    window.addEventListener('keydown', pressKey)
    window.addEventListener('keyup', releaseSpace)
    return () => {
      window.removeEventListener('keydown', pressKey)
      window.removeEventListener('keyup', releaseSpace)
    }
  }, [editor, interactive])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell || !editor || !interactive) return undefined
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 120 : 1
      editor.zoomAt(screenPoint(shell, event), Math.max(-120, Math.min(120, event.deltaY * unit)))
    }
    shell.addEventListener('wheel', onWheel, { passive: false })
    return () => shell.removeEventListener('wheel', onWheel)
  }, [editor, interactive])

  const selectedShapes = useMemo(() => {
    if (!editor) return []
    return editor.getSelectedShapeIds()
      .map((id) => editor.getShape(id))
      .filter((shape): shape is AnyCanvasShape => Boolean(shape))
  }, [editor, svg, camera, revision])

  const selectionBounds = useMemo(() => editor?.getSelectionScreenBounds() ?? null, [editor, camera, revision])
  const textRect = useMemo(() => {
    if (!editor || !textEdit) return null
    const shape = editor.getShape(textEdit.id)
    return shape ? editor.screenRect(shape) : null
  }, [editor, textEdit, camera, svg, revision])

  const finishTextEdit = (cancel = false): void => {
    if (!textEdit || !editor) return
    const current = textEdit
    setTextEdit(null)
    if (!cancel) void editor.commitText(current.id, current.value)
    window.requestAnimationFrame(() => shellRef.current?.focus())
  }

  const pointerPosition = (event: { clientX: number; clientY: number }): CanvasPoint => {
    const shell = shellRef.current
    return shell ? screenPoint(shell, event) : { x: 0, y: 0 }
  }

  processMoveRef.current = (sample): void => {
    const interaction = interactionRef.current
    if (!interactive || !editor || !interaction || interaction.pointerId !== sample.pointerId) return
    const point = sample.point
    if (interaction.mode === 'pan') {
      editor.panBy(point.x - interaction.lastScreen.x, point.y - interaction.lastScreen.y)
      interaction.lastScreen = point
    } else if (interaction.mode === 'rectangle') {
      editor.updateRectangle(editor.worldPointFromScreen(point))
    } else if (interaction.mode === 'draw') {
      for (const drawPoint of pendingDrawSamplesRef.current.splice(0)) appendSample(drawPointsRef.current, drawPoint, 2 / Math.max(.1, camera.z))
      interaction.lastScreen = point
      setDrawRevision((value) => value + 1)
    } else if (interaction.mode === 'marquee') {
      setMarquee({ start: interaction.startScreen, end: point })
    } else if (interaction.mode === 'resize') {
      editor.updateResize(point)
    } else if (interaction.mode === 'rotate') {
      editor.updateRotate(point)
    } else {
      editor.pointerMove(point)
      interaction.lastScreen = point
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!interactive || !editor || (event.button !== 0 && event.button !== 1)) return
    const point = pointerPosition(event)
    const shell = event.currentTarget
    shell.focus()
    if (event.button === 1 || event.altKey || editor.getCurrentTool() === 'pan') {
      event.preventDefault()
      shell.setPointerCapture(event.pointerId)
      interactionRef.current = { pointerId: event.pointerId, mode: 'pan', lastScreen: point, startScreen: point }
      return
    }
    if (editor.getCurrentTool() === 'rectangle') {
      event.preventDefault()
      shell.setPointerCapture(event.pointerId)
      editor.beginRectangle(editor.worldPointFromScreen(point))
      interactionRef.current = { pointerId: event.pointerId, mode: 'rectangle', lastScreen: point, startScreen: point }
      return
    }
    if (editor.getCurrentTool() === 'draw') {
      event.preventDefault()
      shell.setPointerCapture(event.pointerId)
      const world = editor.worldPointFromScreen(point)
      drawPointsRef.current = [world]
      pendingDrawSamplesRef.current = []
      setDrawRevision((value) => value + 1)
      interactionRef.current = { pointerId: event.pointerId, mode: 'draw', lastScreen: point, startScreen: point }
      return
    }
    if (editor.getCurrentTool() === 'text') {
      event.preventDefault()
      editor.createText(editor.worldPointFromScreen(point))
      return
    }
    shell.setPointerCapture(event.pointerId)
    if (!hitShape(editor, point)) {
      interactionRef.current = { pointerId: event.pointerId, mode: 'marquee', lastScreen: point, startScreen: point, additive: event.shiftKey }
      setMarquee({ start: point, end: point })
      return
    }
    interactionRef.current = { pointerId: event.pointerId, mode: 'select', lastScreen: point, startScreen: point }
    editor.pointerDown(point, event.shiftKey)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const interaction = interactionRef.current
    if (!interactive || !editor || !interaction || interaction.pointerId !== event.pointerId) return
    const events = typeof event.nativeEvent.getCoalescedEvents === 'function' ? event.nativeEvent.getCoalescedEvents() : [event.nativeEvent]
    if (interaction.mode === 'draw') {
      for (const sample of events) pendingDrawSamplesRef.current.push(editor.worldPointFromScreen(pointerPosition(sample)))
    }
    schedulerRef.current?.schedule({ pointerId: event.pointerId, point: pointerPosition(event) })
  }

  const clearInteraction = (event: React.PointerEvent<HTMLDivElement>): InteractionState | null => {
    const interaction = interactionRef.current
    if (interaction?.pointerId === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    interactionRef.current = null
    return interaction
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    schedulerRef.current?.flush()
    const interaction = clearInteraction(event)
    if (!interactive || !editor || !interaction) return
    const point = pointerPosition(event)
    if (interaction.mode === 'rectangle') {
      editor.updateRectangle(editor.worldPointFromScreen(point))
      editor.finishRectangle()
    } else if (interaction.mode === 'draw') {
      for (const drawPoint of pendingDrawSamplesRef.current.splice(0)) appendSample(drawPointsRef.current, drawPoint, 2 / Math.max(.1, camera.z))
      appendSample(drawPointsRef.current, editor.worldPointFromScreen(point), 1 / Math.max(.1, camera.z))
      const points = simplifyPath(drawPointsRef.current, 1.5 / Math.max(.1, camera.z))
      drawPointsRef.current = []
      setDrawRevision((value) => value + 1)
      if (points.length > 1) {
        editor.createShape({
          id: `shape:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
          type: 'draw',
          x: 0,
          y: 0,
          props: {
            w: 1,
            h: 1,
            path: [['M', points[0].x, points[0].y], ...points.slice(1).map((item) => ['L', item.x, item.y])],
            stroke: '#2563eb',
            strokeWidth: 4
          },
          meta: { coartVersion: 1 }
        })
        editor.setCurrentTool('select')
      }
    } else if (interaction.mode === 'marquee') {
      editor.selectInBounds(worldBounds(editor, interaction.startScreen, point), interaction.additive)
      setMarquee(null)
    } else if (interaction.mode === 'resize') {
      editor.updateResize(point)
      editor.commitResize()
    } else if (interaction.mode === 'rotate') {
      editor.updateRotate(point)
      editor.commitRotate()
    } else if (interaction.mode === 'select') {
      editor.pointerUp(point)
    }
  }

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>): void => {
    schedulerRef.current?.cancel()
    const interaction = clearInteraction(event)
    if (!interactive || !editor || !interaction) return
    drawPointsRef.current = []
    pendingDrawSamplesRef.current = []
    setDrawRevision((value) => value + 1)
    setMarquee(null)
    if (interaction.mode === 'select') editor.pointerCancel()
    if (interaction.mode === 'resize') editor.cancelResize()
    if (interaction.mode === 'rotate') editor.cancelRotate()
  }

  const beginHandle = (mode: 'resize' | 'rotate', handle: ResizeHandle | null, event: React.PointerEvent<HTMLButtonElement>): void => {
    if (!editor) return
    event.preventDefault()
    event.stopPropagation()
    const shell = shellRef.current
    if (!shell) return
    const point = pointerPosition(event)
    shell.setPointerCapture(event.pointerId)
    interactionRef.current = { pointerId: event.pointerId, mode, lastScreen: point, startScreen: point }
    if (mode === 'resize' && handle) editor.beginResize(handle, point)
    else editor.beginRotate(point)
  }

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!interactive || !editor) return
    const hit = hitShape(editor, pointerPosition(event))
    if (!hit) return
    editor.select(hit.id)
    editor.requestTextEdit(hit.id)
  }

  const preview = previewPath(drawPointsRef.current)
  const diagnostics = editor?.getDiagnostics()
  const drawPointsString = preview
    .map((point) => `${camera.x + point.x * camera.z},${camera.y + point.y * camera.z}`)
    .join(' ')

  return (
    <div
      ref={shellRef}
      className="coart-ferric-shell"
      data-tool={editor?.getCurrentTool() ?? 'select'}
      data-draw-revision={drawRevision}
      data-load-scene-count={diagnostics?.loadSceneCount ?? 0}
      data-pointer-move-count={diagnostics?.pointerMoveCount ?? 0}
      data-document-revision={diagnostics?.documentRevision ?? 0}
      data-selected-count={selectedShapes.length}
      data-selected-ids={diagnostics?.selectedIds.join(',') ?? ''}
      data-record-count={diagnostics?.recordCount ?? 0}
      role="application"
      aria-label="Coart Ferric Canvas"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="coart-ferric-scene"
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})` }}
        // Ferric's renderSvg output is the engine's trusted, data-URI-only renderer output.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="coart-ferric-overlay" aria-hidden="true">
        {selectedShapes.length > 1 && selectedShapes.map((shape) => {
          const rect = editor?.screenRect(shape)
          return rect ? <div key={shape.id} className="coart-ferric-selection is-member" style={rect} /> : null
        })}
        {selectionBounds && (
          <div className="coart-selection-transform" style={{ left: selectionBounds.x, top: selectionBounds.y, width: selectionBounds.w, height: selectionBounds.h }}>
            {RESIZE_HANDLES.map((handle) => <button key={handle} className={`coart-resize-handle is-${handle}`} data-handle={handle} onPointerDown={(event) => beginHandle('resize', handle, event)} />)}
            <span className="coart-rotate-stem" />
            <button className="coart-rotate-handle" onPointerDown={(event) => beginHandle('rotate', null, event)} />
          </div>
        )}
        {draft && <div className="coart-ferric-draft" style={draftStyle(draft, camera)} />}
        {marquee && <div className="coart-marquee" style={screenBounds(marquee.start, marquee.end)} />}
        {preview.length > 1 && (
          <svg className="coart-ferric-draw-preview" width="100%" height="100%">
            <polyline points={drawPointsString} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {textEdit && textRect && (
        <textarea
          className="coart-ferric-text-editor"
          style={{ left: textRect.left, top: textRect.top, width: Math.max(100, textRect.width), height: Math.max(42, textRect.height) }}
          value={textEdit.value}
          placeholder="輸入文字"
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => setTextEdit({ ...textEdit, value: event.target.value })}
          onBlur={() => finishTextEdit()}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Escape') {
              event.preventDefault()
              finishTextEdit(true)
            } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey || !event.shiftKey)) {
              event.preventDefault()
              finishTextEdit()
            }
          }}
        />
      )}
      {error && <div className="coart-ferric-error">Ferric：{error}</div>}
    </div>
  )
}
