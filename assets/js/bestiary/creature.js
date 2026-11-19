import { makeRng } from "../rng.js"
import { fbm2, makePermutation } from "../perlin/noise.js"

export const TYPES = {
  normal: { label: "Обычный", body: "#272c49", wing: "#3d456d", membrane: "#5b6394", accent: "#9a8cff", eye: "#a8ecff" },
  zombie: { label: "Зомби", body: "#3b4432", wing: "#586146", membrane: "#78845c", accent: "#b9db78", eye: "#d6ff84" },
  ice: { label: "Ледяной", body: "#1d4a62", wing: "#3b8ba8", membrane: "#74c7db", accent: "#c9f6ff", eye: "#e0fdff" },
  fire: { label: "Огненный", body: "#4d2228", wing: "#963d37", membrane: "#ca6547", accent: "#ffc05c", eye: "#ffd37a" },
}

export const TYPE_PALETTE = {
  normal: "night",
  zombie: "toxic",
  ice: "frost",
  fire: "ember",
}

export const PALETTES = {
  night: { label: "Ночная", body: "#272c49", wing: "#3d456d", membrane: "#5b6394", accent: "#9a8cff" },
  frost: { label: "Морозная", body: "#1d4a62", wing: "#3b8ba8", membrane: "#74c7db", accent: "#c9f6ff" },
  ember: { label: "Угольная", body: "#4d2228", wing: "#963d37", membrane: "#ca6547", accent: "#ffc05c" },
  toxic: { label: "Токсичная", body: "#31422e", wing: "#5d7646", membrane: "#819a5a", accent: "#c6e36a" },
  sunset: { label: "Закатная", body: "#42243a", wing: "#a4526b", membrane: "#d88a89", accent: "#ffd27a" },
  royal: { label: "Королевская", body: "#2d2350", wing: "#5d4a9a", membrane: "#8172c9", accent: "#f0c96a" },
  moss: { label: "Мшистая", body: "#263b2b", wing: "#54724a", membrane: "#7d9b61", accent: "#d4e88a" },
  void: { label: "Пустотная", body: "#191724", wing: "#3d2c56", membrane: "#6b3f8f", accent: "#ff67d4" },
  storm: { label: "Штормовая", body: "#263544", wing: "#4d6a7a", membrane: "#7797a4", accent: "#c6e6f2" },
  candy: { label: "Карамельная", body: "#4a2340", wing: "#a84d83", membrane: "#d987b9", accent: "#96f2e4" },
}

export const HEADS = {
  round: { label: "Круглая" },
  angular: { label: "Угловатая" },
  horned: { label: "Рогатая" },
  crest: { label: "С гребнем" },
  skull: { label: "Череп" },
  hooded: { label: "В капюшоне" },
  wide: { label: "Широкая" },
  split: { label: "Двуликая" },
}

export const ACCESSORIES = {
  none: { label: "Без аксессуара" },
  helmet: { label: "Шлем" },
  spikes: { label: "Шипы" },
  armor: { label: "Нагрудник" },
  crown: { label: "Корона" },
  goggles: { label: "Очки" },
  scarf: { label: "Шарф" },
  crystals: { label: "Кристаллы" },
}

export const BODY_SHAPES = {
  slim: { label: "Стройное", width: 0.86, height: 1.04 },
  round: { label: "Круглое", width: 1.16, height: 0.9 },
  hulking: { label: "Массивное", width: 1.28, height: 1.08 },
}

export const WING_PATTERNS = {
  membrane: { label: "Перепонка" },
  feather: { label: "Перья" },
  skeletal: { label: "Каркас" },
}

export const EYES = {
  cyan: { label: "Голубые", color: "#a8ecff" },
  amber: { label: "Янтарные", color: "#ffd36e" },
  violet: { label: "Фиолетовые", color: "#d6a8ff" },
}

export const TEXTURES = {
  none: { label: "Без текстуры" },
  perlin: { label: "Шум Перлина" },
  worley: { label: "Шум Уорли" },
  bands: { label: "Полосы" },
  cells: { label: "Чешуйки" },
  grain: { label: "Зерно" },
}

