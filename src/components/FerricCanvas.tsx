import { useEffect, useMemo, useRef, useState } from 'react'
import { CoartFerricEditor, type DraftRectangle } from '../lib/ferricCanvas'
import type { AnyCanvasShape, CanvasCamera, CanvasPoint, EditorLike } from '../types'

interface FerricCanvasProps {
  onReady: (editor: EditorLike | null) => void
  interactive: boolean
}

type InteractionMode = 'select' | 'pan' | 'rectangle' | 'draw'

interface InteractionState {
  pointerId: number
  mode: InteractionMode
  lastScreen: CanvasPoint
  points: CanvasPoint[]
}

interface TextEditState {
  id: string
  value: string
}

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

export function FerricCanvas({ onReady, interactive }: FerricCanvasProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<InteractionState | null>(null)
  const [editor, setEditor] = useState<CoartFerricEditor | null>(null)
  const [svg, setSvg] = useState('')
  const [camera, setCamera] = useState<CanvasCamera>({ x: 0, y: 0, z: 1 })
  const [draft, setDraft] = useState<DraftRectangle | null>(null)
  const [drawPoints, setDrawPoints] = useState<CanvasPoint[]>([])
  const [textEdit, setTextEdit] = useState<TextEditState | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

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
            setTextEdit({ id, value: String(record.props.text || '文字') })
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
        stopResizeListener = () => {
          observer?.disconnect()
        }
      } catch (caught: unknown) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        onReady(null)
      }
    }
    void start()
    return () => {
      active = false
      stopResizeListener()
      nextEditor?.dispose()
      onReady(null)
    }
  }, [onReady])

  const selectedShapes = useMemo(() => {
    if (!editor) return []
    return editor.getSelectedShapeIds()
      .map((id) => editor.getShape(id))
      .filter((shape): shape is AnyCanvasShape => Boolean(shape))
  }, [editor, svg, camera, revision])

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
  }

  const pointerPosition = (event: { clientX: number; clientY: number }): CanvasPoint => {
    const shell = shellRef.current
    return shell ? screenPoint(shell, event) : { x: 0, y: 0 }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!interactive || !editor || event.button !== 0 && event.button !== 1) return
    const point = pointerPosition(event)
    const shell = event.currentTarget
    shell.focus()
    if (event.button === 1 || event.altKey || editor.getCurrentTool() === 'pan') {
      event.preventDefault()
      shell.setPointerCapture(event.pointerId)
      interactionRef.current = { pointerId: event.pointerId, mode: 'pan', lastScreen: point, points: [] }
      return
    }
    if (editor.getCurrentTool() === 'rectangle') {
      event.preventDefault()
      shell.setPointerCapture(event.pointerId)
      editor.beginRectangle(editor.worldPointFromScreen(point))
      interactionRef.current = { pointerId: event.pointerId, mode: 'rectangle', lastScreen: point, points: [] }
      return
    }
    if (editor.getCurrentTool() === 'draw') {
      event.preventDefault()
      shell.setPointerCapture(event.pointerId)
      interactionRef.current = {
        pointerId: event.pointerId,
        mode: 'draw',
        lastScreen: point,
        points: [editor.worldPointFromScreen(point)]
      }
      setDrawPoints([editor.worldPointFromScreen(point)])
      return
    }
    if (editor.getCurrentTool() === 'text') {
      event.preventDefault()
      editor.createText(editor.worldPointFromScreen(point))
      return
    }
    shell.setPointerCapture(event.pointerId)
    interactionRef.current = { pointerId: event.pointerId, mode: 'select', lastScreen: point, points: [] }
    editor.pointerDown(point, event.shiftKey)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const interaction = interactionRef.current
    if (!interactive || !editor || !interaction || interaction.pointerId !== event.pointerId) return
    const point = pointerPosition(event)
    if (interaction.mode === 'pan') {
      editor.panBy(point.x - interaction.lastScreen.x, point.y - interaction.lastScreen.y)
      interaction.lastScreen = point
      return
    }
    if (interaction.mode === 'rectangle') {
      editor.updateRectangle(editor.worldPointFromScreen(point))
      return
    }
    if (interaction.mode === 'draw') {
      const next = [...interaction.points, editor.worldPointFromScreen(point)]
      interaction.points = next
      interaction.lastScreen = point
      setDrawPoints(next)
      return
    }
    editor.pointerMove(point)
  }

  const clearInteraction = (event: React.PointerEvent<HTMLDivElement>): InteractionState | null => {
    const interaction = interactionRef.current
    if (interaction?.pointerId === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    interactionRef.current = null
    return interaction
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    const interaction = clearInteraction(event)
    if (!interactive || !editor || !interaction) return
    const point = pointerPosition(event)
    if (interaction.mode === 'rectangle') {
      editor.updateRectangle(editor.worldPointFromScreen(point))
      editor.finishRectangle()
    } else if (interaction.mode === 'draw') {
      const points = interaction.points
      setDrawPoints([])
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
            stroke: '#6d5ef7',
            strokeWidth: 4
          },
          meta: { coartVersion: 1 }
        })
        editor.setCurrentTool('select')
      }
    } else if (interaction.mode === 'select') {
      editor.pointerUp(point)
    }
  }

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>): void => {
    const interaction = clearInteraction(event)
    if (!interactive || !editor || !interaction) return
    setDrawPoints([])
    if (interaction.mode === 'select') editor.pointerCancel()
  }

  const onDoubleClick = (): void => {
    if (!interactive) return
    const id = editor?.getSelectedShapeIds()[0]
    if (id) editor?.requestTextEdit(id)
  }

  const drawPointsString = drawPoints
    .map((point) => `${camera.x + point.x * camera.z},${camera.y + point.y * camera.z}`)
    .join(' ')

  return (
    <div
      ref={shellRef}
      className="coart-ferric-shell"
      role="application"
      aria-label="Coart Ferric Canvas"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      onWheel={(event) => {
        if (!interactive) return
        event.preventDefault()
        editor?.zoomAt(pointerPosition(event), event.deltaY)
      }}
      onKeyDown={(event) => {
        if (!interactive) return
        if (editor?.handleKeyDown(event)) event.preventDefault()
      }}
    >
      <div
        className="coart-ferric-scene"
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})` }}
        // Ferric's renderSvg output is the engine's trusted, data-URI-only renderer output.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="coart-ferric-overlay" aria-hidden="true">
        {selectedShapes.map((shape) => {
          const rect = editor?.screenRect(shape)
          if (!rect) return null
          return <div key={shape.id} className="coart-ferric-selection" style={rect} />
        })}
        {draft && <div className="coart-ferric-draft" style={draftStyle(draft, camera)} />}
        {drawPoints.length > 1 && (
          <svg className="coart-ferric-draw-preview" width="100%" height="100%">
            <polyline points={drawPointsString} fill="none" stroke="#6d5ef7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {textEdit && textRect && (
        <textarea
          className="coart-ferric-text-editor"
          style={{ left: textRect.left, top: textRect.top, width: Math.max(100, textRect.width), height: Math.max(42, textRect.height) }}
          value={textEdit.value}
          autoFocus
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => setTextEdit({ ...textEdit, value: event.target.value })}
          onBlur={() => finishTextEdit()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              finishTextEdit(true)
            } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
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
