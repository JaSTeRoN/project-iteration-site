import { makeRng, shuffle } from "../rng.js"

const GRADIENTS = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function makePermutation(seed = 1) {
  const rng = makeRng(seed)
  const values = Array.from({ length: 256 }, (_, index) => index)
  const permutation = shuffle(rng, values)
  return [...permutation, ...permutation]
}

export function grad1(hash) {
  return ((hash & 255) / 255) * 2 - 1
}

export function grad2(hash, x, y) {
  const gradient = GRADIENTS[hash & 7]
  return gradient[0] * x + gradient[1] * y
}

export function perlin1(x, permutation) {
  const cell = Math.floor(x)
  const local = x - cell
  const left = grad1(permutation[cell & 255])
  const right = grad1(permutation[(cell + 1) & 255])
  return lerp(left * local, right * (local - 1), fade(local))
}

export function perlin2(x, y, permutation) {
  const cellX = Math.floor(x)
  const cellY = Math.floor(y)
  const localX = x - cellX
  const localY = y - cellY
  const ix = cellX & 255
  const iy = cellY & 255

  const aa = permutation[permutation[ix] + iy]
  const ab = permutation[permutation[ix] + iy + 1]
  const ba = permutation[permutation[ix + 1] + iy]
  const bb = permutation[permutation[ix + 1] + iy + 1]

  const u = fade(localX)
  const v = fade(localY)
  const top = lerp(grad2(aa, localX, localY), grad2(ba, localX - 1, localY), u)
  const bottom = lerp(grad2(ab, localX, localY - 1), grad2(bb, localX - 1, localY - 1), u)
  return lerp(top, bottom, v)
}

export function fbm2(x, y, permutation, options = {}) {
  const octaves = Math.max(1, Math.round(options.octaves || 4))
  const persistence = options.persistence ?? 0.5
  const lacunarity = options.lacunarity ?? 2
  let amplitude = 1
  let frequency = 1
  let sum = 0
  let norm = 0
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += perlin2(x * frequency, y * frequency, permutation) * amplitude
    norm += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }
  return norm === 0 ? 0 : sum / norm
}
