import assert from "node:assert/strict"
import test from "node:test"
import { generateDiamondSquare, sampleGrid } from "../assets/js/diamond-square/algorithm.js"

test("сетка Diamond-Square заполняется целиком", () => {
  const result = generateDiamondSquare(5, 0.55, 21)
  assert.equal(result.size, 5)
  assert.equal(result.grid.length, 5)
  assert.equal(result.grid.flat().length, 25)
  for (const row of result.grid) {
    for (const value of row) {
      assert.ok(Number.isFinite(value))
      assert.ok(value >= 0 && value <= 1)
    }
  }
})

test("шаги алгоритма идут в правильном порядке", () => {
  const result = generateDiamondSquare(5, 0.55, 21)
  assert.deepEqual(result.phases.map((phase) => phase.kind), ["corners", "diamond", "square", "diamond", "square"])
  assert.deepEqual(result.phases.map((phase) => phase.added.length), [4, 1, 4, 4, 12])
})

test("один сид даёт одинаковый рельеф", () => {
  const first = generateDiamondSquare(9, 0.55, 42)
  const second = generateDiamondSquare(9, 0.55, 42)
  assert.deepEqual(first.grid, second.grid)
  const other = generateDiamondSquare(9, 0.55, 43)
  assert.notDeepEqual(first.grid, other.grid)
})

test("размер сетки должен быть 2^n + 1", () => {
  assert.throws(() => generateDiamondSquare(6, 0.5, 1))
  assert.throws(() => generateDiamondSquare(2, 0.5, 1))
})

test("билинейная выборка возвращает углы и центр", () => {
  const grid = [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
  ]
  assert.equal(sampleGrid(grid, 3, 0.5, 0.5), 1)
  assert.equal(sampleGrid(grid, 3, 0, 0), 0)
  assert.equal(sampleGrid(grid, 3, 1, 1), 0)
  assert.equal(sampleGrid(grid, 3, 0.5, 0.5, false), 1)
})
