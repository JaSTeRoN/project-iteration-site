import { screenToWorld, worldToScreen } from "../camera.js"

const SCHEME = {
  wall: "#171c15",
  room: "#6d5b3c",
  corridor: "#31402e",
  door: "#e0b15a",
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
  const { dungeon, view, frame, style, showSectors, player } = model
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = style === "terminal" ? "#050805" : "#0c100c"
  ctx.fillRect(0, 0, width, height)
  const size = view.cell * view.zoom
  for (let y = 0; y < dungeon.height; y += 1) {
    for (let x = 0; x < dungeon.width; x += 1) {
      const cell = frame.grid[y][x]
      const point = worldToScreen({ x: x * view.cell, y: y * view.cell }, view, width, height)
      const here = player && player.x === x && player.y === y
      if (style === "terminal") {
        if (cell.kind === "wall" && !here) continue
        ctx.fillStyle = here ? "#f4fff0" : "#b6e86a"
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
        ctx.fillStyle = here ? "#ffffff" : "#d7ff8a"
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
      ctx.fillStyle = item.gone ? "rgba(210, 214, 200, 0.2)" : "rgba(157, 255, 184, 0.22)"
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
        ctx.fillStyle = "#f4fff0"
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
      ctx.fillStyle = "#f2d56b"
      ctx.beginPath()
      ctx.arc(point.x, point.y, Math.max(4, size * 0.28), 0, Math.PI * 2)
      ctx.fill()
    }
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
      ctx.strokeStyle = link.extra ? "#e0b15a" : latest ? "#f2d56b" : "#9dffb8"
      ctx.lineWidth = latest ? 4 : 2
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
    })
  }
  if (showSectors) {
    ctx.strokeStyle = "rgba(181, 232, 83, 0.45)"
    ctx.lineWidth = 2
    for (const sector of dungeon.sectors) {
      const point = worldToScreen({ x: sector.x * view.cell, y: sector.y * view.cell }, view, width, height)
      ctx.strokeRect(point.x, point.y, sector.w * size, sector.h * size)
    }
  }
  if (!player && frame.focus) strokeFocus(ctx, frame, style, dungeon, view, width, height, size)
}

function strokeFocus(ctx, frame, style, dungeon, view, width, height, size) {
  const focus = frame.focus
  ctx.strokeStyle = "#f2d56b"
  ctx.lineWidth = 3
  if (focus.kind === "cell") {
    const point = worldToScreen({ x: focus.x * view.cell, y: focus.y * view.cell }, view, width, height)
    ctx.fillStyle = "rgba(242, 213, 107, 0.55)"
    ctx.fillRect(point.x, point.y, size, size)
    ctx.strokeRect(point.x + 1, point.y + 1, Math.max(1, size - 2), Math.max(1, size - 2))
    const cell = frame.grid[focus.y][focus.x]
    const mark = style === "terminal" ? glyph(cell, false) : cell.stairs === "up" ? "<" : cell.stairs === "down" ? ">" : ""
    if (mark) {
      ctx.fillStyle = "#17200c"
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
