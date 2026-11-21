import assert from "node:assert/strict"
import test from "node:test"

import {
  SCALES,
  SCENES,
  activeLayers,
  buildChord,
  countEvents,
  generateBar,
  noteName,
  sceneDefaults,
} from "../assets/js/soundtrack/music.js"
import { SoundtrackEngine } from "../assets/js/soundtrack/audio.js"

test("master volume defaults to full and is clamped", () => {
  const engine = new SoundtrackEngine()
  assert.equal(engine.state.masterVolume, 1)
  engine.setMasterVolume(0.35)
  assert.equal(engine.state.masterVolume, 0.35)
  engine.setMasterVolume(3)
  assert.equal(engine.state.masterVolume, 1)
  engine.setMasterVolume(-1)
  assert.equal(engine.state.masterVolume, 0)
})

test("scales expose seven-note and pentatonic step sets", () => {
  assert.equal(SCALES.major.steps.length, 7)
  assert.equal(SCALES.minor.steps.length, 7)
  assert.equal(SCALES.pentatonic.steps.length, 5)
})

test("chords are built from scale degrees", () => {
  assert.deepEqual(buildChord(60, "major", 0), [60, 64, 67])
  assert.deepEqual(buildChord(57, "dorian", 0), [57, 60, 64])
  assert.equal(noteName(60), "C4")
})

test("layer activation follows scene thresholds", () => {
  assert.deepEqual(activeLayers(0, "explore"), { pad: false, bass: false, drums: false, melody: false })
  assert.equal(activeLayers(0.3, "explore").bass, true)
  assert.equal(activeLayers(0.3, "explore").drums, false)
  assert.equal(activeLayers(0.3, "combat").drums, true)
  assert.equal(activeLayers(1, "combat").melody, true)
})

test("bar generation is deterministic for a seed", () => {
  const options = { bar: 3, scene: "combat", intensity: 0.8, seed: 99, noteProbability: 0.8 }
  assert.deepEqual(generateBar(options), generateBar(options))
})

test("higher intensity adds events without changing tempo", () => {
  const low = generateBar({ bar: 0, scene: "combat", intensity: 0.1, seed: 42 })
  const high = generateBar({ bar: 0, scene: "combat", intensity: 0.95, seed: 42 })
  assert.ok(countEvents(high) > countEvents(low))
  assert.equal(low.bpm, high.bpm)
})

test("scene defaults describe a playable scene", () => {
  for (const key of Object.keys(SCENES)) {
    const defaults = sceneDefaults(key)
    assert.ok(defaults.bpm >= 60 && defaults.bpm <= 160)
    assert.ok(SCALES[defaults.scale])
    assert.ok(defaults.intensity >= 0 && defaults.intensity <= 1)
  }
})

test("zero note probability leaves the melody empty", () => {
  const pattern = generateBar({
    bar: 0,
    scene: "victory",
    intensity: 1,
    seed: 12,
    noteProbability: 0,
    restProbability: 0,
  })
  assert.equal(pattern.events.melody.length, 0)
})

test("all generated notes stay inside a sane MIDI range", () => {
  const pattern = generateBar({ bar: 2, scene: "danger", intensity: 0.8, seed: 7 })
  for (const event of [...pattern.events.bass, ...pattern.events.pad, ...pattern.events.melody]) {
    assert.ok(event.midi >= 24 && event.midi <= 96)
    assert.ok(event.step >= 0 && event.step < 16)
  }
})
