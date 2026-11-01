import { makeRng, pick, randInt } from "../rng.js"

const PASSABLE = new Set(["room", "corridor", "door"])

export function isPassable(cell) {
  return PASSABLE.has(cell.kind)
}

function emptyGrid(width, height) {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ kind: "wall", stairs: null, gold: false })),
  )
}

function linkKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function sectorNeighbors(index, cols, rows) {
  const x = index % cols
  const y = Math.floor(index / cols)
  const list = []
  if (x > 0) list.push(index - 1)
  if (x + 1 < cols) list.push(index + 1)
  if (y > 0) list.push(index - cols)
  if (y + 1 < rows) list.push(index + cols)
  return list
}

function spanningTree(cols, rows, rng) {
  const count = cols * rows
  const inside = new Set([randInt(rng, 0, count - 1)])
  const links = new Set()
  while (inside.size < count) {
    const frontier = []
    for (const index of inside) {
      for (const next of sectorNeighbors(index, cols, rows)) {
        if (!inside.has(next)) frontier.push([index, next])
      }
    }
    const [from, to] = frontier[Math.floor(rng() * frontier.length)]
    inside.add(to)
    links.add(linkKey(from, to))
  }
  return links
}

function hLine(x0, x1, y) {
  const cells = []
  const step = Math.sign(x1 - x0)
  if (step === 0) return [[x0, y]]
  for (let x = x0; x !== x1; x += step) cells.push([x, y])
  cells.push([x1, y])
  return cells
}

function vLine(y0, y1, x) {
  const cells = []
  const step = Math.sign(y1 - y0)
  if (step === 0) return [[x, y0]]
  for (let y = y0; y !== y1; y += step) cells.push([x, y])
  cells.push([x, y1])
  return cells
}

function dedupePath(points) {
  const path = []
  for (const point of points) {
    const prev = path[path.length - 1]
    if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) path.push(point)
  }
  return path
}

function exitPoint(sector, side, rng) {
  if (!sector.room) return { ...sector.anchor, door: false }
  const room = sector.room
  if (side === "e") return { x: room.x + room.w, y: randInt(rng, room.y, room.y + room.h - 1), door: true }
  if (side === "w") return { x: room.x - 1, y: randInt(rng, room.y, room.y + room.h - 1), door: true }
  if (side === "s") return { x: randInt(rng, room.x, room.x + room.w - 1), y: room.y + room.h, door: true }
  return { x: randInt(rng, room.x, room.x + room.w - 1), y: room.y - 1, door: true }
}

function carveCell(grid, events, x, y, asDoor, width, height, text) {
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const cell = grid[y][x]
  if (cell.kind === "room") return
  if (asDoor) {
    if (cell.kind !== "door") {
      cell.kind = "door"
      events.push({ type: "door", x, y, text })
    }
    return
  }
  if (cell.kind === "wall") {
    cell.kind = "corridor"
    events.push({ type: "dig", x, y, text })
  }
}

/**
 * Коридор идёт через зазор между секторами.
 * Комнаты в этот зазор не заходят, поэтому проход их не разрезает.
 */
function linkCellText(x, y, from, to, door) {
  const pair = `секторами ${from.index + 1} и ${to.index + 1}`
  if (door) {
    return `Дверь в клетке (${x}, ${y}) между ${pair}. Коридор вошёл в комнату: дверь стоит у стены, это не новая комната.`
  }
  return `Копаем клетку (${x}, ${y}) между ${pair}. Коридор идёт уголком, сгиб в зазоре, комнату он не режет.`
}

