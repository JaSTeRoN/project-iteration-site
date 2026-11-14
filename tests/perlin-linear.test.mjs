import assert from "node:assert/strict"
import test from "node:test"
import {
  buildLinearLayers,
  makeValueGrid,
  sampleLinearLayers,
  sampleTriangle,
} from "../assets/js/perlin/linear-noise.js"

test("linear interpolation returns node values at grid corners", () => {
  const grid = makeValueGrid(4, 7)
  for (let y = 0; y <= 4; y += 1) {
    for (let x = 0; x <= 4; x += 1) {
      assert.ok(Math.abs(sampleTriangle(grid, 4, x / 4, y / 4) - grid[y][x]) < 1e-12)
    }
  }
})

test("constant grid gives a constant linear field", () => {
  const grid = Array.from({ length: 5 }, () => Array(5).fill(0.5))
  for (const [x, y] of [[0, 0], [0.2, 0.7], [0.5, 0.5], [1, 1]]) {
    assert.ok(Math.abs(sampleTriangle(grid, 4, x, y) - 0.5) < 1e-12)
  }
})

test("value grids are deterministic by seed", () => {
  assert.deepEqual(makeValueGrid(6, 42), makeValueGrid(6, 42))
  assert.notDeepEqual(makeValueGrid(6, 42), makeValueGrid(6, 43))
})

test("linear interpolation stays inside 0..1", () => {
  const grid = makeValueGrid(8, 3)
  for (let y = 0; y <= 20; y += 1) {
    for (let x = 0; x <= 20; x += 1) {
      const value = sampleTriangle(grid, 8, x / 20, y / 20)
      assert.ok(value >= 0 && value <= 1)
    }
  }
})

test("octave layers are deterministic and normalized", () => {
  const first = buildLinearLayers(8, 4, 99)
  const second = buildLinearLayers(8, 4, 99)
  for (const [x, y] of [[0, 0], [0.3, 0.6], [1, 1]]) {
    const a = sampleLinearLayers(first, x, y)
    const b = sampleLinearLayers(second, x, y)
    assert.ok(Math.abs(a - b) < 1e-12)
    assert.ok(a >= 0 && a <= 1)
  }
})