export const TARGETS = {
  hunter: { label: "Ночной охотник", height: 3.35, wings: 7, type: "fire", palette: "night", eye: 1.0 },
  frost: { label: "Ледяной страж", height: 2.9, wings: 5, type: "ice", palette: "frost", eye: 1.1 },
  cute: { label: "Лесной малыш", height: 2.15, wings: 2, type: "normal", palette: "toxic", head: "round", eye: 1.45 },
}

export const COMBINATION_COUNT =
  Object.keys(HEADS).length *
  Object.keys(ACCESSORIES).length *
  Object.keys(PALETTES).length *
  Object.keys(EYES).length *
  Object.keys(BODY_SHAPES).length *
  Object.keys(WING_PATTERNS).length

const SIZE_BASE = { small: 2.15, medium: 2.8, large: 3.4 }
const WINGS_BY_SIZE = { small: [2], medium: [2, 4], large: [4, 6, 8] }

export function sizeForHeight(height) {
  if (height < 2.5) return "small"
  if (height < 3.1) return "medium"
  return "large"
}

export function wingShapeFor(count) {
  if (count >= 8) return "bony"
  if (count >= 6) return "wide"
  if (count >= 4) return "long"
  return "normal"
}

function hashInt(value) {
  let h = value | 0
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

function allowedWings(size) {
  return WINGS_BY_SIZE[size]
}

function pickWingCount(size, seed) {
  const values = allowedWings(size)
  return values[hashInt(seed + values.length * 977) % values.length]
}

export function normalizeGenome(input) {
  const genome = { ...input }
  genome.height = Math.max(1.9, Math.min(3.7, Number(genome.height)))
  genome.wingspan = Math.max(0.75, Math.min(1.7, Number(genome.wingspan)))
  genome.legs = Math.max(0.55, Math.min(1.5, Number(genome.legs)))
  genome.eyeSize = Math.max(0.75, Math.min(1.55, Number(genome.eyeSize)))
  genome.bodySize = sizeForHeight(genome.height)
  const allowed = allowedWings(genome.bodySize)
  if (!allowed.includes(genome.wingCount)) {
    genome.wingCount = pickWingCount(genome.bodySize, genome.seed)
  }
  genome.wingShape = wingShapeFor(genome.wingCount)
  genome.health = Math.round(genome.height * 100 + (hashInt(genome.seed + 77) % 76) - 25)
  genome.speed = Number((1 / genome.height).toFixed(2))
  genome.type = TYPES[genome.type] ? genome.type : "normal"
  genome.palette = PALETTES[genome.palette] ? genome.palette : "night"
  genome.head = HEADS[genome.head] ? genome.head : "round"
  genome.accessory = ACCESSORIES[genome.accessory] ? genome.accessory : "none"
  genome.eye = EYES[genome.eye] ? genome.eye : "cyan"
  genome.bodyShape = BODY_SHAPES[genome.bodyShape] ? genome.bodyShape : "slim"
  genome.wingPattern = WING_PATTERNS[genome.wingPattern] ? genome.wingPattern : "membrane"
  genome.texture = {
    kind: TEXTURES[genome.texture?.kind] ? genome.texture.kind : "none",
    scale: Math.max(1, Math.min(12, Number(genome.texture?.scale ?? 4))),
    maskHead: Boolean(genome.texture?.maskHead ?? true),
    seed: Number(genome.texture?.seed ?? genome.seed),
  }
  return genome
}

export function createGenome(seed = 1, overrides = {}) {
  const rng = makeRng(seed)
  const typeKeys = Object.keys(TYPES)
  const sizeKeys = Object.keys(SIZE_BASE)
  const type = overrides.type || typeKeys[Math.floor(rng() * typeKeys.length)]
  const typePalette = TYPE_PALETTE[type]
  const bodySize = overrides.bodySize || sizeKeys[Math.floor(rng() * sizeKeys.length)]
  const height = overrides.height ?? SIZE_BASE[bodySize] + (rng() * 0.35 - 0.18)
  const palette = overrides.palette || typePalette
  const headKeys = Object.keys(HEADS)
  const accessoryKeys = Object.keys(ACCESSORIES)
  const eyeKeys = Object.keys(EYES)
  const bodyShapeKeys = Object.keys(BODY_SHAPES)
  const wingPatternKeys = Object.keys(WING_PATTERNS)
  const wingCount = overrides.wingCount ?? pickWingCount(sizeForHeight(height), seed)
  const genome = normalizeGenome({
    seed,
    type,
    palette,
    bodySize,
    height,
    wingspan: overrides.wingspan ?? 0.95 + rng() * 0.45,
    legs: overrides.legs ?? 0.8 + rng() * 0.45,
    eyeSize: overrides.eyeSize ?? 0.95 + rng() * 0.45,
    head: overrides.head || headKeys[Math.floor(rng() * headKeys.length)],
    accessory: overrides.accessory || accessoryKeys[Math.floor(rng() * accessoryKeys.length)],
    eye: overrides.eye || eyeKeys[Math.floor(rng() * eyeKeys.length)],
    bodyShape: overrides.bodyShape || bodyShapeKeys[Math.floor(rng() * bodyShapeKeys.length)],
    wingPattern: overrides.wingPattern || wingPatternKeys[Math.floor(rng() * wingPatternKeys.length)],
    wingCount,
    texture: overrides.texture || {
      kind: rng() < 0.5 ? "perlin" : "worley",
      scale: 2 + Math.floor(rng() * 6),
      maskHead: true,
      seed: seed + 31,
    },
  })
  return genome
}

export function updateGenome(genome, patch) {
  return normalizeGenome({ ...genome, ...patch })
}

export function rerollParts(genome, seed = genome.seed + 1) {
  const rng = makeRng(seed)
  const headKeys = Object.keys(HEADS)
  const accessoryKeys = Object.keys(ACCESSORIES)
  const paletteKeys = Object.keys(PALETTES)
  const eyeKeys = Object.keys(EYES)
  const bodyShapeKeys = Object.keys(BODY_SHAPES)
  const wingPatternKeys = Object.keys(WING_PATTERNS)
  return normalizeGenome({
    ...genome,
    seed,
    head: headKeys[Math.floor(rng() * headKeys.length)],
    accessory: accessoryKeys[Math.floor(rng() * accessoryKeys.length)],
    palette: paletteKeys[Math.floor(rng() * paletteKeys.length)],
    eye: eyeKeys[Math.floor(rng() * eyeKeys.length)],
    bodyShape: bodyShapeKeys[Math.floor(rng() * bodyShapeKeys.length)],
    wingPattern: wingPatternKeys[Math.floor(rng() * wingPatternKeys.length)],
  })
}

export function rerollModules(genome) {
  const rng = makeRng(genome.seed + 911)
  const allowed = allowedWings(genome.bodySize)
  return normalizeGenome({
    ...genome,
    seed: genome.seed + 1,
    wingCount: allowed[Math.floor(rng() * allowed.length)],
  })
}

export function grammarTrace(genome) {
  const allowed = allowedWings(genome.bodySize)
  return [
    `тело: ${genome.bodySize} → крыльев ${allowed.join(" или ")}`,
    `выпало крыльев: ${genome.wingCount}`,
    `форма крыльев: ${genome.wingShape}`,
    `тип: ${TYPES[genome.type].label} → голова и окрас`,
  ]
}

export function combinationCount() {
  return COMBINATION_COUNT
}

export function fitnessBreakdown(genome, targetKey = "hunter") {
  const target = TARGETS[targetKey] || TARGETS.hunter
  const heightScore = 1 - Math.min(1, Math.abs(genome.height - target.height) / 1.6)
  const wingScore = 1 - Math.min(1, Math.abs(genome.wingCount - target.wings) / 8)
  const typeScore = genome.type === target.type ? 1 : 0.25
  const paletteScore = genome.palette === target.palette ? 1 : 0.3
  const eyeScore = 1 - Math.min(1, Math.abs(genome.eyeSize - target.eye) / 0.8)
  const headScore = target.head ? (genome.head === target.head ? 1 : 0.2) : 0.6
  const parts = [
    { label: "Высота", actual: genome.height.toFixed(2), target: target.height.toFixed(2), score: heightScore, weight: 0.28 },
    { label: "Крылья", actual: String(genome.wingCount), target: String(target.wings), score: wingScore, weight: 0.24 },
    { label: "Тип", actual: TYPES[genome.type].label, target: TYPES[target.type].label, score: typeScore, weight: 0.15 },
    { label: "Палитра", actual: PALETTES[genome.palette].label, target: PALETTES[target.palette].label, score: paletteScore, weight: 0.12 },
    { label: "Глаза", actual: genome.eyeSize.toFixed(2), target: target.eye.toFixed(2), score: eyeScore, weight: 0.11 },
    { label: "Голова", actual: HEADS[genome.head].label, target: target.head ? HEADS[target.head].label : "любая", score: headScore, weight: 0.1 },
  ]
  const score = Math.round(parts.reduce((sum, part) => sum + part.score * part.weight, 0) * 100)
  return { score, parts }
}

export function fitness(genome, targetKey = "hunter") {
  return fitnessBreakdown(genome, targetKey).score
}

export function createPopulation(count, seed, targetKey = "hunter", generation = 0) {
  return Array.from({ length: count }, (_, index) => {
    const genome = createGenome(seed + index * 137)
    return {
      genome,
      fitness: fitness(genome, targetKey),
      lineage: { generation, parents: null, mutationRate: 0, elite: false },
    }
  })
}

export function evolvePopulation(population, targetKey, mutationRate = 0.18, seed = 1, generation = 1) {
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness)
  const survivors = sorted.slice(0, Math.max(2, Math.floor(sorted.length / 2)))
  const rng = makeRng(seed)
  const next = []
  const elite = survivors[0]
  next.push({
    genome: { ...elite.genome },
    fitness: elite.fitness,
    lineage: { generation, parents: null, mutationRate: 0, elite: true },
  })
  while (next.length < population.length) {
    const parentA = survivors[Math.floor(rng() * survivors.length)].genome
    const parentB = survivors[Math.floor(rng() * survivors.length)].genome
    let child = crossover(parentA, parentB, seed + next.length * 7919, rng)
    child = mutate(child, mutationRate, seed + next.length * 104729, rng)
    next.push({
      genome: child,
      fitness: fitness(child, targetKey),
      lineage: {
        generation,
        parents: [parentA.seed, parentB.seed],
        mutationRate,
        elite: false,
      },
    })
  }
  return next
}

