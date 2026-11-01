import { makeRng, pick, randInt, shuffle } from "../rng.js"

export const DIRS = ["n", "e", "s", "w"]
export const OPPOSITE = { n: "s", s: "n", e: "w", w: "e" }
export const DELTA = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }

const SIDE_RU = { n: "север", e: "восток", s: "юг", w: "запад" }
const TOUCH_RU = { n: "юг", e: "запад", s: "север", w: "восток" }

export const LEVEL_PRESETS = {
  2: {
    channels: ["road"],
    width: 10,
    height: 8,
    roadPaths: 3,
    waterPaths: 0,
    colorMax: 10,
    heightMax: 0,
    objectDensity: 0,
    extrude: false,
  },
  3: {
    channels: ["road", "grassColor", "grassHeight"],
    width: 10,
    height: 8,
    roadPaths: 3,
    waterPaths: 0,
    colorMax: 10,
    heightMax: 5,
    objectDensity: 0,
    extrude: true,
  },
  4: {
    channels: ["road", "water", "grassColor", "grassHeight"],
    width: 12,
    height: 9,
    roadPaths: 3,
    waterPaths: 3,
    colorMax: 10,
    heightMax: 5,
    objectDensity: 0.18,
    extrude: true,
  },
}

export function edge(partial = {}) {
  return {
    color: partial.color ?? null,
    road: partial.road ?? null,
    water: partial.water ?? null,
    grassColor: partial.grassColor ?? null,
    grassHeight: partial.grassHeight ?? null,
  }
}

export function makeTile(sides, id, object = "none") {
  return {
    id,
    n: edge(sides.n),
    e: edge(sides.e),
    s: edge(sides.s),
    w: edge(sides.w),
    object,
  }
}

export function edgesEqual(a, b, channels) {
  return channels.every((key) => a[key] === b[key])
}

export function describeEdge(value, channels) {
  const parts = []
  if (channels.includes("color")) parts.push(`цвет ${value.color}`)
  if (channels.includes("road")) parts.push(value.road ? "дорога (1)" : "нет дороги (0)")
  if (channels.includes("water")) parts.push(value.water ? "вода (1)" : "нет воды (0)")
  if (channels.includes("grassColor")) parts.push(`цвет травы ${value.grassColor}`)
  if (channels.includes("grassHeight")) parts.push(`высота ${value.grassHeight}`)
  return parts.join(", ")
}

export function describeTile(tile, channels) {
  return DIRS.map((side) => `${SIDE_RU[side]}: ${describeEdge(tile[side], channels)}`).join("\n")
}

export function placementCheck(tile, neighbors, channels) {
  for (const side of DIRS) {
    const other = neighbors[side]
    if (!other) continue
    if (!edgesEqual(tile[side], other[OPPOSITE[side]], channels)) {
      return {
        ok: false,
        side,
        text: `Не подходит: ${SIDE_RU[side]} этой плитки — ${describeEdge(tile[side], channels)}, а ${TOUCH_RU[side]} соседа — ${describeEdge(other[OPPOSITE[side]], channels)}.`,
      }
    }
  }
  return { ok: true, text: "" }
}

export function emptyBoard(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => null))
}

export function inBounds(board, x, y) {
  return y >= 0 && y < board.length && x >= 0 && x < board[0].length
}

export function neighborsOf(board, x, y) {
  const neighbors = { n: null, e: null, s: null, w: null }
  for (const side of DIRS) {
    const nx = x + DELTA[side][0]
    const ny = y + DELTA[side][1]
    neighbors[side] = inBounds(board, nx, ny) ? board[ny][nx] : null
  }
  return neighbors
}

export function anyPlaced(board) {
  return board.some((row) => row.some(Boolean))
}

export function centerCell(width, height) {
  return [Math.floor((width - 1) / 2), Math.floor((height - 1) / 2)]
}

function hasPlacedNeighbor(board, x, y) {
  return DIRS.some((side) => {
    const nx = x + DELTA[side][0]
    const ny = y + DELTA[side][1]
    return inBounds(board, nx, ny) && board[ny][nx]
  })
}

/** Куда сейчас вообще можно пробовать ставить плитку. */
export function candidateCells(board) {
  const height = board.length
  const width = board[0].length
  if (!anyPlaced(board)) return [centerCell(width, height)]
  const cells = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!board[y][x] && hasPlacedNeighbor(board, x, y)) cells.push([x, y])
    }
  }
  return cells
}

export function deadEnd(board, tray, channels) {
  if (tray.length === 0) return false
  const spots = candidateCells(board)
  if (spots.length === 0) return true
  return !tray.some((tile) =>
    spots.some(([x, y]) => placementCheck(tile, neighborsOf(board, x, y), channels).ok),
  )
}

