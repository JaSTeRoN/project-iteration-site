import { DIRS, averageHeight, waterEdges } from "./engine.js"
import { worldToScreen } from "../camera.js"

export const PALETTE = ["#d64545", "#e2b33c", "#3aaa5a", "#3d7fe0", "#9a57d6", "#e07a32", "#2aa7a0", "#d45d9b"]

const TILE_W = 72
const TILE_H = 36
const HEIGHT_STEP = 11

export function tileSvg(tile) {
  const color = (side) => PALETTE[tile[side].color] ?? "#888"
  const label = (side, x, y) =>
    `<text x="${x}" y="${y}" text-anchor="middle" fill="#fff" stroke="#17200c" stroke-width="4" paint-order="stroke" font-size="18" font-family="Segoe UI, sans-serif">${tile[side].color}</text>`
  return `<svg class="wang-svg" viewBox="0 0 100 100" aria-hidden="true">
    <polygon points="0,0 100,0 50,50" fill="${color("n")}"/>
    <polygon points="100,0 100,100 50,50" fill="${color("e")}"/>
    <polygon points="0,100 100,100 50,50" fill="${color("s")}"/>
    <polygon points="0,0 0,100 50,50" fill="${color("w")}"/>
    ${label("n", 50, 22)}${label("e", 80, 56)}${label("s", 50, 90)}${label("w", 20, 56)}
  </svg>`
}

function project(x, y, z) {
  return {
    x: (x - y) * (TILE_W / 2),
    y: (x + y) * (TILE_H / 2) - z,
  }
}