function pickGene(a, b, rng) {
  return rng() < 0.5 ? a : b
}

export function crossover(parentA, parentB, seed, rng = makeRng(seed)) {
  const child = normalizeGenome({
    ...parentA,
    seed,
    type: pickGene(parentA.type, parentB.type, rng),
    palette: pickGene(parentA.palette, parentB.palette, rng),
    head: pickGene(parentA.head, parentB.head, rng),
    accessory: pickGene(parentA.accessory, parentB.accessory, rng),
    eye: pickGene(parentA.eye, parentB.eye, rng),
    bodyShape: pickGene(parentA.bodyShape, parentB.bodyShape, rng),
    wingPattern: pickGene(parentA.wingPattern, parentB.wingPattern, rng),
    height: (parentA.height + parentB.height) / 2 + (rng() * 0.2 - 0.1),
    wingspan: (parentA.wingspan + parentB.wingspan) / 2 + (rng() * 0.16 - 0.08),
    legs: (parentA.legs + parentB.legs) / 2 + (rng() * 0.16 - 0.08),
    eyeSize: (parentA.eyeSize + parentB.eyeSize) / 2 + (rng() * 0.2 - 0.1),
    wingCount: pickGene(parentA.wingCount, parentB.wingCount, rng),
    texture: rng() < 0.5 ? parentA.texture : parentB.texture,
  })
  return child
}

