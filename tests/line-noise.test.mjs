import assert from "node:assert/strict"
import test from "node:test"
import {
  accumulateLineField,
  fieldToShades,
  makeRandomLines,
} from "../assets/js/perlin/line-noise.js"

test("random lines are deterministic by seed and count", () => {
  const first = makeRandomLines(50, 123)
  const second = makeRandomLines(50, 123)
  assert.deepEqual(first, second)
  assert.equal(first.length, 50)
  assert.notDeepEqual(first, makeRandomLines(50, 124))
})

test("one line splits the field into 0 and 1", () => {
  const lines = [{ nx: 1, ny: 0, d: 0 }]
  const field = accumulateLineField(lines, 33)
  assert.equal(field.min, 0)
  assert.equal(field.max, 1)
  assert.equal(field.values[0], 0)
  assert.equal(field.values[field.values.length - 1], 1)
})

test("ten lines produce at most eleven gray levels", () => {
  const field = accumulateLineField(makeRandomLines(10, 5), 48)
  const levels = new Set()
  for (const value of field.values) levels.add(value)
  assert.ok(levels.size <= 11)
})

test("more lines keep the field in 0..1", () => {
  const field = accumulateLineField(makeRandomLines(500, 8), 64)
  for (const value of field.values) {
    const normalized = value / field.count
    assert.ok(normalized >= 0 && normalized <= 1)
  }
})

test("contrast normalization uses the full 0..255 range", () => {
  const field = accumulateLineField(makeRandomLines(100, 9), 64)
  const shades = fieldToShades(field, true)
  assert.equal(Math.min(...shades), 0)
  assert.equal(Math.max(...shades), 255)
})
