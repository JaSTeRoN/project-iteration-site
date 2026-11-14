import assert from "node:assert/strict"
import test from "node:test"
import {
  fade,
  fbm2,
  makePermutation,
  perlin1,
  perlin2,
} from "../assets/js/perlin/noise.js"

function close(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

test("кривая сглаживания проходит через 0 и 1", () => {
  close(fade(0), 0)
  close(fade(1), 1)
  close(fade(0.5), 0.5)
  assert.ok(fade(0.25) < 0.25)
  assert.ok(fade(0.75) > 0.75)
})

test("шум Перлина в узлах равен нулю", () => {
  const permutation = makePermutation(7)
  for (const x of [0, 1, 2, 3, 4]) close(perlin1(x, permutation), 0, 1e-9)
  for (const x of [0, 1, 2]) {
    for (const y of [0, 1, 2]) close(perlin2(x, y, permutation), 0, 1e-9)
  }
})

test("один и тот же сид даёт одинаковый шум", () => {
  const first = makePermutation(42)
  const second = makePermutation(42)
  close(perlin1(1.37, first), perlin1(1.37, second))
  close(perlin2(2.13, 1.71, first), perlin2(2.13, 1.71, second))
  const other = makePermutation(43)
  assert.notEqual(perlin1(1.37, first), perlin1(1.37, other))
})

test("значения шума остаются в разумных пределах", () => {
  const permutation = makePermutation(11)
  for (let i = 0; i < 200; i += 1) {
    const x = i * 0.37
    const y = i * 0.61
    assert.ok(Math.abs(perlin1(x, permutation)) <= 1.01)
    assert.ok(Math.abs(perlin2(x, y, permutation)) <= 1.5)
    const value = fbm2(x, y, permutation, { octaves: 5, persistence: 0.5, lacunarity: 2 })
    assert.ok(value >= -1.01 && value <= 1.01)
  }
})
