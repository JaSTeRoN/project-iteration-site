import { makeRng } from "../rng.js"

export function makeRandomLines(count, seed = 1) {
  const rng = makeRng(seed)
  const lines = []
  for (let index = 0; index < count; index += 1) {
    const angle = rng() * Math.PI * 2
    lines.push({
      nx: Math.cos(angle),
      ny: Math.sin(angle),
      d: rng() * 2.4 - 1.2,
    })
  }
  return lines
}

export function accumulateLineField(lines, resolution = 128) {
  if (!Number.isInteger(resolution) || resolution < 8) throw new Error("Слишком низкое разрешение")
  const values = new Float32Array(resolution * resolution)
  const xs = new Float32Array(resolution)
  const ys = new Float32Array(resolution)
  for (let i = 0; i < resolution; i += 1) {
    xs[i] = (i / (resolution - 1)) * 2 - 1
    ys[i] = (i / (resolution - 1)) * 2 - 1
  }
  for (const line of lines) {
    let index = 0
    for (let y = 0; y < resolution; y += 1) {
      const base = line.ny * ys[y]
      for (let x = 0; x < resolution; x += 1) {
        if (base + line.nx * xs[x] > line.d) values[index] += 1
        index += 1
      }
    }
  }
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] / lines.length
    if (value < min) min = value
    if (value > max) max = value
  }
  return { values, resolution, min, max, count: lines.length }
}

export function fieldToShades(field, normalize = true) {
  const { values, min, max, count } = field
  const shades = new Uint8ClampedArray(values.length)
  if (!normalize) {
    for (let i = 0; i < values.length; i += 1) {
      shades[i] = Math.round((values[i] / count) * 255)
    }
    return shades
  }
  const bins = 1024
  const histogram = new Uint32Array(bins)
  for (let i = 0; i < values.length; i += 1) {
    const value = (values[i] / count - min) / (max - min || 1)
    histogram[Math.min(bins - 1, Math.floor(value * bins))] += 1
  }
  const cumulative = new Uint32Array(bins)
  let total = 0
  for (let i = 0; i < bins; i += 1) {
    total += histogram[i]
    cumulative[i] = total
  }
  for (let i = 0; i < values.length; i += 1) {
    const value = (values[i] / count - min) / (max - min || 1)
    const bin = Math.min(bins - 1, Math.floor(value * bins))
    const rank = (cumulative[bin] - histogram[bin] * 0.5) / values.length
    shades[i] = Math.round(Math.max(0, Math.min(1, rank)) * 255)
  }
  return shades
}