function carveLink(westOrNorth, eastOrSouth, axis, grid, events, rng, sectorSpan, inset, width, height) {
  if (axis === "h") {
    const gapStart = (westOrNorth.c + 1) * sectorSpan - inset
    const gapEnd = (westOrNorth.c + 1) * sectorSpan + inset - 1
    const bend = randInt(rng, gapStart, gapEnd)
    const start = exitPoint(westOrNorth, "e", rng)
    const end = exitPoint(eastOrSouth, "w", rng)
    const path = dedupePath([
      ...hLine(start.x, bend, start.y),
      ...vLine(start.y, end.y, bend),
      ...hLine(bend, end.x, end.y),
    ])
    path.forEach((point, index) => {
      const isDoor = (index === 0 && start.door) || (index === path.length - 1 && end.door)
      carveCell(
        grid,
        events,
        point[0],
        point[1],
        isDoor,
        width,
        height,
        linkCellText(point[0], point[1], westOrNorth, eastOrSouth, isDoor),
      )
    })
    return
  }
  const gapStart = (westOrNorth.r + 1) * sectorSpan - inset
  const gapEnd = (westOrNorth.r + 1) * sectorSpan + inset - 1
  const bend = randInt(rng, gapStart, gapEnd)
  const start = exitPoint(westOrNorth, "s", rng)
  const end = exitPoint(eastOrSouth, "n", rng)
  const path = dedupePath([
    ...vLine(start.y, bend, start.x),
    ...hLine(start.x, end.x, bend),
    ...vLine(bend, end.y, end.x),
  ])
  path.forEach((point, index) => {
    const isDoor = (index === 0 && start.door) || (index === path.length - 1 && end.door)
    carveCell(
      grid,
      events,
      point[0],
      point[1],
      isDoor,
      width,
      height,
      linkCellText(point[0], point[1], westOrNorth, eastOrSouth, isDoor),
    )
  })
}

function flood(grid, start) {
  const seen = new Set()
  if (!start) return seen
  const queue = [start]
  seen.add(`${start[0]},${start[1]}`)
  while (queue.length > 0) {
    const [x, y] = queue.shift()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (ny < 0 || nx < 0 || ny >= grid.length || nx >= grid[0].length) continue
      const id = `${nx},${ny}`
      if (seen.has(id) || !isPassable(grid[ny][nx])) continue
      seen.add(id)
      queue.push([nx, ny])
    }
  }
  return seen
}

function passableCells(grid) {
  const list = []
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[0].length; x += 1) {
      if (isPassable(grid[y][x])) list.push([x, y])
    }
  }
  return list
}

function repairConnectivity(grid, events) {
  const all = passableCells(grid)
  if (all.length === 0) return
  let guard = 0
  while (guard < 40) {
    guard += 1
    const seen = flood(grid, all[0])
    const goal = all.find(([x, y]) => !seen.has(`${x},${y}`))
    if (!goal) return
    const path = shortestDig(grid, seen, goal)
    if (!path) return
    for (const [x, y] of path) {
      if (grid[y][x].kind !== "wall") continue
      grid[y][x].kind = "corridor"
      events.push({
        type: "dig",
        x,
        y,
        repair: true,
        text: `Клетка (${x}, ${y}): докапываем стену. Иначе часть пола осталась бы отрезанной от остального уровня.`,
      })
    }
  }
}

function shortestDig(grid, seen, goal) {
  const height = grid.length
  const width = grid[0].length
  const startKey = `${goal[0]},${goal[1]}`
  const queue = [[goal[0], goal[1]]]
  const prev = new Map([[startKey, null]])
  let touch = null
  while (queue.length > 0) {
    const [x, y] = queue.shift()
    if (!(x === goal[0] && y === goal[1]) && seen.has(`${x},${y}`)) {
      touch = [x, y]
      break
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const id = `${nx},${ny}`
      if (prev.has(id)) continue
      prev.set(id, [x, y])
      queue.push([nx, ny])
    }
  }
  if (!touch) return null
  const path = []
  let cursor = touch
  while (cursor) {
    path.push(cursor)
    cursor = prev.get(`${cursor[0]},${cursor[1]}`)
  }
  return path
}

