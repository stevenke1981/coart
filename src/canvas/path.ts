import type { CanvasPoint } from '../types'

function squaredDistance(left: CanvasPoint, right: CanvasPoint): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function segmentDistance(point: CanvasPoint, start: CanvasPoint, end: CanvasPoint): number {
  const length = squaredDistance(start, end)
  if (length === 0) return squaredDistance(point, start)
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / length))
  return squaredDistance(point, { x: start.x + ratio * (end.x - start.x), y: start.y + ratio * (end.y - start.y) })
}

export function appendSample(points: CanvasPoint[], point: CanvasPoint, minimumDistance = 2): boolean {
  const previous = points.at(-1)
  if (previous && squaredDistance(previous, point) < minimumDistance * minimumDistance) return false
  points.push(point)
  return true
}

export function simplifyPath(points: CanvasPoint[], tolerance = 1.5): CanvasPoint[] {
  if (points.length <= 2) return points.map((point) => ({ ...point }))
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  const threshold = tolerance * tolerance

  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number]
    let furthest = -1
    let maxDistance = threshold
    for (let index = start + 1; index < end; index += 1) {
      const distance = segmentDistance(points[index], points[start], points[end])
      if (distance > maxDistance) {
        maxDistance = distance
        furthest = index
      }
    }
    if (furthest >= 0) {
      keep[furthest] = 1
      stack.push([start, furthest], [furthest, end])
    }
  }

  return points.filter((_, index) => keep[index]).map((point) => ({ ...point }))
}

export function previewPath(points: CanvasPoint[], maximum = 320): CanvasPoint[] {
  if (points.length <= maximum) return points
  const stride = Math.ceil(points.length / maximum)
  const preview = points.filter((_, index) => index % stride === 0)
  const last = points.at(-1)
  if (last && preview.at(-1) !== last) preview.push(last)
  return preview
}
