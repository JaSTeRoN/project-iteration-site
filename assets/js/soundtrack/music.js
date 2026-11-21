import { makeRng } from "../rng.js"

export const SCALES = {
  major: { label: "Мажор", steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: "Минор", steps: [0, 2, 3, 5, 7, 8, 10] },
  dorian: { label: "Дорийский", steps: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { label: "Фригийский", steps: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { label: "Лидийский", steps: [0, 2, 4, 6, 7, 9, 11] },
  pentatonic: { label: "Пентатоника", steps: [0, 2, 4, 7, 9] },
}

export const SCENES = {
  explore: {
    label: "Исследование",
    bpm: 84,
    scale: "dorian",
    root: 57,
    intensity: 0.28,
    progression: [0, 5, 3, 4],
  },
  combat: {
    label: "Бой",
    bpm: 132,
    scale: "phrygian",
    root: 52,
    intensity: 0.82,
    progression: [0, 1, 0, 6],
  },
  danger: {
    label: "Опасность",
    bpm: 100,
    scale: "minor",
    root: 50,
    intensity: 0.55,
    progression: [0, 6, 5, 4],
  },
  victory: {
    label: "Победа",
    bpm: 120,
    scale: "major",
    root: 60,
    intensity: 0.7,
    progression: [0, 4, 5, 3],
  },
}

export const LAYERS = {
  drums: { label: "Барабаны", color: "#f0a34a" },
  bass: { label: "Бас", color: "#4f9cff" },
  pad: { label: "Пэд", color: "#b179ff" },
  melody: { label: "Мелодия", color: "#47c98b" },
}

export const INSTRUMENTS = {
  soft: { label: "Мягкий", melody: "triangle", bass: "sine" },
  saw: { label: "Пила", melody: "sawtooth", bass: "sawtooth" },
  square: { label: "Квадрат", melody: "square", bass: "square" },
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const THRESHOLDS = {
  explore: { bass: 0.2, drums: 0.52, melody: 0.58 },
  combat: { bass: 0.12, drums: 0.3, melody: 0.34 },
  danger: { bass: 0.18, drums: 0.4, melody: 0.46 },
  victory: { bass: 0.16, drums: 0.32, melody: 0.36 },
}

export function noteName(midi) {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

export function buildChord(rootMidi, scaleName, degree) {
  const scale = (SCALES[scaleName] || SCALES.dorian).steps
  const noteAt = (offset) => {
    const index = degree + offset
    const octave = Math.floor(index / scale.length)
    const step = ((index % scale.length) + scale.length) % scale.length
    return rootMidi + scale[step] + octave * 12
  }
  return [noteAt(0), noteAt(2), noteAt(4)]
}

export function activeLayers(intensity, sceneKey = "explore") {
  const threshold = THRESHOLDS[sceneKey] || THRESHOLDS.explore
  const value = Math.max(0, Math.min(1, Number(intensity)))
  return {
    pad: value > 0.02,
    bass: value >= threshold.bass,
    drums: value >= threshold.drums,
    melody: value >= threshold.melody,
  }
}

export function layerThresholds(sceneKey = "explore") {
  return THRESHOLDS[sceneKey] || THRESHOLDS.explore
}

function probability(value, fallback) {
  return Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : fallback))
}

export function generateBar(options = {}) {
  const sceneKey = SCENES[options.scene] ? options.scene : "explore"
  const scene = SCENES[sceneKey]
  const intensity = Math.max(0, Math.min(1, Number(options.intensity ?? scene.intensity)))
  const scaleName = SCALES[options.scale] ? options.scale : scene.scale
  const root = Number.isFinite(Number(options.root)) ? Number(options.root) : scene.root
  const bpm = Math.max(40, Math.min(220, Number(options.bpm ?? scene.bpm)))
  const bar = Math.max(0, Math.floor(Number(options.bar ?? 0)))
  const noteProbability = probability(options.noteProbability, 0.7)
  const restProbability = probability(options.restProbability, 0.18)
  const seed = Number(options.seed ?? 37)
  const rng = makeRng(seed + bar * 7919 + sceneKey.length * 131)
  const active = activeLayers(intensity, sceneKey)
  if (options.allowedLayers) {
    for (const layer of Object.keys(active)) {
      active[layer] = Boolean(options.allowedLayers[layer]) && active[layer]
    }
  }
  const degree = scene.progression[bar % scene.progression.length]
  const chord = buildChord(root, scaleName, degree)
  const scale = SCALES[scaleName].steps
  const events = { drums: [], bass: [], pad: [], melody: [] }

  if (active.pad) {
    chord.forEach((midi) => {
      events.pad.push({ step: 0, midi, duration: 16, velocity: 0.7 })
    })
  }

  if (active.bass) {
    const bassRoot = chord[0] - 12
    for (const step of [0, 4, 8, 12]) {
      if (step > 0 && rng() > 0.55 + intensity * 0.35) continue
      events.bass.push({ step, midi: bassRoot, duration: Math.max(1, 4), velocity: 0.65 })
    }
  }

  if (active.drums) {
    for (const step of [0, 8]) events.drums.push({ step, type: "kick", velocity: 0.9 })
    if (intensity > 0.65) events.drums.push({ step: 6, type: "kick", velocity: 0.55 })
    for (const step of [4, 12]) {
      if (rng() < 0.55 + intensity * 0.4) events.drums.push({ step, type: "snare", velocity: 0.7 })
    }
    for (let step = 0; step < 16; step += 2) {
      if (step % 4 === 2 && rng() < 0.28 + intensity * 0.35) {
        events.drums.push({ step, type: "hat", velocity: 0.26 })
      } else if (rng() < 0.18 + intensity * 0.4) {
        events.drums.push({ step, type: "hat", velocity: 0.22 })
      }
    }
  }

  if (active.melody) {
    const chance = noteProbability * (0.28 + intensity * 0.72) * (sceneKey === "combat" ? 1.12 : 1)
    let index = Math.floor(rng() * scale.length)
    for (let step = 0; step < 16; step += 1) {
      if (rng() < restProbability) continue
      if (rng() > chance * 0.7) continue
      const move = rng() < 0.7 ? (rng() < 0.5 ? -1 : 1) : (rng() < 0.5 ? -2 : 2)
      index = (index + move + scale.length) % scale.length
      const octave = rng() < 0.18 ? 12 : 0
      const midi = root + 12 + scale[index] + octave
      events.melody.push({ step, midi, duration: rng() < 0.25 ? 2 : 1, velocity: 0.55 + rng() * 0.25 })
    }
  }

  return {
    bar,
    scene: sceneKey,
    scale: scaleName,
    root,
    bpm,
    intensity,
    degree,
    chord,
    chordLabel: chord.map(noteName).join(" – "),
    active,
    events,
    seed,
  }
}

export function countEvents(pattern) {
  return Object.values(pattern.events).reduce((sum, list) => sum + list.length, 0)
}

export function sceneDefaults(sceneKey) {
  const scene = SCENES[sceneKey] || SCENES.explore
  return {
    bpm: scene.bpm,
    scale: scene.scale,
    intensity: scene.intensity,
  }
}