function cellsInSector(grid, sector, kind) {
  const list = []
  if (sector.room && kind === "room") {
    for (let y = sector.room.y; y < sector.room.y + sector.room.h; y += 1) {
      for (let x = sector.room.x; x < sector.room.x + sector.room.w; x += 1) list.push([x, y])
    }
    return list
  }
  for (let y = sector.y; y < sector.y + sector.h; y += 1) {
    for (let x = sector.x; x < sector.x + sector.w; x += 1) {
      if (isPassable(grid[y][x])) list.push([x, y])
    }
  }
  if (list.length === 0 && sector.anchor) list.push([sector.anchor.x, sector.anchor.y])
  return list
}

function placeStairs(sectors, grid, events, rng) {
  const real = sectors.filter((sector) => sector.room)
  const pool = real.length >= 2 ? real : sectors.filter((sector) => cellsInSector(grid, sector).length > 0)
  if (pool.length === 0) return
  const first = pick(rng, pool)
  const secondPool = pool.filter((sector) => sector !== first)
  const second = secondPool.length > 0 ? pick(rng, secondPool) : first
  const upCells = cellsInSector(grid, first, first.room ? "room" : "any")
  const downCells = cellsInSector(grid, second, second.room ? "room" : "any")
  const up = pick(rng, upCells)
  let down = pick(rng, downCells)
  if (down[0] === up[0] && down[1] === up[1] && downCells.length > 1) {
    down = downCells.find((cell) => cell[0] !== up[0] || cell[1] !== up[1])
  }
  grid[up[1]][up[0]].stairs = "up"
  grid[down[1]][down[0]].stairs = "down"
  events.push({
    type: "stairs",
    x: up[0],
    y: up[1],
    dir: "up",
    text: `Лестница вверх в клетке (${up[0]}, ${up[1]}), сектор ${first.index + 1}. Это метка на уже готовом полу, не новый проход.`,
  })
  events.push({
    type: "stairs",
    x: down[0],
    y: down[1],
    dir: "down",
    text: `Лестница вниз в клетке (${down[0]}, ${down[1]}), сектор ${second.index + 1}. Она стоит в другом месте, чем лестница вверх.`,
  })
}

function placeGold(grid, events, rng) {
  const spots = []
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[0].length; x += 1) {
      if (grid[y][x].kind === "room" && !grid[y][x].stairs) spots.push([x, y])
    }
  }
  const count = Math.min(spots.length, randInt(rng, 3, 6))
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(rng() * spots.length)
    const [x, y] = spots.splice(index, 1)[0]
    grid[y][x].gold = true
    events.push({
      type: "gold",
      x,
      y,
      text: `Добыча в клетке (${x}, ${y}). Она кладётся после стен и коридоров и их форму не меняет.`,
    })
  }
}

