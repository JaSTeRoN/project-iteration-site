import { screenToWorld, worldToScreen } from "../camera.js"

const SCHEME = {
  wall: "#08131f",
  room: "#1d4165",
  corridor: "#14304a",
  door: "#ffd76a",
}

export function fitDungeon(dungeon, width, height) {
  const cell = 18
  const worldW = dungeon.width * cell
  const worldH = dungeon.height * cell
  const zoom = Math.min((width - 16) / worldW, (height - 16) / worldH)
  return {
    camX: worldW / 2,
    camY: worldH / 2,
    zoom: Math.max(0.15, Math.min(5, zoom)),
    cell,
  }
}

function glyph(cell, playerHere) {
  if (playerHere) return "@"
  if (cell.stairs === "up") return "<"
  if (cell.stairs === "down") return ">"
  if (cell.gold) return "$"
  if (cell.kind === "door") return "+"
  if (cell.kind === "room") return "."
  if (cell.kind === "corridor") return "#"
  return ""
}

export function drawDungeon(ctx, width, height, model) {
  const { dungeon, view, frame, style, showSectors, showGrid, player, hover, selected } = model
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = style === "terminal" ? "#050a12" : "#07111c"
  ctx.fillRect(0, 0, width, height)
  const size = view.cell * view.zoom
  for (let y = 0; y < dungeon.height; y += 1) {
    for (let x = 0; x < dungeon.width; x += 1) {
      const cell = frame.grid[y][x]
      const point = worldToScreen({ x: x * view.cell, y: y * view.cell }, view, width, height)
      const here = player && player.x === x && player.y === y
      if (style === "terminal") {
        if (cell.kind === "wall" && !here) continue
        ctx.fillStyle = here ? "#ffffff" : "#9fd8ff"
        ctx.font = `${Math.max(10, size * 0.82)}px Consolas, monospace`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(glyph(cell, here), point.x + size / 2, point.y + size / 2)
        continue
      }
      ctx.fillStyle = SCHEME[cell.kind] ?? SCHEME.wall
      ctx.fillRect(point.x, point.y, size + 0.5, size + 0.5)
      if (cell.gold) {
        ctx.fillStyle = "#ffd76a"
        ctx.beginPath()
        ctx.arc(point.x + size * 0.72, point.y + size * 0.28, Math.max(2, size * 0.16), 0, Math.PI * 2)
        ctx.fill()
      }
      if (cell.stairs || here) {
        ctx.fillStyle = here ? "#ffffff" : "#9dffb8"
        ctx.font = `700 ${Math.max(10, size * 0.7)}px Consolas, monospace`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        const mark = here ? "@" : cell.stairs === "up" ? "<" : ">"
        ctx.fillText(mark, point.x + size / 2, point.y + size / 2)
      }
    }
  }
  if (frame.showPlan) {
    for (const item of frame.decided) {
      const sector = dungeon.sectors[item.index]
      ctx.fillStyle = item.gone ? "rgba(150, 180, 210, 0.16)" : "rgba(157, 255, 184, 0.2)"
      for (let y = sector.y; y < sector.y + sector.h; y += 1) {
        for (let x = sector.x; x < sector.x + sector.w; x += 1) {
          if (frame.grid[y][x].kind !== "wall") continue
          const point = worldToScreen({ x: x * view.cell, y: y * view.cell }, view, width, height)
          ctx.fillRect(point.x, point.y, size + 0.5, size + 0.5)
        }
      }
      if (!frame.opened.has(item.index)) {
        const mid = worldToScreen(
          { x: (sector.x + sector.w / 2) * view.cell, y: (sector.y + sector.h / 2) * view.cell },
          view,
          width,
          height,
        )
        ctx.fillStyle = "#eef5fc"
        ctx.font = `${Math.max(11, 13 * view.zoom)}px Segoe UI, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(item.gone ? "пусто" : "комната", mid.x, mid.y)
      }
    }
    for (const anchor of frame.anchors) {
      const point = worldToScreen(
        { x: anchor.x * view.cell + view.cell / 2, y: anchor.y * view.cell + view.cell / 2 },
        view,
        width,
        height,
      )
      ctx.fillStyle = "#ffd76a"
      ctx.beginPath()
      ctx.arc(point.x, point.y, Math.max(4, size * 0.28), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (!player) {
    frame.links.forEach((link, index) => {
      const latest = index === frame.links.length - 1
      const from = dungeon.sectors[link.a]
      const to = dungeon.sectors[link.b]
      const start = worldToScreen(
        { x: (from.x + from.w / 2) * view.cell, y: (from.y + from.h / 2) * view.cell },
        view,
        width,
        height,
      )
      const end = worldToScreen(
        { x: (to.x + to.w / 2) * view.cell, y: (to.y + to.h / 2) * view.cell },
        view,
        width,
        height,
      )
      ctx.save()
      ctx.globalAlpha = latest ? 1 : 0.7
      ctx.strokeStyle = link.extra ? "#ffd76a" : latest ? "#9dffb8" : "#4f8fd0"
      ctx.lineWidth = latest ? 4 : 2
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
      if (latest) {
        ctx.fillStyle = "#9dffb8"
        for (const point of [start, end]) {
          ctx.beginPath()
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()
    })
  }
  if (showSectors) {
    ctx.strokeStyle = "rgba(120, 180, 255, 0.4)"
    ctx.lineWidth = 2
    for (const sector of dungeon.sectors) {
      const point = worldToScreen({ x: sector.x * view.cell, y: sector.y * view.cell }, view, width, height)
      ctx.strokeRect(point.x, point.y, sector.w * size, sector.h * size)
      drawSectorGaps(ctx, sector, dungeon.inset ?? 2, view, width, height)
    }
  }
  if (showGrid) drawGrid(ctx, dungeon, view, width, height)
  if (hover) drawCellMarker(ctx, hover, view, width, height, "#9dffb8", "rgba(157, 255, 184, 0.18)")
  if (selected) drawCellMarker(ctx, selected, view, width, height, "#ffd76a", "rgba(255, 215, 106, 0.2)")
  if (!player && frame.focus) strokeFocus(ctx, frame, style, dungeon, view, width, height, size)
}

function drawSectorGaps(ctx, sector, inset, view, width, height) {
  const size = view.cell * view.zoom
  const point = worldToScreen({ x: sector.x * view.cell, y: sector.y * view.cell }, view, width, height)
  const margin = inset * size
  const w = sector.w * size
  const h = sector.h * size
  ctx.save()
  ctx.strokeStyle = "rgba(255, 215, 106, 0.42)"
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(point.x + margin, point.y + margin, w - margin * 2, h - margin * 2)
  ctx.setLineDash([])
  ctx.restore()
}

function drawGrid(ctx, dungeon, view, width, height) {
  ctx.save()
  ctx.strokeStyle = "rgba(150, 195, 240, 0.16)"
  ctx.lineWidth = 1
  for (let x = 0; x <= dungeon.width; x += 1) {
    const top = worldToScreen({ x: x * view.cell, y: 0 }, view, width, height)
    const bottom = worldToScreen({ x: x * view.cell, y: dungeon.height * view.cell }, view, width, height)
    ctx.beginPath()
    ctx.moveTo(top.x, top.y)
    ctx.lineTo(bottom.x, bottom.y)
    ctx.stroke()
  }
  for (let y = 0; y <= dungeon.height; y += 1) {
    const left = worldToScreen({ x: 0, y: y * view.cell }, view, width, height)
    const right = worldToScreen({ x: dungeon.width * view.cell, y: y * view.cell }, view, width, height)
    ctx.beginPath()
    ctx.moveTo(left.x, left.y)
    ctx.lineTo(right.x, right.y)
    ctx.stroke()
  }
  ctx.fillStyle = "rgba(210, 232, 255, 0.7)"
  ctx.font = "600 10px Segoe UI, sans-serif"
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  for (let x = 5; x < dungeon.width; x += 5) {
    const point = worldToScreen({ x: x * view.cell, y: 0 }, view, width, height)
    ctx.fillText(String(x), point.x + 3, point.y + 2)
  }
  for (let y = 5; y < dungeon.height; y += 5) {
    const point = worldToScreen({ x: 0, y: y * view.cell }, view, width, height)
    ctx.fillText(String(y), point.x + 2, point.y + 2)
  }
  ctx.restore()
}

function drawCellMarker(ctx, cell, view, width, height, color, fill) {
  const [x, y] = cell
  const size = view.cell * view.zoom
  const point = worldToScreen({ x: x * view.cell, y: y * view.cell }, view, width, height)
  ctx.save()
  ctx.fillStyle = fill
  ctx.fillRect(point.x, point.y, size, size)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.strokeRect(point.x + 1, point.y + 1, Math.max(1, size - 2), Math.max(1, size - 2))
  const label = `${x}, ${y}`
  ctx.font = "600 12px Segoe UI, sans-serif"
  const textWidth = ctx.measureText(label).width
  let left = point.x + size + 6
  let top = point.y - 4
  if (left + textWidth + 10 > width) left = point.x - textWidth - 14
  if (top < 2) top = 2
  if (top + 18 > height) top = height - 18
  ctx.fillStyle = "rgba(7, 17, 28, 0.9)"
  ctx.fillRect(left - 4, top, textWidth + 10, 18)
  ctx.fillStyle = color
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  ctx.fillText(label, left + 1, top + 3)
  ctx.restore()
}

function strokeFocus(ctx, frame, style, dungeon, view, width, height, size) {
  const focus = frame.focus
  ctx.strokeStyle = "#ffd76a"
  ctx.lineWidth = 3
  if (focus.kind === "cell") {
    const point = worldToScreen({ x: focus.x * view.cell, y: focus.y * view.cell }, view, width, height)
    ctx.fillStyle = "rgba(255, 215, 106, 0.45)"
    ctx.fillRect(point.x, point.y, size, size)
    ctx.strokeRect(point.x + 1, point.y + 1, Math.max(1, size - 2), Math.max(1, size - 2))
    const cell = frame.grid[focus.y][focus.x]
    const mark = style === "terminal" ? glyph(cell, false) : cell.stairs === "up" ? "<" : cell.stairs === "down" ? ">" : ""
    if (mark) {
      ctx.fillStyle = "#0b1622"
      ctx.font = `700 ${Math.max(10, size * 0.7)}px Consolas, monospace`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(mark, point.x + size / 2, point.y + size / 2)
    }
    return
  }
  if (focus.kind === "rect") {
    const point = worldToScreen({ x: focus.x * view.cell, y: focus.y * view.cell }, view, width, height)
    ctx.strokeRect(point.x + 1, point.y + 1, focus.w * size - 2, focus.h * size - 2)
    return
  }
  if (focus.kind === "link") {
    const a = dungeon.sectors[focus.a]
    const b = dungeon.sectors[focus.b]
    const inset = dungeon.inset ?? 2
    const event = [...frame.links].reverse().find((item) => item.a === focus.a && item.b === focus.b)
    ctx.save()
    ctx.fillStyle = "rgba(255, 215, 106, 0.08)"
    ctx.strokeStyle = "rgba(255, 215, 106, 0.7)"
    ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    if (a.r === b.r) {
      const boundary = (Math.min(a.c, b.c) + 1) * dungeon.sectorW
      const point = worldToScreen(
        { x: (boundary - inset) * view.cell, y: Math.min(a.y, b.y) * view.cell },
        view,
        width,
        height,
      )
      const w = inset * 2 * size
      const h = a.h * size
      ctx.fillRect(point.x, point.y, w, h)
      ctx.strokeRect(point.x, point.y, w, h)
      if (event?.bend) {
        const line = worldToScreen(
          { x: event.bend.value * view.cell, y: Math.min(a.y, b.y) * view.cell },
          view,
          width,
          height,
        )
        ctx.setLineDash([])
        ctx.strokeStyle = "#ffd76a"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(line.x, line.y)
        ctx.lineTo(line.x, line.y + h)
        ctx.stroke()
      }
    } else {
      const boundary = (Math.min(a.r, b.r) + 1) * dungeon.sectorH
      const point = worldToScreen(
        { x: Math.min(a.x, b.x) * view.cell, y: (boundary - inset) * view.cell },
        view,
        width,
        height,
      )
      const w = a.w * size
      const h = inset * 2 * size
      ctx.fillRect(point.x, point.y, w, h)
      ctx.strokeRect(point.x, point.y, w, h)
      if (event?.bend) {
        const line = worldToScreen(
          { x: Math.min(a.x, b.x) * view.cell, y: event.bend.value * view.cell },
          view,
          width,
          height,
        )
        ctx.setLineDash([])
        ctx.strokeStyle = "#ffd76a"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(line.x, line.y)
        ctx.lineTo(line.x + w, line.y)
        ctx.stroke()
      }
    }
    ctx.setLineDash([])
    if (event?.corners) {
      for (const [cx, cy] of event.corners) {
        const point = worldToScreen(
          { x: cx * view.cell + view.cell / 2, y: cy * view.cell + view.cell / 2 },
          view,
          width,
          height,
        )
        ctx.fillStyle = "#ffd76a"
        ctx.beginPath()
        ctx.arc(point.x, point.y, Math.max(3, size * 0.2), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
    return
  }
  if (focus.kind === "sector") {
    const sector = dungeon.sectors[focus.index]
    const point = worldToScreen({ x: sector.x * view.cell, y: sector.y * view.cell }, view, width, height)
    ctx.strokeRect(point.x + 1, point.y + 1, sector.w * size - 2, sector.h * size - 2)
  }
}

export function cellAt(view, sx, sy, width, height, dungeon) {
  const world = screenToWorld(sx, sy, view, width, height)
  const x = Math.floor(world.x / view.cell)
  const y = Math.floor(world.y / view.cell)
  if (x < 0 || y < 0 || x >= dungeon.width || y >= dungeon.height) return null
  return [x, y]
}