export function mutate(genome, rate, seed, rng = makeRng(seed)) {
  const changed = { ...genome, seed }
  if (rng() < rate) changed.height += rng() * 0.4 - 0.2
  if (rng() < rate) changed.wingspan += rng() * 0.3 - 0.15
  if (rng() < rate) changed.legs += rng() * 0.3 - 0.15
  if (rng() < rate) changed.eyeSize += rng() * 0.3 - 0.15
  if (rng() < rate) changed.type = Object.keys(TYPES)[Math.floor(rng() * Object.keys(TYPES).length)]
  if (rng() < rate) changed.palette = Object.keys(PALETTES)[Math.floor(rng() * Object.keys(PALETTES).length)]
  if (rng() < rate) changed.head = Object.keys(HEADS)[Math.floor(rng() * Object.keys(HEADS).length)]
  if (rng() < rate) changed.accessory = Object.keys(ACCESSORIES)[Math.floor(rng() * Object.keys(ACCESSORIES).length)]
  if (rng() < rate) changed.eye = Object.keys(EYES)[Math.floor(rng() * Object.keys(EYES).length)]
  if (rng() < rate) changed.bodyShape = Object.keys(BODY_SHAPES)[Math.floor(rng() * Object.keys(BODY_SHAPES).length)]
  if (rng() < rate) changed.wingPattern = Object.keys(WING_PATTERNS)[Math.floor(rng() * Object.keys(WING_PATTERNS).length)]
  if (rng() < rate) {
    const allowed = allowedWings(sizeForHeight(changed.height))
    changed.wingCount = allowed[Math.floor(rng() * allowed.length)]
  }
  return normalizeGenome(changed)
}

