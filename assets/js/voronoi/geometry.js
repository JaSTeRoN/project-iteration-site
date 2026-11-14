export const EPS = 1e-7

export function rectPolygon(width, height) {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
}

export function clipPolygon(polygon, keep) {
  if (polygon.length === 0) return []
  const out = []
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const fa = keep(a)
    const fb = keep(b)
    if (fa <= EPS) out.push(a)
    if ((fa > EPS && fb < -EPS) || (fa < -EPS && fb > EPS)) {
      const t = fa / (fa - fb)
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  const cleaned = []
  for (const point of out) {
    const last = cleaned[cleaned.length - 1]
    if (!last || Math.abs(last.x - point.x) > EPS || Math.abs(last.y - point.y) > EPS) {
      cleaned.push(point)
    }
  }
  if (cleaned.length > 1) {
    const first = cleaned[0]
    const last = cleaned[cleaned.length - 1]
    if (Math.abs(first.x - last.x) <= EPS && Math.abs(first.y - last.y) <= EPS) cleaned.pop()
  }
  return cleaned
}

export function voronoiCells(points, width, height) {
  const rect = rectPolygon(width, height)
  return points.map((point, index) => {
    let polygon = rect
    for (let other = 0; other < points.length; other += 1) {
      if (other === index) continue
      const q = points[other]
      const nx = q.x - point.x
      const ny = q.y - point.y
      if (Math.abs(nx) < EPS && Math.abs(ny) < EPS) continue
      const mx = (point.x + q.x) / 2
      const my = (point.y + q.y) / 2
      polygon = clipPolygon(polygon, (v) => (v.x - mx) * nx + (v.y - my) * ny)
      if (polygon.length === 0) break
    }
    return polygon
  })
}

export function polygonArea(polygon) {
  if (polygon.length < 3) return 0
  let sum = 0
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

export function polygonCentroid(polygon) {
  if (polygon.length === 0) return { x: 0, y: 0 }
  let twiceArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const cross = a.x * b.y - b.x * a.y
    twiceArea += cross
    cx += (a.x + b.x) * cross
    cy += (a.y + b.y) * cross
  }
  if (Math.abs(twiceArea) < EPS) {
    const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
    return { x: sum.x / polygon.length, y: sum.y / polygon.length }
  }
  return { x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) }
}

export function nearestIndex(points, x, y) {
  let best = -1
  let bestDistance = Infinity
  points.forEach((point, index) => {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
}

export function bisectorSegment(a, b, width, height) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = -(b.y - a.y)
  const dy = b.x - a.x
  if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return null
  let t0 = -Infinity
  let t1 = Infinity
  const slabs = [
    [mx, dx, 0, width],
    [my, dy, 0, height],
  ]
  for (const [origin, direction, min, max] of slabs) {
    if (Math.abs(direction) < EPS) {
      if (origin < min || origin > max) return null
      continue
    }
    const aT = (min - origin) / direction
    const bT = (max - origin) / direction
    const low = Math.min(aT, bT)
    const high = Math.max(aT, bT)
    t0 = Math.max(t0, low)
    t1 = Math.min(t1, high)
  }
  if (t0 > t1) return null
  return [
    { x: mx + dx * t0, y: my + dy * t0 },
    { x: mx + dx * t1, y: my + dy * t1 },
  ]
}

function circumcircle(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  if (Math.abs(d) < EPS) return null
  const a2 = a.x * a.x + a.y * a.y
  const b2 = b.x * b.x + b.y * b.y
  const c2 = c.x * c.x + c.y * c.y
  const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d
  const y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d
  return { x, y, radius: Math.hypot(a.x - x, a.y - y) }
}

export function delaunayEdges(points) {
  const edges = new Map()
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      for (let k = j + 1; k < points.length; k += 1) {
        const circle = circumcircle(points[i], points[j], points[k])
        if (!circle) continue
        const radiusSquared = circle.radius * circle.radius
        let empty = true
        for (let m = 0; m < points.length; m += 1) {
          if (m === i || m === j || m === k) continue
          const distance = (points[m].x - circle.x) ** 2 + (points[m].y - circle.y) ** 2
          if (distance < radiusSquared - 1e-6) {
            empty = false
            break
          }
        }
        if (!empty) continue
        for (const [a, b] of [[i, j], [j, k], [k, i]]) {
          const key = a < b ? `${a}:${b}` : `${b}:${a}`
          if (!edges.has(key)) edges.set(key, [Math.min(a, b), Math.max(a, b)])
        }
      }
    }
  }
  return [...edges.values()]
}
