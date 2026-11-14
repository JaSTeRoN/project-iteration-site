import { makeRng } from "../rng.js"

function copyGrid(grid) {
  return grid.map((row) => row.slice())
}

function normalize(size, grid, phases, min, max) {
  const range = max - min || 1
  const normalized = grid.map((row) => row.map((value) => (value - min) / range))
  const normalizedPhases = phases.map((phase) => ({
    ...phase,
    grid: phase.grid.map((row) => row.map((value) => (value === null ? null : (value - min) / range))),
    added: phase.added.map((cell) => ({
      ...cell,
      value: (cell.value - min) / range,
      average: (cell.average - min) / range,
      offset: cell.offset / range,
      neighbors: cell.neighbors.map(({ x, y }) => ({ x, y, value: (grid[y][x] - min) / range })),
    })),
  }))
  return { size, grid: normalized, phases: normalizedPhases, min, max, range }
}

export function generateDiamondSquare(size, roughness = 0.55, seed = 1) {
  if (!Number.isInteger(size) || size < 3 || (size - 1 & (size - 2)) !== 0) {
    throw new Error("Размер сетки должен быть 2^n + 1")
  }
  const rng = makeRng(seed)
  const grid = Array.from({ length: size }, () => Array(size).fill(null))
  const phases = []

  const setCell = (x, y, value) => {
    grid[y][x] = value
  }

  setCell(0, 0, rng())
  setCell(size - 1, 0, rng())
  setCell(0, size - 1, rng())
  setCell(size - 1, size - 1, rng())

  const corners = [
    { x: 0, y: 0, value: grid[0][0], average: grid[0][0], offset: 0, neighbors: [] },
    { x: size - 1, y: 0, value: grid[0][size - 1], average: grid[0][size - 1], offset: 0, neighbors: [] },
    { x: 0, y: size - 1, value: grid[size - 1][0], average: grid[size - 1][0], offset: 0, neighbors: [] },
    { x: size - 1, y: size - 1, value: grid[size - 1][size - 1], average: grid[size - 1][size - 1], offset: 0, neighbors: [] },
  ]
  phases.push({ kind: "corners", step: size - 1, grid: copyGrid(grid), added: corners })

  let step = size - 1
  let scale = 1
  while (step > 1) {
    const half = step / 2

    const diamondCells = []
    for (let y = half; y < size; y += step) {
      for (let x = half; x < size; x += step) {
        const neighbors = [
          [x - half, y - half],
          [x + half, y - half],
          [x - half, y + half],
          [x + half, y + half],
        ].filter(([nx, ny]) => nx >= 0 && nx < size && ny >= 0 && ny < size && grid[ny][nx] !== null)
        const average = neighbors.reduce((sum, [nx, ny]) => sum + grid[ny][nx], 0) / neighbors.length
        const offset = (rng() * 2 - 1) * scale
        setCell(x, y, average + offset)
        diamondCells.push({
          x,
          y,
          value: grid[y][x],
          average,
          offset,
          neighbors: neighbors.map(([nx, ny]) => ({ x: nx, y: ny })),
        })
      }
    }
    phases.push({ kind: "diamond", step, grid: copyGrid(grid), added: diamondCells })

    const squareCells = []
    for (let y = 0; y < size; y += half) {
      for (let x = (y + half) % step; x < size; x += step) {
        if (grid[y][x] !== null) continue
        const neighbors = [
          [x - half, y],
          [x + half, y],
          [x, y - half],
          [x, y + half],
        ].filter(([nx, ny]) => nx >= 0 && nx < size && ny >= 0 && ny < size && grid[ny][nx] !== null)
        const average = neighbors.reduce((sum, [nx, ny]) => sum + grid[ny][nx], 0) / neighbors.length
        const offset = (rng() * 2 - 1) * scale
        setCell(x, y, average + offset)
        squareCells.push({
          x,
          y,
          value: grid[y][x],
          average,
          offset,
          neighbors: neighbors.map(([nx, ny]) => ({ x: nx, y: ny })),
        })
      }
    }
    phases.push({ kind: "square", step, grid: copyGrid(grid), added: squareCells })

    scale *= roughness
    step = half
  }

  const values = grid.flat()
  return normalize(size, grid, phases, Math.min(...values), Math.max(...values))
}

export function sampleGrid(grid, size, x, y, smooth = true) {
  const max = size - 1
  const gx = Math.max(0, Math.min(1, x)) * max
  const gy = Math.max(0, Math.min(1, y)) * max
  if (!smooth) {
    return grid[Math.round(gy)][Math.round(gx)]
  }
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const x1 = Math.min(max, x0 + 1)
  const y1 = Math.min(max, y0 + 1)
  const fx = gx - x0
  const fy = gy - y0
  const top = grid[y0][x0] * (1 - fx) + grid[y0][x1] * fx
  const bottom = grid[y1][x0] * (1 - fx) + grid[y1][x1] * fx
  return top * (1 - fy) + bottom * fy
}
