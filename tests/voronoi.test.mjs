import assert from "node:assert/strict"
import test from "node:test"
import {
  bisectorSegment,
  nearestIndex,
  polygonArea,
  polygonCentroid,
  voronoiCells,
} from "../assets/js/voronoi/geometry.js"

function close(actual, expected, tolerance = 0.5) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

test("две точки делят прямоугольник пополам", () => {
  const cells = voronoiCells([{ x: 25, y: 50 }, { x: 75, y: 50 }], 100, 100)
  close(polygonArea(cells[0]), 5000)
  close(polygonArea(cells[1]), 5000)
  close(polygonCentroid(cells[0]).x, 25)
  close(polygonCentroid(cells[1]).x, 75)
})

test("ячейки Вороного покрывают весь прямоугольник", () => {
  const points = [
    { x: 18, y: 22 },
    { x: 64, y: 15 },
    { x: 82, y: 58 },
    { x: 41, y: 48 },
    { x: 23, y: 83 },
    { x: 72, y: 86 },
  ]
  const cells = voronoiCells(points, 100, 70)
  const total = cells.reduce((sum, cell) => sum + polygonArea(cell), 0)
  close(total, 7000, 1)
  for (const cell of cells) assert.ok(cell.length >= 3)
})

test("центроид квадрата — его центр", () => {
  const centroid = polygonCentroid([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }])
  close(centroid.x, 5)
  close(centroid.y, 5)
})

test("серединный перпендикуляр обрезается по границам", () => {
  const line = bisectorSegment({ x: 25, y: 50 }, { x: 75, y: 50 }, 100, 100)
  assert.ok(line)
  close(line[0].x, 50)
  close(line[1].x, 50)
  close(Math.min(line[0].y, line[1].y), 0)
  close(Math.max(line[0].y, line[1].y), 100)
})

test("ближайшая точка определяется по расстоянию", () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }]
  assert.equal(nearestIndex(points, 10, 10), 0)
  assert.equal(nearestIndex(points, 90, 10), 1)
  assert.equal(nearestIndex(points, 50, 90), 2)
})
