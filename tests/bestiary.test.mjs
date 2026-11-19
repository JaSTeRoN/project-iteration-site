import assert from "node:assert/strict"
import test from "node:test"
import {
  COMBINATION_COUNT,
  EYES,
  HEADS,
  ACCESSORIES,
  PALETTES,
  TYPES,
  bestOf,
  combinationCount,
  createGenome,
  createNoiseSampler,
  createPopulation,
  crossover,
  evolvePopulation,
  grammarTrace,
  mutate,
  updateGenome,
  wingShapeFor,
} from "../assets/js/bestiary/creature.js"

test("genome is deterministic by seed", () => {
  assert.deepEqual(createGenome(42), createGenome(42))
  assert.notDeepEqual(createGenome(42), createGenome(43))
})

test("combination count matches the parts library", () => {
  assert.equal(combinationCount(), COMBINATION_COUNT)
  assert.equal(
    combinationCount(),
    Object.keys(HEADS).length * Object.keys(ACCESSORIES).length * Object.keys(PALETTES).length * Object.keys(EYES).length,
  )
})

test("grammar keeps wings inside the body-size range", () => {
  const small = updateGenome(createGenome(1), { bodySize: "small", height: 2.1, wingCount: 2 })
  const medium = updateGenome(createGenome(2), { bodySize: "medium", height: 2.8, wingCount: 4 })
  const large = updateGenome(createGenome(3), { bodySize: "large", height: 3.4, wingCount: 8 })
  assert.equal(small.wingCount, 2)
  assert.ok([2, 4].includes(medium.wingCount))
  assert.ok([4, 6, 8].includes(large.wingCount))
  assert.equal(wingShapeFor(2), "normal")
  assert.equal(wingShapeFor(4), "long")
  assert.equal(wingShapeFor(6), "wide")
  assert.equal(wingShapeFor(8), "bony")
  assert.ok(grammarTrace(large).length >= 3)
})

test("parametric dependencies update health and speed", () => {
  const tall = updateGenome(createGenome(5), { height: 3.5, bodySize: "large", wingCount: 8 })
  const short = updateGenome(createGenome(5), { height: 2.0, bodySize: "small", wingCount: 2 })
  assert.ok(tall.health > short.health)
  assert.ok(tall.speed < short.speed)
  assert.equal(tall.bodySize, "large")
  assert.equal(short.bodySize, "small")
})

test("noise samplers are deterministic and stay in 0..1", () => {
  for (const kind of ["perlin", "worley"]) {
    const sampler = createNoiseSampler(kind, 4, 11)
    const again = createNoiseSampler(kind, 4, 11)
    for (const [x, y] of [[0, 0], [0.2, 0.6], [0.9, 0.4]]) {
      const value = sampler(x, y)
      assert.ok(value >= 0 && value <= 1)
      assert.ok(Math.abs(value - again(x, y)) < 1e-12)
    }
  }
})

test("crossover and mutation keep a valid genome", () => {
  const a = createGenome(7)
  const b = createGenome(8)
  const child = crossover(a, b, 99)
  const mutated = mutate(child, 1, 100)
  for (const genome of [child, mutated]) {
    assert.ok(genome.height >= 1.9 && genome.height <= 3.7)
    assert.ok(genome.wingspan >= 0.75 && genome.wingspan <= 1.7)
    assert.ok(TYPES[genome.type])
    assert.ok([2, 4, 6, 8].includes(genome.wingCount))
  }
})

test("evolution does not lose the best fitness", () => {
  const population = createPopulation(20, 123, "hunter")
  const before = bestOf(population).fitness
  const next = evolvePopulation(population, "hunter", 0.2, 55)
  assert.equal(next.length, 20)
  assert.ok(bestOf(next).fitness >= before)
})