function growBlob(width, height, originX, originY, count, rng) {
  const key = (x, y) => `${x},${y}`
  const cells = [[originX, originY]]
  const used = new Set([key(originX, originY)])
  while (cells.length < count) {
    const frontier = []
    const seen = new Set()
    for (const [x, y] of cells) {
      for (const side of DIRS) {
        const nx = x + DELTA[side][0]
        const ny = y + DELTA[side][1]
        const id = key(nx, ny)
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || used.has(id) || seen.has(id)) continue
        seen.add(id)
        frontier.push([nx, ny])
      }
    }
    if (frontier.length === 0) break
    const next = frontier[Math.floor(rng() * frontier.length)]
    used.add(key(next[0], next[1]))
    cells.push(next)
  }
  return cells
}

/**
 * Раздача для ручной сборки. Общие стороны получают один цвет,
 * поэтому у раздачи есть хотя бы одно полное решение.
 * Плитки не поворачиваются: север остаётся севером.
 */
export function dealLevel1({ width, height, tileCount, colorCount, seed }) {
  const colors = Math.max(2, Math.min(8, colorCount))
  const count = Math.max(1, Math.min(tileCount, width * height))
  const rng = makeRng(seed)
  const [centerX, centerY] = centerCell(width, height)
  const blob = growBlob(width, height, centerX, centerY, count, rng)
  const assigned = new Map()
  const colorFor = (id) => {
    if (!assigned.has(id)) assigned.set(id, randInt(rng, 0, colors - 1))
    return assigned.get(id)
  }
  const solutionOrder = blob.map(([x, y], index) => ({
    x,
    y,
    tile: makeTile(
      {
        n: edge({ color: colorFor(`h:${x}:${y}`) }),
        s: edge({ color: colorFor(`h:${x}:${y + 1}`) }),
        w: edge({ color: colorFor(`v:${x}:${y}`) }),
        e: edge({ color: colorFor(`v:${x + 1}:${y}`) }),
      },
      `L1-${seed}-${index}`,
    ),
  }))
  return {
    width,
    height,
    center: [centerX, centerY],
    tileCount: count,
    colorCount: colors,
    clamped: count !== tileCount,
    solutionOrder,
    tray: shuffle(rng, solutionOrder.map((item) => item.tile)),
  }
}

function bilinear(grid, x0, y0, x1, y1, tx, ty) {
  const v00 = grid[y0][x0]
  const v10 = grid[y0][x1]
  const v01 = grid[y1][x0]
  const v11 = grid[y1][x1]
  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty
}

function smoothCorners(width, height, rng, colorMax, heightMax) {
  const coarseW = 4
  const coarseH = 4
  const colorGrid = Array.from({ length: coarseH }, () =>
    Array.from({ length: coarseW }, () => randInt(rng, 0, colorMax)),
  )
  const heightGrid = Array.from({ length: coarseH }, () =>
    Array.from({ length: coarseW }, () => randInt(rng, 0, heightMax)),
  )
  const corners = []
  for (let y = 0; y < height; y += 1) {
    const row = []
    const gy = height === 1 ? 0 : (y / (height - 1)) * (coarseH - 1)
    const y0 = Math.floor(gy)
    const y1 = Math.min(coarseH - 1, y0 + 1)
    const ty = gy - y0
    for (let x = 0; x < width; x += 1) {
      const gx = width === 1 ? 0 : (x / (width - 1)) * (coarseW - 1)
      const x0 = Math.floor(gx)
      const x1 = Math.min(coarseW - 1, x0 + 1)
      const tx = gx - x0
      row.push({
        grassColor: Math.max(0, Math.min(colorMax, Math.round(bilinear(colorGrid, x0, y0, x1, y1, tx, ty)))),
        grassHeight: Math.max(0, Math.min(heightMax, Math.round(bilinear(heightGrid, x0, y0, x1, y1, tx, ty)))),
      })
    }
    corners.push(row)
  }
  return corners
}

function edgeRecord(hEdges, vEdges, x, y, side) {
  if (side === "n") return hEdges[y][x]
  if (side === "s") return hEdges[y + 1][x]
  if (side === "w") return vEdges[y][x]
  return vEdges[y][x + 1]
}

function cellHasRoad(hEdges, vEdges, x, y) {
  return DIRS.some((side) => edgeRecord(hEdges, vEdges, x, y, side).road === 1)
}