export function generateDungeon(params) {
  const rng = makeRng(params.seed >>> 0)
  const cols = params.cols
  const rows = params.rows
  const sectorW = params.sectorW ?? 13
  const sectorH = params.sectorH ?? 9
  const inset = 2
  const width = cols * sectorW
  const height = rows * sectorH
  const minW = params.minRoomW ?? 4
  const minH = params.minRoomH ?? 3
  const maxW = params.maxRoomW ?? 8
  const maxH = params.maxRoomH ?? 6
  const roomChance = params.roomChance
  const extraChance = params.extraChance ?? 0.15
  const grid = emptyGrid(width, height)
  const events = []

  const sectors = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = c * sectorW
      const y = r * sectorH
      const innerX = x + inset
      const innerY = y + inset
      const innerW = sectorW - inset * 2
      const innerH = sectorH - inset * 2
      const wantRoom = rng() <= roomChance && innerW >= minW && innerH >= minH
      let room = null
      let anchor = null
      if (wantRoom) {
        const rw = randInt(rng, minW, Math.min(maxW, innerW))
        const rh = randInt(rng, minH, Math.min(maxH, innerH))
        room = {
          x: randInt(rng, innerX, innerX + innerW - rw),
          y: randInt(rng, innerY, innerY + innerH - rh),
          w: rw,
          h: rh,
        }
      } else {
        anchor = {
          x: randInt(rng, innerX, innerX + innerW - 1),
          y: randInt(rng, innerY, innerY + innerH - 1),
        }
      }
      sectors.push({
        c,
        r,
        index: r * cols + c,
        x,
        y,
        w: sectorW,
        h: sectorH,
        gone: !room,
        room,
        anchor,
      })
    }
  }

  for (const sector of sectors) {
    const row = sector.r + 1
    const col = sector.c + 1
    events.push({
      type: "decide",
      index: sector.index,
      gone: sector.gone,
      text: sector.gone
        ? `Пустой сектор ${sector.index + 1}, ряд ${row}, столбец ${col}: комнаты не будет. Точка прохода всё равно останется, коридор придёт и сюда.`
        : `В секторе ${sector.index + 1} (ряд ${row}, столбец ${col}) будет комната.`,
    })
  }

  for (const sector of sectors) {
    if (!sector.room) {
      events.push({
        type: "anchor",
        index: sector.index,
        x: sector.anchor.x,
        y: sector.anchor.y,
        text: `Точка прохода пустого сектора ${sector.index + 1}: клетка (${sector.anchor.x}, ${sector.anchor.y}). Сюда придёт коридор, хотя комнаты нет.`,
      })
      continue
    }
    events.push({
      type: "room",
      index: sector.index,
      ...sector.room,
      text: `Комната сектора ${sector.index + 1}: прямоугольник ${sector.room.w} на ${sector.room.h} клеток, левый верх (${sector.room.x}, ${sector.room.y}). До границы сектора оставлен зазор.`,
    })
    for (let y = sector.room.y; y < sector.room.y + sector.room.h; y += 1) {
      for (let x = sector.room.x; x < sector.room.x + sector.room.w; x += 1) grid[y][x].kind = "room"
    }
  }

  const links = spanningTree(cols, rows, rng)
  const extra = new Set()
  for (let index = 0; index < sectors.length; index += 1) {
    for (const next of sectorNeighbors(index, cols, rows)) {
      if (next < index) continue
      const key = linkKey(index, next)
      if (links.has(key)) continue
      if (rng() < extraChance) {
        links.add(key)
        extra.add(key)
      }
    }
  }
  for (const key of links) {
    const [a, b] = key.split("-").map(Number)
    events.push({
      type: "link",
      a,
      b,
      extra: extra.has(key),
      text: extra.has(key)
        ? `Лишний коридор между секторами ${a + 1} и ${b + 1}. Уровень уже связный, эта петля выпала по вероятности.`
        : `Обязательная связь секторов ${a + 1} и ${b + 1}. Секторы собираются в дерево: без петель, но из каждого можно дойти до каждого.`,
    })
  }

  for (const key of links) {
    const [a, b] = key.split("-").map(Number)
    const first = sectors[a]
    const second = sectors[b]
    if (first.r === second.r) {
      const west = first.c < second.c ? first : second
      const east = first.c < second.c ? second : first
      carveLink(west, east, "h", grid, events, rng, sectorW, inset, width, height)
    } else {
      const north = first.r < second.r ? first : second
      const south = first.r < second.r ? second : first
      carveLink(north, south, "v", grid, events, rng, sectorH, inset, width, height)
    }
  }

  repairConnectivity(grid, events)

  placeStairs(sectors, grid, events, rng)

  if (params.loot !== false) placeGold(grid, events, rng)

  return {
    width,
    height,
    cols,
    rows,
    sectorW,
    sectorH,
    sectors,
    events,
    grid,
    seed: params.seed >>> 0,
  }
}

