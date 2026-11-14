import { makeRng } from "../rng.js"

export function makeValueGrid(cells, seed = 1) {
  if (!Number.isInteger(cells) || cells < 1) throw new Error("Число клеток должно быть положительным")
  const rng = makeRng(seed)
  return Array.from({ length: cells + 1 }, () =>
    Array.from({ length: cells + 1 }, () => rng()),
  )
}

export function sampleTriangle(grid, cells, x, y) {
  const px = Math.max(0, Math.min(1, x))
  const py = Math.max(0, Math.min(1, y))
  const cx = Math.min(cells - 1, Math.floor(px * cells))
  const cy = Math.min(cells - 1, Math.floor(py * cells))
  const u = px * cells - cx
  const v = py * cells - cy
  const h00 = grid[cy][cx]
  const h10 = grid[cy][cx + 1]
  const h01 = grid[cy + 1][cx]
  const h11 = grid[cy + 1][cx + 1]
  if (u + v <= 1) {
    return h00 * (1 - u - v) + h10 * u + h01 * v
  }
  return h11 * (u + v - 1) + h10 * (1 - v) + h01 * (1 - u)
}

export function buildLinearLayers(cells, octaves, seed = 1, persistence = 0.5) {
  const layers = []
  let totalWeight = 0
  for (let index = 0; index < octaves; index += 1) {
    const resolution = Math.min(192, cells * 2 ** index)
    const weight = persistence ** index
    layers.push({
      grid: makeValueGrid(resolution, seed + index * 7919),
      cells: resolution,
      weight,
    })
    totalWeight += weight
  }
  return { layers, totalWeight }
}

export function sampleLinearLayers({ layers, totalWeight }, x, y) {
  let sum = 0
  for (const layer of layers) {
    sum += layer.weight * sampleTriangle(layer.grid, layer.cells, x, y)
  }
  return sum / totalWeight
}