function roadBlocked(hEdges, vEdges, width, height) {
  return (x, y, side) => {
    if (edgeRecord(hEdges, vEdges, x, y, side).road) return true
    const nx = x + DELTA[side][0]
    const ny = y + DELTA[side][1]
    if (cellHasRoad(hEdges, vEdges, nx, ny)) return true
    for (const dir of DIRS) {
      if (dir === OPPOSITE[side]) continue
      const ax = nx + DELTA[dir][0]
      const ay = ny + DELTA[dir][1]
      if (ax < 0 || ay < 0 || ax >= width || ay >= height) continue
      if (cellHasRoad(hEdges, vEdges, ax, ay)) return true
    }
    return false
  }
}

function carveWalks(width, height, count, rng, visit, walk = {}) {
  const turnChance = walk.turnChance
  const blocked = walk.blocked
  const occupied = walk.occupied
  const length = Math.max(4, Math.round((width + height) * (walk.lengthFactor ?? 0.75)))
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height
  const freeSides = (x, y, heading) => DIRS.filter((side) => {
    const nx = x + DELTA[side][0]
    const ny = y + DELTA[side][1]
    if (!inside(nx, ny)) return false
    if (heading && side === OPPOSITE[heading]) return false
    return !(blocked && blocked(x, y, side))
  })
  for (let path = 0; path < count; path += 1) {
    let x = 0
    let y = 0
    let found = false
    for (let attempt = 0; attempt < 24; attempt += 1) {
      x = randInt(rng, 0, width - 1)
      y = randInt(rng, 0, height - 1)
      if (occupied?.(x, y)) continue
      if (freeSides(x, y, null).length > 0) {
        found = true
        break
      }
    }
    if (!found) continue
    let heading = null
    for (let step = 0; step < length; step += 1) {
      const options = freeSides(x, y, heading)
      if (options.length === 0) break
      const straight = heading && options.includes(heading) ? heading : null
      const turns = options.filter((side) => side !== heading)
      let side
      if (turnChance == null) side = pick(rng, options)
      else if (straight && (turns.length === 0 || rng() >= turnChance)) side = straight
      else side = pick(rng, turns.length > 0 ? turns : options)
      visit(x, y, side)
      x += DELTA[side][0]
      y += DELTA[side][1]
      heading = side
    }
  }
}

function cornerPair(corners, x, y, side) {
  if (side === "n") return [corners[y][x], corners[y][x + 1]]
  if (side === "s") return [corners[y + 1][x], corners[y + 1][x + 1]]
  if (side === "w") return [corners[y][x], corners[y + 1][x]]
  return [corners[y][x + 1], corners[y + 1][x + 1]]
}

function tileWet(tile) {
  return DIRS.some((side) => tile[side].water === 1)
}

export function objectOptions(tile, neighbors = { n: null, e: null, s: null, w: null }) {
  const road = DIRS.some((side) => tile[side].road === 1)
  const waterEdges = DIRS.filter((side) => tile[side].water === 1).length
  const pond = waterEdges >= 3
  const nearWater = waterEdges > 0 || DIRS.some((side) => neighbors[side] && tileWet(neighbors[side]))
  const averageHeight = DIRS.reduce((sum, side) => sum + (tile[side].grassHeight ?? 0), 0) / 4
  const options = ["none"]
  if (!road && waterEdges === 0 && averageHeight <= 2) options.push("rock")
  if (!road && waterEdges === 0 && averageHeight >= 2) options.push("tree")
  if (nearWater && !road) options.push("reed")
  return options
}

function placeObjects(cells, rng, density) {
  if (density <= 0) return
  for (let y = 0; y < cells.length; y += 1) {
    for (let x = 0; x < cells[0].length; x += 1) {
      if (rng() > density) continue
      const options = objectOptions(cells[y][x], neighborsOf(cells, x, y)).filter((item) => item !== "none")
      if (options.length > 0) cells[y][x].object = pick(rng, options)
    }
  }
}

/**
 * Карта собирается с общих рёбер: каждое ребро записывается один раз.
 * Поэтому у автоматической карты нет плохого шва и нет тупика.
 */