export function playback(dungeon, eventCount) {
  const grid = emptyGrid(dungeon.width, dungeon.height)
  const gone = new Set()
  const decided = []
  const opened = new Set()
  const anchors = []
  const links = []
  let caption = "Нажмите пуск: уровень появляется по шагам, а не целиком."
  let focus = null
  let digs = 0
  let showPlan = true
  const count = Math.max(0, Math.min(eventCount, dungeon.events.length))
  for (let i = 0; i < count; i += 1) {
    const event = dungeon.events[i]
    caption = `Шаг ${i + 1} из ${dungeon.events.length}. ${event.text}`
    if (event.type === "decide") {
      decided.push({ index: event.index, gone: event.gone })
      if (event.gone) gone.add(event.index)
      focus = { kind: "sector", index: event.index }
    } else if (event.type === "room") {
      for (let y = event.y; y < event.y + event.h; y += 1) {
        for (let x = event.x; x < event.x + event.w; x += 1) grid[y][x].kind = "room"
      }
      opened.add(event.index)
      focus = { kind: "rect", x: event.x, y: event.y, w: event.w, h: event.h }
    } else if (event.type === "anchor") {
      anchors.push(event)
      opened.add(event.index)
      focus = { kind: "cell", x: event.x, y: event.y }
    } else if (event.type === "link") {
      links.push(event)
      focus = { kind: "link", a: event.a, b: event.b }
    } else if (event.type === "dig") {
      if (grid[event.y][event.x].kind === "wall") grid[event.y][event.x].kind = "corridor"
      digs += 1
      showPlan = false
      focus = { kind: "cell", x: event.x, y: event.y }
    } else if (event.type === "door") {
      grid[event.y][event.x].kind = "door"
      showPlan = false
      focus = { kind: "cell", x: event.x, y: event.y }
    } else if (event.type === "stairs") {
      grid[event.y][event.x].stairs = event.dir
      showPlan = false
      focus = { kind: "cell", x: event.x, y: event.y }
    } else if (event.type === "gold") {
      grid[event.y][event.x].gold = true
      showPlan = false
      focus = { kind: "cell", x: event.x, y: event.y }
    }
  }
  return {
    grid,
    caption,
    gone,
    decided,
    opened,
    anchors,
    links,
    digs,
    focus,
    showPlan,
    done: count >= dungeon.events.length,
  }
}

export function findStairs(grid, dir) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[0].length; x += 1) {
      if (grid[y][x].stairs === dir) return { x, y }
    }
  }
  return null
}

export function allReachable(grid) {
  const stair = findStairs(grid, "up")
  const start = stair ? [stair.x, stair.y] : passableCells(grid)[0]
  if (!start) return false
  const seen = flood(grid, start)
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[0].length; x += 1) {
      const cell = grid[y][x]
      if (!isPassable(cell) && !cell.stairs) continue
      if (!seen.has(`${x},${y}`)) return false
    }
  }
  return true
}

export function doorsTouchRooms(grid) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[0].length; x += 1) {
      if (grid[y][x].kind !== "door") continue
      let room = false
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (ny < 0 || nx < 0 || ny >= grid.length || nx >= grid[0].length) continue
        if (grid[ny][nx].kind === "room") room = true
      }
      if (!room) return false
    }
  }
  return true
}

export function gridsMatch(a, b) {
  if (a.length !== b.length || a[0].length !== b[0].length) return false
  for (let y = 0; y < a.length; y += 1) {
    for (let x = 0; x < a[0].length; x += 1) {
      if (a[y][x].kind !== b[y][x].kind) return false
      if (a[y][x].stairs !== b[y][x].stairs) return false
      if (a[y][x].gold !== b[y][x].gold) return false
    }
  }
  return true
}

export function sectorOf(dungeon, x, y) {
  const c = Math.floor(x / dungeon.sectorW)
  const r = Math.floor(y / dungeon.sectorH)
  if (c < 0 || r < 0 || c >= dungeon.cols || r >= dungeon.rows) return -1
  return r * dungeon.cols + c
}
