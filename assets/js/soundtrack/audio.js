import { generateBar, sceneDefaults } from "./music.js"

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.18

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12)
}

export class SoundtrackEngine {
  constructor(callbacks = {}) {
    this.callbacks = callbacks
    this.context = null
    this.master = null
    this.layerGains = {}
    this.noiseBuffer = null
    this.timer = null
    this.playing = false
    this.bar = 0
    this.step = 0
    this.pattern = null
    this.patternBar = -1
    this.barStart = 0
    this.nextTime = 0
    this.state = {
      scene: "explore",
      intensity: 0.28,
      bpm: 84,
      scale: "dorian",
      root: 57,
      noteProbability: 0.7,
      restProbability: 0.18,
      instrument: "soft",
      layers: { drums: true, bass: true, pad: true, melody: true },
      volumes: { drums: 0.7, bass: 0.65, pad: 0.55, melody: 0.65 },
    }
    this.pendingScene = null
    this.sceneSwitchBar = null
  }

  get supported() {
    return typeof window !== "undefined" && Boolean(window.AudioContext || window.webkitAudioContext)
  }

  get stepDuration() {
    return 60 / Math.max(40, this.state.bpm) / 4
  }

  async ensure() {
    if (!this.supported) throw new Error("Web Audio не поддерживается")
    if (!this.context) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      this.context = new Ctx()
      this.master = this.context.createGain()
      this.master.gain.value = 0.72
      this.master.connect(this.context.destination)
      for (const layer of ["drums", "bass", "pad", "melody"]) {
        const gain = this.context.createGain()
        gain.gain.value = this.state.volumes[layer]
        gain.connect(this.master)
        this.layerGains[layer] = gain
      }
      this.noiseBuffer = this.makeNoiseBuffer(1.5)
    }
    if (this.context.state === "suspended") await this.context.resume()
    return this.context
  }

  setState(patch) {
    this.state = {
      ...this.state,
      ...patch,
      layers: { ...this.state.layers, ...(patch.layers || {}) },
      volumes: { ...this.state.volumes, ...(patch.volumes || {}) },
    }
    for (const [layer, gain] of Object.entries(this.layerGains)) {
      gain.gain.setTargetAtTime(this.state.volumes[layer], this.context.currentTime, 0.05)
    }
  }

  requestScene(sceneKey, transitionBars = 2) {
    if (!this.playing) {
      this.state.scene = sceneKey
      this.pendingScene = null
      return
    }
    this.pendingScene = sceneKey
    this.sceneSwitchBar = this.bar + Math.max(1, Number(transitionBars) || 1)
  }

  getSceneStatus() {
    if (!this.pendingScene) return ""
    return `переход на «${this.pendingScene}» через ${Math.max(0, this.sceneSwitchBar - this.bar)} такт.`
  }

  async start() {
    if (this.playing) return
    await this.ensure()
    this.playing = true
    this.bar = 0
    this.step = 0
    this.patternBar = -1
    this.pendingScene = null
    this.sceneSwitchBar = null
    this.nextTime = this.context.currentTime + 0.08
    this.master.gain.cancelScheduledValues(this.context.currentTime)
    this.master.gain.setValueAtTime(0.72, this.context.currentTime)
    this.timer = window.setInterval(() => this.tick(), LOOKAHEAD_MS)
    this.tick()
  }

  stop() {
    this.playing = false
    if (this.timer) window.clearInterval(this.timer)
    this.timer = null
    if (this.context && this.master) {
      this.master.gain.cancelScheduledValues(this.context.currentTime)
      this.master.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.04)
    }
    this.pattern = null
    this.step = 0
    this.bar = 0
    this.patternBar = -1
  }

  tick() {
    if (!this.playing || !this.context) return
    const horizon = this.context.currentTime + SCHEDULE_AHEAD
    let guard = 0
    while (this.nextTime < horizon && guard < 32) {
      guard += 1
      if (this.step === 0 && this.patternBar !== this.bar) {
        this.applyPendingScene()
        this.pattern = this.makePattern(this.bar)
        this.patternBar = this.bar
        this.barStart = this.nextTime
        this.callbacks.onBar?.(this.pattern, this.bar, this.barStart, this.stepDuration)
      }
      const pattern = this.pattern
      if (pattern) this.scheduleStep(pattern, this.step, this.nextTime)
      this.step += 1
      this.nextTime += this.stepDuration
      if (this.step >= 16) {
        this.step = 0
        this.bar += 1
      }
    }
  }

  applyPendingScene() {
    if (!this.pendingScene) return
    if (this.bar >= this.sceneSwitchBar) {
      this.state.scene = this.pendingScene
      this.pendingScene = null
      this.sceneSwitchBar = null
      this.callbacks.onScene?.(this.state.scene)
    }
  }

  makePattern(bar) {
    return generateBar({
      bar,
      scene: this.state.scene,
      intensity: this.state.intensity,
      scale: this.state.scale,
      root: this.state.root,
      bpm: this.state.bpm,
      noteProbability: this.state.noteProbability,
      restProbability: this.state.restProbability,
      seed: 37,
    })
  }

  scheduleStep(pattern, step, time) {
    const duration = this.stepDuration
    for (const layer of ["pad", "bass", "melody"]) {
      if (!this.state.layers[layer]) continue
      for (const event of pattern.events[layer]) {
        if (event.step !== step) continue
        this.playTone(event.midi, time, event.duration * duration, layer, event.velocity)
      }
    }
    if (this.state.layers.drums) {
      for (const event of pattern.events.drums) {
        if (event.step !== step) continue
        if (event.type === "kick") this.playKick(time, event.velocity)
        if (event.type === "snare") this.playSnare(time, event.velocity)
        if (event.type === "hat") this.playHat(time, event.velocity)
      }
    }
  }

  playTone(midi, time, duration, layer, velocity = 0.6) {
    if (!this.context) return
    const frequency = midiToFrequency(midi)
    const gain = this.context.createGain()
    const filter = this.context.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = layer === "pad" ? 1800 : layer === "bass" ? 480 : 2600
    filter.Q.value = layer === "pad" ? 0.8 : 1.4
    const destination = this.layerGains[layer]
    if (!destination) return
    const instrument = layer === "bass"
      ? (this.state.instrument === "saw" ? "sawtooth" : this.state.instrument === "square" ? "square" : "sine")
      : (this.state.instrument === "saw" ? "sawtooth" : this.state.instrument === "square" ? "square" : "triangle")
    const oscillators = []
    const detunes = layer === "pad" ? [-7, 7] : [0]
    const peak = layer === "pad" ? 0.045 : layer === "bass" ? 0.09 : 0.06
    const attack = layer === "pad" ? 0.16 : layer === "bass" ? 0.015 : 0.008
    const release = Math.max(0.06, duration)
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.linearRampToValueAtTime(peak * velocity, time + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(attack + 0.03, release))
    for (const detune of detunes) {
      const osc = this.context.createOscillator()
      osc.type = instrument
      osc.frequency.setValueAtTime(frequency, time)
      osc.detune.setValueAtTime(detune, time)
      osc.connect(filter)
      osc.start(time)
      osc.stop(time + Math.max(attack + 0.05, release + 0.02))
      oscillators.push(osc)
    }
    filter.connect(gain)
    gain.connect(destination)
  }

  makeNoiseBuffer(seconds) {
    const length = Math.floor(this.context.sampleRate * seconds)
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    return buffer
  }

  playNoise(time, duration, highpass, lowpass, peak) {
    if (!this.context || !this.noiseBuffer) return
    const source = this.context.createBufferSource()
    source.buffer = this.noiseBuffer
    const high = this.context.createBiquadFilter()
    high.type = "highpass"
    high.frequency.value = highpass
    const low = this.context.createBiquadFilter()
    low.type = "lowpass"
    low.frequency.value = lowpass
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.linearRampToValueAtTime(peak, time + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    source.connect(high)
    high.connect(low)
    low.connect(gain)
    gain.connect(this.master)
    source.start(time)
    source.stop(time + duration + 0.02)
  }

  playKick(time, velocity) {
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(155, time)
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.12)
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.linearRampToValueAtTime(0.24 * velocity, time + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(time)
    osc.stop(time + 0.2)
  }

  playSnare(time, velocity) {
    this.playNoise(time, 0.14, 1200, 8000, 0.09 * velocity)
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(190, time)
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.linearRampToValueAtTime(0.04 * velocity, time + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(time)
    osc.stop(time + 0.1)
  }

  playHat(time, velocity) {
    this.playNoise(time, 0.035, 7000, 16000, 0.045 * velocity)
  }

  async playSfx(kind) {
    await this.ensure()
    const time = this.context.currentTime + 0.01
    this.master.gain.cancelScheduledValues(time)
    this.master.gain.setValueAtTime(0.72, time)
    if (kind === "footstep") {
      this.playNoise(time, 0.09, 80, 700, 0.1)
      this.playKick(time, 0.35)
    } else if (kind === "wind") {
      this.playNoise(time, 1.1, 180, 1800, 0.08)
    } else if (kind === "hit") {
      this.playNoise(time, 0.2, 600, 9000, 0.16)
      this.playKick(time, 0.9)
    } else if (kind === "chord") {
      const scene = sceneDefaults(this.state.scene)
      const chord = generateBar({
        scene: this.state.scene,
        intensity: 1,
        scale: this.state.scale,
        root: this.state.root,
        bar: 0,
        seed: 37,
      }).chord
      chord.forEach((midi, index) => this.playTone(midi, time + index * 0.03, 0.7, "pad", 0.8))
    }
  }
}