export function generateMap(options) {
  const width = options.width
  const height = options.height
  const rng = makeRng(options.seed >>> 0)
  const colorMax = options.colorMax ?? 10
  const heightMax = options.heightMax ?? 5
  const channels = options.channels
  const hEdges = Array.from({ length: height + 1 }, () =>
    Array.from({ length: width }, () => ({ road: 0, water: 0 })),
  )
  const vEdges = Array.from({ length: height }, () =>
    Array.from({ length: width + 1 }, () => ({ road: 0, water: 0 })),
  )
  carveWalks(width, height, options.roadPaths ?? 0, rng, (x, y, side) => {
    edgeRecord(hEdges, vEdges, x, y, side).road = 1
  }, {
    turnChance: 0.12,
    lengthFactor: 1.35,
    blocked: roadBlocked(hEdges, vEdges, width, height),
    occupied: (x, y) => cellHasRoad(hEdges, vEdges, x, y),
  })
  if (channels.includes("water") && (options.waterPaths ?? 0) > 0) {
    carveWalks(width, height, options.waterPaths, rng, (x, y, side) => {
      const record = edgeRecord(hEdges, vEdges, x, y, side)
      if (!record.road) record.water = 1
    })
    const ponds = Math.max(1, Math.round(options.waterPaths / 2))
    for (let i = 0; i < ponds; i += 1) {
      const x = randInt(rng, 0, width - 1)
      const y = randInt(rng, 0, height - 1)
      for (const side of DIRS) {
        const record = edgeRecord(hEdges, vEdges, x, y, side)
        if (!record.road) record.water = 1
      }
    }
  }
  const corners = smoothCorners(width + 1, height + 1, rng, colorMax, heightMax)
  const cells = []
  for (let y = 0; y < height; y += 1) {
    const row = []
    for (let x = 0; x < width; x += 1) {
      const sides = {}
      for (const side of DIRS) {
        const record = edgeRecord(hEdges, vEdges, x, y, side)
        const [first, second] = cornerPair(corners, x, y, side)
        sides[side] = edge({
          road: record.road,
          water: record.water,
          grassColor: Math.round((first.grassColor + second.grassColor) / 2),
          grassHeight: Math.round((first.grassHeight + second.grassHeight) / 2),
        })
      }
      row.push(makeTile(sides, `m-${x}-${y}`))
    }
    cells.push(row)
  }
  placeObjects(cells, rng, options.objectDensity ?? 0)
  const revealOrder = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) revealOrder.push([x, y])
  }
  return { width, height, cells, revealOrder, channels }
}

export function badSeams(cells, channels) {
  const bad = []
  for (let y = 0; y < cells.length; y += 1) {
    for (let x = 0; x < cells[0].length; x += 1) {
      if (x + 1 < cells[0].length && !edgesEqual(cells[y][x].e, cells[y][x + 1].w, channels)) {
        bad.push({ x, y, side: "e" })
      }
      if (y + 1 < cells.length && !edgesEqual(cells[y][x].s, cells[y + 1][x].n, channels)) {
        bad.push({ x, y, side: "s" })
      }
    }
  }
  return bad
}

export function signature(tile, channels) {
  return channels.map((key) => DIRS.map((side) => tile[side][key]).join(",")).join("|")
}

export function catalog(cells, channels) {
  const seen = new Map()
  for (const row of cells) {
    for (const tile of row) {
      const key = signature(tile, channels)
      if (!seen.has(key)) {
        seen.set(key, makeTile({ n: tile.n, e: tile.e, s: tile.s, w: tile.w }, `cat-${seen.size}`))
      }
    }
  }
  return [...seen.values()]
}

export function acceptsAnywhere(cells, tile, channels) {
  const spots = []
  for (let y = 0; y < cells.length; y += 1) {
    for (let x = 0; x < cells[0].length; x += 1) {
      if (placementCheck(tile, neighborsOf(cells, x, y), channels).ok) spots.push([x, y])
    }
  }
  return spots
}

export function tryReplace(cells, x, y, incoming, channels) {
  const neighbors = neighborsOf(cells, x, y)
  const check = placementCheck(incoming, neighbors, channels)
  if (!check.ok) return check
  const previous = cells[y][x]
  const next = makeTile(
    { n: incoming.n, e: incoming.e, s: incoming.s, w: incoming.w },
    previous.id,
    "none",
  )
  const options = objectOptions(next, neighbors)
  next.object = options.includes(previous.object) ? previous.object : "none"
  cells[y][x] = next
  return { ok: true, text: "Плитка встала: стороны совпали с соседями." }
}

export function applyObject(cells, x, y, object) {
  const tile = cells[y][x]
  const options = objectOptions(tile, neighborsOf(cells, x, y))
  if (!options.includes(object)) {
    return { ok: false, text: "На эту клетку такой объект не ставится." }
  }
  tile.object = object
  return { ok: true, text: object === "none" ? "Объект убран." : "Объект поставлен." }
}

export function averageHeight(tile) {
  return DIRS.reduce((sum, side) => sum + (tile[side].grassHeight ?? 0), 0) / 4
}

export function waterEdges(tile) {
  return DIRS.filter((side) => tile[side].water === 1).length
}