export function bestOf(population) {
  return [...population].sort((a, b) => b.fitness - a.fitness)[0]
}

export function averageFitness(population) {
  return Math.round(population.reduce((sum, item) => sum + item.fitness, 0) / population.length)
}

export function createNoiseSampler(kind, scale = 4, seed = 1) {
  if (kind === "perlin") {
    const permutation = makePermutation(seed)
    return (x, y) => {
      const value = fbm2(x * scale, y * scale, permutation, { octaves: 3, persistence: 0.55, lacunarity: 2 })
      return Math.max(0, Math.min(1, 0.5 + value * 0.75))
    }
  }
  if (kind === "worley" || kind === "cells") {
    const density = kind === "cells" ? scale * 1.45 : scale
    return (x, y) => {
      const px = x * density
      const py = y * density
      const cellX = Math.floor(px)
      const cellY = Math.floor(py)
      let nearest = Infinity
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const ix = cellX + ox
          const iy = cellY + oy
          const rx = (hashInt(ix * 374761 + iy * 668265 + seed * 144269) % 1000) / 1000
          const ry = (hashInt(ix * 127412 + iy * 617 + seed * 374761) % 1000) / 1000
          const distance = Math.hypot(px - (ix + rx), py - (iy + ry))
          if (distance < nearest) nearest = distance
        }
      }
      const value = Math.max(0, Math.min(1, 1 - nearest * 0.85))
      return kind === "cells" ? Math.pow(value, 1.7) : value
    }
  }
  if (kind === "bands") {
    const phase = (seed % 360) * (Math.PI / 180)
    return (x, y) => {
      const value = Math.sin((x + y * 0.35) * scale * Math.PI * 2 + phase)
      return Math.max(0, Math.min(1, 0.5 + value * 0.5))
    }
  }
  if (kind === "grain") {
    return (x, y) => {
      const ix = Math.floor(x * 180 * scale)
      const iy = Math.floor(y * 180 * scale)
      return (hashInt(ix * 73856093 + iy * 19349663 + seed * 83492791) % 1000) / 1000
    }
  }
  return () => 0.5
}