function lerpHex(from, to, t) {
  const amount = Math.max(0, Math.min(1, t))
  const parse = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16))
  const a = parse(from)
  const b = parse(to)
  const mix = a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount))
  return `#${mix.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

function shade(hex, factor) {
  return lerpHex("#000000", hex, factor)
}

export function cellColor(level, value) {
  if (level <= 2) {
    if (value < 4) return "#6e4c30"
    if (value < 7) return "#3f6b34"
    return "#234c28"
  }
  return lerpHex("#c6a15a", "#1c6b32", value / 10)
}

export function fitMap(map, width, height, extrude) {
  const lift = extrude ? HEIGHT_STEP * 5 : 0
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let y = 0; y <= map.height; y += 1) {
    for (let x = 0; x <= map.width; x += 1) {
      for (const point of [project(x, y, 0), project(x, y, lift)]) {
        minX = Math.min(minX, point.x)
        maxX = Math.max(maxX, point.x)
        minY = Math.min(minY, point.y)
        maxY = Math.max(maxY, point.y)
      }
    }
  }
  const zoom = Math.min((width - 28) / (maxX - minX || 1), (height - 28) / (maxY - minY || 1))
  return {
    camX: (minX + maxX) / 2,
    camY: (minY + maxY) / 2,
    zoom: Math.max(0.25, Math.min(5, zoom)),
  }
}

function painterOrder(map) {
  const order = []
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) order.push([x, y])
  }
  order.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0])
  return order
}

function topPoints(tile, x, y, extrude) {
  const z = extrude ? averageHeight(tile) * HEIGHT_STEP : 0
  return [
    project(x, y, z),
    project(x + 1, y, z),
    project(x + 1, y + 1, z),
    project(x, y + 1, z),
  ]
}

function screenPoly(points, view, width, height) {
  return points.map((point) => worldToScreen(point, view, width, height))
}

function path(ctx, points) {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
  ctx.closePath()
}

function pointInPoly(x, y, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x
    const yi = points[i].y
    const xj = points[j].x
    const yj = points[j].y
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi
    if (hit) inside = !inside
  }
  return inside
}

function shortEdge(value, channels) {
  let text = ""
  if (channels.includes("road")) text += value.road ? "1" : "0"
  if (channels.includes("water") && value.water) text += "в"
  const tail = []
  if (channels.includes("grassColor")) tail.push(String(value.grassColor))
  if (channels.includes("grassHeight")) tail.push(String(value.grassHeight))
  if (tail.length > 0) text += `${text ? " " : ""}${tail.join("/")}`
  return text
}

function paintEdgeLabel(ctx, text, x, y) {
  const box = ctx.measureText(text)
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 12)
  const height = Math.max(14, Math.round(size + 4))
  const pad = 4
  const left = x - box.width / 2 - pad
  const top = y - height / 2
  ctx.fillStyle = "rgba(12, 16, 12, 0.92)"
  ctx.beginPath()
  ctx.roundRect(left, top, box.width + pad * 2, height, 4)
  ctx.fill()
  ctx.fillStyle = "#f4fff0"
  ctx.fillText(text, x, y)
}

function seamSides(map, x, y, revealed) {
  const sides = []
  if (y === 0) sides.push("n")
  if (x === 0) sides.push("w")
  if (x + 1 >= map.width || revealed.has(`${x + 1},${y}`)) sides.push("e")
  if (y + 1 >= map.height || revealed.has(`${x},${y + 1}`)) sides.push("s")
  return sides
}

function drawObject(ctx, tile, center, zoom) {
  if (tile.object === "none") return
  const size = 12 * zoom
  if (tile.object === "rock") {
    ctx.fillStyle = "#aeb4b8"
    ctx.fillRect(center.x - size, center.y - size * 1.5, size * 1.5, size)
    ctx.fillStyle = "#d5d8dc"
    ctx.fillRect(center.x - size * 0.2, center.y - size * 2.4, size, size * 0.8)
  } else if (tile.object === "tree") {
    ctx.fillStyle = "#6b4428"
    ctx.fillRect(center.x - size * 0.15, center.y - size, size * 0.3, size)
    ctx.fillStyle = "#2f7d3a"
    ctx.beginPath()
    ctx.arc(center.x, center.y - size * 1.3, size * 0.7, 0, Math.PI * 2)
    ctx.fill()
  } else if (tile.object === "reed") {
    ctx.strokeStyle = "#9ad7c8"
    ctx.lineWidth = Math.max(1, 2 * zoom)
    for (const offset of [-4, 0, 4]) {
      ctx.beginPath()
      ctx.moveTo(center.x + offset * zoom, center.y)
      ctx.lineTo(center.x + offset * zoom, center.y - size * 1.4)
      ctx.stroke()
    }
  }
}

function edgeMids(top) {
  return {
    n: { x: (top[0].x + top[1].x) / 2, y: (top[0].y + top[1].y) / 2 },
    e: { x: (top[1].x + top[2].x) / 2, y: (top[1].y + top[2].y) / 2 },
    s: { x: (top[2].x + top[3].x) / 2, y: (top[2].y + top[3].y) / 2 },
    w: { x: (top[3].x + top[0].x) / 2, y: (top[3].y + top[0].y) / 2 },
  }
}

function paintTileFace(ctx, map, x, y, top, ground, view, level, extrude, accepts) {
  const tile = map.cells[y][x]
  if (extrude) {
    const base = cellColor(level, Math.round(DIRS.reduce((sum, side) => sum + (tile[side].grassColor ?? 0), 0) / 4))
    ctx.fillStyle = shade(base, 0.45)
    path(ctx, [top[3], top[2], ground[2], ground[3]])
    ctx.fill()
    ctx.fillStyle = shade(base, 0.62)
    path(ctx, [top[2], top[1], ground[1], ground[2]])
    ctx.fill()
  }
  const pond = waterEdges(tile) >= 3
  if (pond) {
    ctx.fillStyle = "#67c3d2"
    path(ctx, top)
    ctx.fill()
  } else if (level <= 2) {
    const value = Math.round(DIRS.reduce((sum, side) => sum + (tile[side].grassColor ?? 0), 0) / 4)
    ctx.fillStyle = cellColor(2, value)
    path(ctx, top)
    ctx.fill()
  } else {
    const mid = {
      x: (top[0].x + top[1].x + top[2].x + top[3].x) / 4,
      y: (top[0].y + top[1].y + top[2].y + top[3].y) / 4,
    }
    const triangles = [
      [top[0], top[1], mid, "n"],
      [top[1], top[2], mid, "e"],
      [top[2], top[3], mid, "s"],
      [top[3], top[0], mid, "w"],
    ]
    for (const [a, b, c, side] of triangles) {
      ctx.fillStyle = cellColor(level, tile[side].grassColor ?? 0)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.lineTo(c.x, c.y)
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.strokeStyle = "rgba(255,255,255,0.55)"
  ctx.lineWidth = 2
  path(ctx, top)
  ctx.stroke()
  const center = { x: (top[0].x + top[2].x) / 2, y: (top[0].y + top[2].y) / 2 }
  const mids = edgeMids(top)
  for (const side of DIRS) {
    if (tile[side].water === 1 && !pond) {
      ctx.strokeStyle = "#8fd8e4"
      ctx.lineWidth = Math.max(4, 14 * view.zoom)
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(center.x, center.y)
      ctx.lineTo(mids[side].x, mids[side].y)
      ctx.stroke()
    }
  }
  for (const side of DIRS) {
    if (tile[side].road !== 1) continue
    ctx.strokeStyle = "#c8ae7e"
    ctx.lineWidth = Math.max(6, 18 * view.zoom)
    ctx.lineCap = "butt"
    ctx.beginPath()
    ctx.moveTo(center.x, center.y)
    ctx.lineTo(mids[side].x, mids[side].y)
    ctx.stroke()
    ctx.strokeStyle = "#f0e2c0"
    ctx.lineWidth = Math.max(3, 10 * view.zoom)
    ctx.beginPath()
    ctx.moveTo(center.x, center.y)
    ctx.lineTo(mids[side].x, mids[side].y)
    ctx.stroke()
  }
  drawObject(ctx, tile, center, view.zoom)
  if (accepts?.has(`${x},${y}`)) {
    ctx.strokeStyle = "#9dffb8"
    ctx.lineWidth = 3
    path(ctx, top)
    ctx.stroke()
  }
}

export function drawMap(ctx, width, height, model) {
  const { map, view, reveal, showLabels, level, selected, accepts, channels } = model
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = "#0c100c"
  ctx.fillRect(0, 0, width, height)
  const revealed = new Set(map.revealOrder.slice(0, reveal).map(([x, y]) => `${x},${y}`))
  const extrude = Boolean(model.extrude)
  for (const [x, y] of painterOrder(map)) {
    const key = `${x},${y}`
    const tile = map.cells[y][x]
    const top = screenPoly(topPoints(tile, x, y, extrude && revealed.has(key)), view, width, height)
    const ground = screenPoly(
      [project(x, y, 0), project(x + 1, y, 0), project(x + 1, y + 1, 0), project(x, y + 1, 0)],
      view,
      width,
      height,
    )
    if (revealed.has(key) && extrude) {
      const base = cellColor(level, Math.round(DIRS.reduce((sum, side) => sum + (tile[side].grassColor ?? 0), 0) / 4))
      ctx.fillStyle = shade(base, 0.45)
      path(ctx, [top[3], top[2], ground[2], ground[3]])
      ctx.fill()
      ctx.fillStyle = shade(base, 0.62)
      path(ctx, [top[2], top[1], ground[1], ground[2]])
      ctx.fill()
    }
    if (!revealed.has(key)) {
      ctx.strokeStyle = "rgba(232,242,223,0.16)"
      ctx.lineWidth = 1
      path(ctx, ground)
      ctx.stroke()
      continue
    }
    const pond = waterEdges(tile) >= 3
    if (pond) {
      ctx.fillStyle = "#67c3d2"
      path(ctx, top)
      ctx.fill()
    } else if (level <= 2) {
      const value = Math.round(DIRS.reduce((sum, side) => sum + (tile[side].grassColor ?? 0), 0) / 4)
      ctx.fillStyle = cellColor(2, value)
      path(ctx, top)
      ctx.fill()
    } else {
      const center = {
        x: (top[0].x + top[1].x + top[2].x + top[3].x) / 4,
        y: (top[0].y + top[1].y + top[2].y + top[3].y) / 4,
      }
      const triangles = [
        [top[0], top[1], center, "n"],
        [top[1], top[2], center, "e"],
        [top[2], top[3], center, "s"],
        [top[3], top[0], center, "w"],
      ]
      for (const [a, b, c, side] of triangles) {
        ctx.fillStyle = cellColor(level, tile[side].grassColor ?? 0)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.lineTo(c.x, c.y)
        ctx.closePath()
        ctx.fill()
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.28)"
    ctx.lineWidth = 1
    path(ctx, top)
    ctx.stroke()
    const center = {
      x: (top[0].x + top[2].x) / 2,
      y: (top[0].y + top[2].y) / 2,
    }
    const mids = {
      n: { x: (top[0].x + top[1].x) / 2, y: (top[0].y + top[1].y) / 2 },
      e: { x: (top[1].x + top[2].x) / 2, y: (top[1].y + top[2].y) / 2 },
      s: { x: (top[2].x + top[3].x) / 2, y: (top[2].y + top[3].y) / 2 },
      w: { x: (top[3].x + top[0].x) / 2, y: (top[3].y + top[0].y) / 2 },
    }
    for (const side of DIRS) {
      if (tile[side].water === 1 && !pond) {
        ctx.strokeStyle = "#8fd8e4"
        ctx.lineWidth = Math.max(4, 14 * view.zoom)
        ctx.lineCap = "round"
        ctx.beginPath()
        ctx.moveTo(center.x, center.y)
        ctx.lineTo(mids[side].x, mids[side].y)
        ctx.stroke()
      }
    }
    for (const side of DIRS) {
      if (tile[side].road !== 1) continue
      ctx.strokeStyle = "#c8ae7e"
      ctx.lineWidth = Math.max(6, 18 * view.zoom)
      ctx.lineCap = "butt"
      ctx.beginPath()
      ctx.moveTo(center.x, center.y)
      ctx.lineTo(mids[side].x, mids[side].y)
      ctx.stroke()
      ctx.strokeStyle = "#f0e2c0"
      ctx.lineWidth = Math.max(3, 10 * view.zoom)
      ctx.beginPath()
      ctx.moveTo(center.x, center.y)
      ctx.lineTo(mids[side].x, mids[side].y)
      ctx.stroke()
    }
    drawObject(ctx, tile, center, view.zoom)
    if (accepts?.has(key)) {
      ctx.strokeStyle = "#9dffb8"
      ctx.lineWidth = 3
      path(ctx, top)
      ctx.stroke()
    }
  }
  const focus = selected && revealed.has(`${selected[0]},${selected[1]}`) ? selected : null
  if (focus) {
    ctx.fillStyle = "rgba(4, 6, 4, 0.72)"
    ctx.fillRect(0, 0, width, height)
    const [fx, fy] = focus
    const tile = map.cells[fy][fx]
    const top = screenPoly(topPoints(tile, fx, fy, extrude), view, width, height)
    const ground = screenPoly(
      [project(fx, fy, 0), project(fx + 1, fy, 0), project(fx + 1, fy + 1, 0), project(fx, fy + 1, 0)],
      view,
      width,
      height,
    )
    paintTileFace(ctx, map, fx, fy, top, ground, view, level, extrude, accepts)
    ctx.strokeStyle = "#f2d56b"
    ctx.lineWidth = 4
    path(ctx, top)
    ctx.stroke()
    if (showLabels) {
      const center = { x: (top[0].x + top[2].x) / 2, y: (top[0].y + top[2].y) / 2 }
      const mids = edgeMids(top)
      ctx.font = `700 ${Math.max(16, 15 * Math.min(view.zoom, 1.8))}px Segoe UI, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.strokeStyle = "rgba(242, 213, 107, 0.95)"
      ctx.lineWidth = 1.5
      const placed = []
      for (const side of DIRS) {
        const point = mids[side]
        const text = shortEdge(tile[side], channels)
        const box = ctx.measureText(text)
        const size = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 16)
        const boxH = Math.max(14, Math.round(size + 4))
        const vx = point.x - center.x
        const vy = point.y - center.y
        const span = Math.hypot(vx, vy) || 1
        // Adjacent seams sit about 53° apart, so the radius has to clear both the border and the chip width.
        const radius = Math.max(span * 1.55, (box.width + 14) / 0.89)
        let lx = center.x + (vx / span) * radius
        let ly = center.y + (vy / span) * radius
        const halfW = box.width / 2 + 8
        const halfH = boxH / 2 + 6
        lx = Math.max(halfW, Math.min(width - halfW, lx))
        ly = Math.max(halfH, Math.min(height - halfH, ly))
        placed.push({ text, point, lx, ly })
      }
      for (const item of placed) {
        ctx.beginPath()
        ctx.moveTo(item.point.x, item.point.y)
        ctx.lineTo(item.lx, item.ly)
        ctx.stroke()
        paintEdgeLabel(ctx, item.text, item.lx, item.ly)
      }
    }
  } else if (showLabels && view.zoom >= 0.72) {
    // Nearest captions are one flat step apart: 36px across, 18px down, before zoom.
    const across = (TILE_W / 2) * view.zoom
    const down = (TILE_H / 2) * view.zoom
    let fontSize = Math.min(16, Math.max(11, 12 * Math.min(view.zoom, 1.25)))
    const pending = []
    for (const [x, y] of painterOrder(map)) {
      if (!revealed.has(`${x},${y}`)) continue
      const tile = map.cells[y][x]
      // Anchor to the flat footprint. Raised tops sit at different heights and would slide the chips together.
      const top = screenPoly(topPoints(tile, x, y, false), view, width, height)
      const mids = edgeMids(top)
      for (const side of seamSides(map, x, y, revealed)) {
        pending.push({ text: shortEdge(tile[side], channels), x: mids[side].x, y: mids[side].y })
      }
    }
    let widest = Infinity
    const fits = () => widest + 10 <= across * 0.9 && Math.max(14, fontSize + 4) <= down * 0.9
    while (fontSize >= 11) {
      ctx.font = `${fontSize}px Segoe UI, sans-serif`
      widest = pending.reduce((max, item) => Math.max(max, ctx.measureText(item.text).width), 0)
      if (fits()) break
      fontSize -= 1
    }
    if (pending.length > 0 && fits()) {
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      for (const item of pending) paintEdgeLabel(ctx, item.text, item.x, item.y)
    }
  }
}

export function cellAt(map, sx, sy, view, width, height, reveal, extrude) {
  const revealed = new Set(map.revealOrder.slice(0, reveal).map(([x, y]) => `${x},${y}`))
  const order = painterOrder(map)
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const [x, y] = order[index]
    if (!revealed.has(`${x},${y}`)) continue
    const top = screenPoly(topPoints(map.cells[y][x], x, y, extrude), view, width, height)
    if (pointInPoly(sx, sy, top)) return [x, y]
  }
  return null
}

export function drawThumb(canvas, tile, level) {
  const ctx = canvas.getContext("2d")
  const fake = {
    width: 1,
    height: 1,
    cells: [[tile]],
    revealOrder: [[0, 0]],
  }
  const view = { camX: 0, camY: TILE_H / 2, zoom: canvas.width / 120 }
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawMap(ctx, canvas.width, canvas.height, {
    map: fake,
    view,
    reveal: 1,
    showLabels: false,
    level,
    selected: null,
    accepts: new Set(),
    channels: [],
    extrude: level >= 3,
  })
}
