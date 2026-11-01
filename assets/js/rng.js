/** Mulberry32. Один и тот же сид даёт одну и ту же последовательность. */
export function makeRng(seed) {
  let a = seed >>> 0
  if (a === 0) a = 0x6d2b79f5
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(rng, min, maxInclusive) {
  return min + Math.floor(rng() * (maxInclusive - min + 1))
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)]
}

export function shuffle(rng, list) {
  const copy = list.slice()
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy
}
