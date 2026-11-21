import {
  INSTRUMENTS,
  LAYERS,
  SCALES,
  SCENES,
  activeLayers,
  countEvents,
  generateBar,
  noteName,
  sceneDefaults,
} from "./music.js"
import { SoundtrackEngine } from "./audio.js"

const STEPS = [
  {
    title: "Лад и аккордовая сетка",
    text: "Лад задаёт набор нот, а аккордовая сетка — гармонический маршрут. Для каждой сцены прогрессия своя: исследование звучит шире, бой — жёстче.",
    formula: "chord = scale[degree] + scale[degree + 2] + scale[degree + 4]",
    output: (pattern) => `Аккорд: ${pattern.chordLabel} · лад: ${SCALES[pattern.scale].label}`,
  },
  {
    title: "Ритм и вероятности",
    text: "Барабаны и бас не играют фиксированный паттерн. Интенсивность меняет, сколько событий вообще появится в такте — и какие слои уже включены. В учебном миксе по умолчанию включены все четыре слоя.",
    formula: "density = base + intensity × range",
    output: (pattern) => `Интенсивность ${Math.round(pattern.intensity * 100)}% · активны: ${activeNames(pattern)}`,
  },
  {
    title: "Генерация мелодии",
    text: "Мелодия ходит по ступеням лада случайным шагом. Вероятность ноты и вероятность паузы оставляют место для дыхания и непредсказуемости.",
    formula: "melody = randomWalk(scale) × noteChance × restChance",
    output: (pattern) => `Мелодических нот: ${pattern.events.melody.length} · паузы делают фразу живой`,
  },
  {
    title: "Слои",
    text: "Аранжировка собирается из четырёх слоёв. Каждый можно выключить и услышать, как меняется общая картина.",
    formula: "mix = drums + bass + pad + melody",
    output: (pattern) => `Слои: ${activeNames(pattern)}`,
  },
  {
    title: "Вертикальный ремикс",
    text: "Микшер меняет громкость слоёв, но адаптивность работает иначе: интенсивность меняет состав и плотность, а не просто громкость.",
    formula: "remix = Σ layer × volume",
    output: () => "Адаптивность = состав слоёв + плотность событий",
  },
  {
    title: "Горизонтальные переходы",
    text: "Сцена меняется не мгновенно, а в сетке тактов. Переход переносит аранжировку из исследования в бой, из боя в победу.",
    formula: "nextScene = quantize(bar + transition)",
    output: (pattern) => `Сцена: ${SCENES[pattern.scene].label} · переход: ${state.transitionBars} такт.`,
  },
  {
    title: "Процедурные SFX",
    text: "Шаги, ветер и удары — не готовые сэмплы, а шум, фильтры и огибающие. Их можно вызывать отдельно от музыки.",
    formula: "sfx = noise × envelope × filter",
    output: () => "Шаги · ветер · удар — синтез в реальном времени",
  },
]

const canvas = document.querySelector("#soundtrack-canvas")
const ctx = canvas.getContext("2d")
const els = {
  tabs: document.querySelectorAll("[data-level]"),
  panels: document.querySelectorAll("[role='tabpanel']"),
  transportPlay: document.querySelector("#transport-play"),
  transportScene: document.querySelector("#transport-scene"),
  transportStatus: document.querySelector("#transport-status"),
  transportPulse: document.querySelector("#transport-pulse"),
  masterVolume: document.querySelector("#master-volume"),
  masterVolumeOutput: document.querySelector("#master-volume-output"),
  hint: document.querySelector("#soundtrack-hint"),
  stepKicker: document.querySelector("#step-kicker"),
  stepTitle: document.querySelector("#step-title"),
  stepText: document.querySelector("#step-text"),
  stepFormula: document.querySelector("#step-formula"),
  stepOutput: document.querySelector("#step-output"),
  stepButtons: document.querySelectorAll("[data-step]"),
  stepPanels: document.querySelectorAll("[data-step-panel]"),
  stepBack: document.querySelector("#step-back"),
  stepNext: document.querySelector("#step-next"),
  stepReset: document.querySelector("#step-reset"),
  stepScale: document.querySelector("#step-scale"),
  chordReadout: document.querySelector("#chord-readout"),
  previewChord: document.querySelector("#preview-chord"),
  rhythmIntensity: document.querySelector("#rhythm-intensity"),
  rhythmOutput: document.querySelector("#rhythm-output"),
  melodyProbability: document.querySelector("#melody-probability"),
  melodyProbabilityOutput: document.querySelector("#melody-probability-output"),
  melodyRest: document.querySelector("#melody-rest"),
  melodyRestOutput: document.querySelector("#melody-rest-output"),
  stepLayers: document.querySelector("#step-layers"),
  stepMixer: document.querySelector("#step-mixer"),
  stepScenes: document.querySelector("#step-scenes"),
  stepTransition: document.querySelector("#step-transition"),
  stepTransitionOutput: document.querySelector("#step-transition-output"),
  labScene: document.querySelector("#lab-scene"),
  labIntensity: document.querySelector("#lab-intensity"),
  labIntensityOutput: document.querySelector("#lab-intensity-output"),
  labTempo: document.querySelector("#lab-tempo"),
  labTempoOutput: document.querySelector("#lab-tempo-output"),
  labScale: document.querySelector("#lab-scale"),
  labInstrument: document.querySelector("#lab-instrument"),
  labTransition: document.querySelector("#lab-transition"),
  labTransitionOutput: document.querySelector("#lab-transition-output"),
  labNote: document.querySelector("#lab-note-probability"),
  labNoteOutput: document.querySelector("#lab-note-probability-output"),
  labRest: document.querySelector("#lab-rest-probability"),
  labRestOutput: document.querySelector("#lab-rest-probability-output"),
  labMixer: document.querySelector("#lab-mixer"),
  labActivity: document.querySelector("#lab-activity"),
  labStats: document.querySelector("#lab-stats"),
  sfxButtons: document.querySelectorAll("[data-sfx]"),
}

const state = {
  level: 1,
  step: 0,
  scene: "explore",
  pendingScene: null,
  intensity: 0.65,
  bpm: 84,
  scale: "dorian",
  root: 57,
  noteProbability: 0.7,
  restProbability: 0.18,
  instrument: "soft",
  transitionBars: 2,
  layers: { drums: true, bass: true, pad: true, melody: true },
  volumes: { drums: 0.7, bass: 0.65, pad: 0.55, melody: 0.65 },
  masterVolume: 1,
  pattern: null,
  preview: null,
  playing: false,
  bar: 0,
}

let engine = null
let lastActivityKey = ""

function fillSelect(select, entries, value) {
  select.innerHTML = ""
  for (const [key, entry] of Object.entries(entries)) {
    const option = document.createElement("option")
    option.value = key
    option.textContent = entry.label
    select.append(option)
  }
  select.value = value
}

function activeNames(pattern) {
  return Object.entries(pattern.active)
    .filter(([, active]) => active)
    .map(([layer]) => LAYERS[layer].label)
    .join(" · ")
}

function effectiveLayers(pattern = state.pattern) {
  if (!pattern) return { drums: false, bass: false, pad: false, melody: false }
  return Object.fromEntries(
    Object.keys(LAYERS).map((layer) => [layer, Boolean(pattern.active[layer]) && Boolean(state.layers[layer])]),
  )
}

function makePreview() {
  return generateBar({
    bar: 0,
    scene: state.scene,
    intensity: state.intensity,
    scale: state.scale,
    root: state.root,
    bpm: state.bpm,
    noteProbability: state.noteProbability,
    restProbability: state.restProbability,
    seed: 37,
  })
}

function applyDefaults(sceneKey) {
  const defaults = sceneDefaults(sceneKey)
  state.bpm = defaults.bpm
  state.scale = defaults.scale
  state.intensity = state.level === 1 ? Math.max(defaults.intensity, 0.65) : defaults.intensity
  state.root = SCENES[sceneKey].root
}

function syncControls() {
  els.stepScale.value = state.scale
  els.labScale.value = state.scale
  els.labInstrument.value = state.instrument
  els.labScene.value = state.pendingScene || state.scene
  els.rhythmIntensity.value = String(Math.round(state.intensity * 100))
  els.rhythmOutput.textContent = `${Math.round(state.intensity * 100)}%`
  els.labIntensity.value = String(Math.round(state.intensity * 100))
  els.labIntensityOutput.textContent = `${Math.round(state.intensity * 100)}%`
  els.labTempo.value = String(state.bpm)
  els.labTempoOutput.textContent = `${state.bpm} BPM`
  els.melodyProbability.value = String(Math.round(state.noteProbability * 100))
  els.melodyProbabilityOutput.textContent = `${Math.round(state.noteProbability * 100)}%`
  els.melodyRest.value = String(Math.round(state.restProbability * 100))
  els.melodyRestOutput.textContent = `${Math.round(state.restProbability * 100)}%`
  els.labNote.value = String(Math.round(state.noteProbability * 100))
  els.labNoteOutput.textContent = `${Math.round(state.noteProbability * 100)}%`
  els.labRest.value = String(Math.round(state.restProbability * 100))
  els.labRestOutput.textContent = `${Math.round(state.restProbability * 100)}%`
  els.stepTransition.value = String(state.transitionBars)
  els.stepTransitionOutput.textContent = `${state.transitionBars} такт.`
  els.labTransition.value = String(state.transitionBars)
  els.labTransitionOutput.textContent = `${state.transitionBars} такт.`
  els.masterVolume.value = String(Math.round(state.masterVolume * 100))
  els.masterVolumeOutput.textContent = `${Math.round(state.masterVolume * 100)}%`
  document.querySelectorAll("[data-layer]").forEach((input) => {
    input.checked = Boolean(state.layers[input.dataset.layer])
  })
  document.querySelectorAll("[data-volume]").forEach((input) => {
    const layer = input.dataset.volume
    input.value = String(Math.round(state.volumes[layer] * 100))
    const output = input.parentElement.querySelector("output")
    if (output) output.textContent = `${Math.round(state.volumes[layer] * 100)}%`
  })
  document.querySelectorAll("[data-scene]").forEach((button) => {
    const selected = (state.pendingScene || state.scene) === button.dataset.scene
    button.classList.toggle("is-active", selected)
    button.setAttribute("aria-pressed", selected ? "true" : "false")
  })
  setStep(state.step)
  updateTransport()
  updateReadouts()
}

function updateTransport() {
  const sceneLabel = SCENES[state.pendingScene || state.scene].label
  els.transportScene.textContent = state.pendingScene
    ? `${SCENES[state.scene].label} → ${sceneLabel}`
    : sceneLabel
  if (state.playing) {
    const pattern = state.pattern
    const transitionBar = state.pendingScene && engine
      ? Math.max(0, (engine.sceneSwitchBar ?? 0) - (engine.bar ?? 0))
      : 0
    els.transportStatus.textContent = `${state.bpm} BPM · такт ${state.bar + 1} · ${pattern ? pattern.chordLabel : "—"}${state.pendingScene ? ` · переход через ${transitionBar} такт.` : ""}`
  } else {
    els.transportStatus.textContent = `Пауза · ${state.bpm} BPM · 16 шагов`
  }
  els.transportPlay.textContent = state.playing ? "■ Стоп" : "▶ Играть"
  els.transportPlay.classList.toggle("is-playing", state.playing)
  els.transportPulse.classList.toggle("is-playing", state.playing)
  els.hint.textContent = state.playing ? "Piano roll · 16 шагов · звучит текущий такт" : "Нажмите «Играть», чтобы услышать процедурную музыку"
}

function updateReadouts() {
  const pattern = state.pattern || state.preview
  if (!pattern) return
  els.chordReadout.textContent = `${SCENES[pattern.scene].label} · ${pattern.chordLabel} · ${SCALES[pattern.scale].label}`
  els.stepOutput.textContent = STEPS[state.step].output(pattern)
  els.labStats.innerHTML = statCards(pattern)
  document.querySelectorAll("[data-scene]").forEach((button) => {
    button.classList.toggle("is-active", (state.pendingScene || state.scene) === button.dataset.scene)
  })
}

function statCards(pattern) {
  const enabled = Object.keys(LAYERS).filter((layer) => state.layers[layer])
  const active = enabled.filter((layer) => pattern.active[layer]).length
  const events = enabled.reduce((sum, layer) => sum + pattern.events[layer].length, 0)
  return [
    ["Активные слои", String(active)],
    ["События", String(events)],
    ["Аккорд", pattern.chordLabel],
  ]
    .map(([label, value]) => `<div class="soundtrack-stat"><span>${label}</span><strong>${value}</strong></div>`)
    .join("")
}

function updateActivity() {
  const pattern = state.pattern || state.preview
  if (!pattern) return
  const step = currentStep()
  const key = `${pattern.seed}:${pattern.bar}:${step}:${state.scene}:${pattern.intensity}:${countEvents(pattern)}:${Object.values(state.layers).join("")}`
  if (key === lastActivityKey) return
  lastActivityKey = key
  document.querySelectorAll("[data-act]").forEach((row) => {
    const layer = row.dataset.act
    const events = pattern.events[layer] || []
    const here = events.filter((event) => event.step === (step < 0 ? 0 : step)).length
    const active = pattern.active[layer] && state.layers[layer]
    row.classList.toggle("is-active", active && here > 0)
    const bar = row.querySelector("b")
    if (bar) bar.style.width = `${active ? Math.max(8, Math.min(100, 28 + here * 23)) : 4}%`
  })
  document.querySelectorAll(".transport-pulse i").forEach((bar, index) => {
    bar.classList.toggle("is-on", state.playing && index === (step < 0 ? 0 : step) % 4)
  })
}

function setStep(next) {
  state.step = Math.max(0, Math.min(STEPS.length - 1, Number(next)))
  els.stepButtons.forEach((button) => {
    const selected = Number(button.dataset.step) === state.step
    button.setAttribute("aria-pressed", selected ? "true" : "false")
  })
  els.stepPanels.forEach((panel) => {
    panel.hidden = Number(panel.dataset.stepPanel) !== state.step
  })
  els.stepKicker.textContent = `ШАГ ${state.step + 1} ИЗ ${STEPS.length}`
  els.stepTitle.textContent = STEPS[state.step].title
  els.stepText.textContent = STEPS[state.step].text
  els.stepFormula.textContent = STEPS[state.step].formula
  updateReadouts()
  updateActivity()
}

function setLevel(level) {
  state.level = Number(level)
  els.tabs.forEach((tab) => tab.setAttribute("aria-selected", Number(tab.dataset.level) === state.level ? "true" : "false"))
  els.panels.forEach((panel) => {
    panel.hidden = Number(panel.id.replace("panel-", "")) !== state.level
  })
  if (state.level === 1 && state.intensity < 0.65) {
    state.intensity = 0.65
    applySettings()
    syncControls()
    return
  }
  updateReadouts()
}

function applySettings() {
  state.preview = makePreview()
  if (!state.playing) state.pattern = state.preview
  engine?.setState(state)
  updateReadouts()
  updateTransport()
  draw()
}

function selectScene(sceneKey) {
  if (!SCENES[sceneKey]) return
  if (state.scene === sceneKey && !state.pendingScene) return
  if (state.playing) {
    state.pendingScene = sceneKey
    engine?.requestScene(sceneKey, state.transitionBars)
    updateTransport()
    syncControls()
    return
  }
  state.scene = sceneKey
  state.pendingScene = null
  applyDefaults(sceneKey)
  applySettings()
  syncControls()
}

function clearPulse() {
  document.querySelectorAll(".transport-pulse i").forEach((bar) => bar.classList.remove("is-on"))
}

async function togglePlay() {
  if (!engine) return
  if (state.playing) {
    engine.stop()
    state.playing = false
    state.pattern = state.preview
    state.pendingScene = null
    clearPulse()
    syncControls()
    return
  }
  try {
    engine.setState(state)
    await engine.start()
    state.playing = true
    state.bar = 0
    state.pattern = engine.pattern || state.preview
    syncControls()
  } catch (error) {
    els.transportStatus.textContent = `Звук не запустился: ${error.message}`
  }
}

function stopPlayback() {
  engine?.stop()
  state.playing = false
  state.pattern = state.preview
  state.pendingScene = null
  clearPulse()
  syncControls()
}

function buildLayerControls() {
  const checkboxes = Object.entries(LAYERS)
    .map(
      ([layer, meta]) =>
        `<label class="soundtrack-layer-row"><input type="checkbox" data-layer="${layer}" checked><span class="dot" style="--c:${meta.color}"></span><span>${meta.label}</span></label>`,
    )
    .join("")
  els.stepLayers.innerHTML = checkboxes

  const mixer = Object.entries(LAYERS)
    .map(
      ([layer, meta]) =>
        `<div class="soundtrack-mixer-row"><span><input type="checkbox" data-layer="${layer}" checked><i class="dot" style="--c:${meta.color}"></i>${meta.label}</span><output>${Math.round(state.volumes[layer] * 100)}%</output><input type="range" min="0" max="100" step="1" value="${Math.round(state.volumes[layer] * 100)}" data-volume="${layer}" aria-label="Громкость: ${meta.label}"></div>`,
    )
    .join("")
  els.stepMixer.innerHTML = mixer
  els.labMixer.innerHTML = mixer

  const scenes = Object.entries(SCENES)
    .map(([key, scene]) => `<button type="button" data-scene="${key}">${scene.label}</button>`)
    .join("")
  els.stepScenes.innerHTML = scenes

  const activity = Object.entries(LAYERS)
    .map(
      ([layer, meta]) =>
        `<div class="soundtrack-activity-row" data-act="${layer}" style="--c:${meta.color}"><span>${meta.label}</span><i><b></b></i></div>`,
    )
    .join("")
  els.labActivity.innerHTML = activity
}

function bindControls() {
  els.transportPlay.addEventListener("click", togglePlay)
  els.masterVolume.addEventListener("input", () => {
    state.masterVolume = Number(els.masterVolume.value) / 100
    els.masterVolumeOutput.textContent = `${Math.round(state.masterVolume * 100)}%`
    engine?.setMasterVolume(state.masterVolume)
  })

  els.tabs.forEach((tab) => tab.addEventListener("click", () => setLevel(tab.dataset.level)))
  els.stepButtons.forEach((button) => button.addEventListener("click", () => setStep(button.dataset.step)))
  els.stepBack.addEventListener("click", () => {
    if (state.step > 0) setStep(state.step - 1)
    else setLevel(1)
  })
  els.stepNext.addEventListener("click", () => {
    if (state.step < STEPS.length - 1) setStep(state.step + 1)
    else setLevel(2)
  })
  els.stepReset.addEventListener("click", () => {
    stopPlayback()
    state.scene = "explore"
    state.pendingScene = null
    applyDefaults("explore")
    state.step = 0
    state.noteProbability = 0.7
    state.restProbability = 0.18
    state.transitionBars = 2
    state.instrument = "soft"
    state.layers = { drums: true, bass: true, pad: true, melody: true }
    state.volumes = { drums: 0.7, bass: 0.65, pad: 0.55, melody: 0.65 }
    applySettings()
    syncControls()
    setStep(0)
    setLevel(1)
  })

  els.stepScale.addEventListener("change", () => {
    state.scale = els.stepScale.value
    applySettings()
    syncControls()
  })
  els.labScale.addEventListener("change", () => {
    state.scale = els.labScale.value
    applySettings()
    syncControls()
  })
  els.labInstrument.addEventListener("change", () => {
    state.instrument = els.labInstrument.value
    applySettings()
  })
  els.labScene.addEventListener("change", () => selectScene(els.labScene.value))

  const bindIntensity = (input) => {
    input.addEventListener("input", () => {
      state.intensity = Number(input.value) / 100
      applySettings()
      syncControls()
    })
  }
  bindIntensity(els.rhythmIntensity)
  bindIntensity(els.labIntensity)

  els.labTempo.addEventListener("input", () => {
    state.bpm = Number(els.labTempo.value)
    applySettings()
    syncControls()
  })
  els.melodyProbability.addEventListener("input", () => {
    state.noteProbability = Number(els.melodyProbability.value) / 100
    applySettings()
    syncControls()
  })
  els.melodyRest.addEventListener("input", () => {
    state.restProbability = Number(els.melodyRest.value) / 100
    applySettings()
    syncControls()
  })
  els.labNote.addEventListener("input", () => {
    state.noteProbability = Number(els.labNote.value) / 100
    applySettings()
    syncControls()
  })
  els.labRest.addEventListener("input", () => {
    state.restProbability = Number(els.labRest.value) / 100
    applySettings()
    syncControls()
  })

  for (const input of [els.stepTransition, els.labTransition]) {
    input.addEventListener("input", () => {
      state.transitionBars = Number(input.value)
      syncControls()
    })
  }

  document.querySelectorAll("[data-layer]").forEach((input) => {
    input.addEventListener("change", () => {
      state.layers[input.dataset.layer] = input.checked
      applySettings()
      syncControls()
    })
  })
  document.querySelectorAll("[data-volume]").forEach((input) => {
    input.addEventListener("input", () => {
      state.volumes[input.dataset.volume] = Number(input.value) / 100
      applySettings()
      syncControls()
    })
  })
  document.querySelectorAll("[data-scene]").forEach((button) => {
    button.addEventListener("click", () => selectScene(button.dataset.scene))
  })
  document.querySelectorAll("[data-sfx]").forEach((button) => {
    button.addEventListener("click", () => engine?.playSfx(button.dataset.sfx).catch(() => {}))
  })
  els.previewChord.addEventListener("click", () => engine?.playSfx("chord").catch(() => {}))
}

function currentStep() {
  if (!engine?.playing || !engine.context) return -1
  const elapsed = engine.context.currentTime - engine.barStart
  if (elapsed < 0) return -1
  return Math.floor(elapsed / engine.stepDuration) % 16
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function draw() {
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  if (!W || !H) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = "#0c1826"
  ctx.fillRect(0, 0, W, H)

  const pattern = state.pattern || state.preview
  if (!pattern) return
  const gutter = 46
  const right = 12
  const top = 52
  const drumH = 64
  const drumTop = H - drumH - 12
  const rollH = drumTop - top
  const stepW = (W - gutter - right) / 16
  const pitchMin = 36
  const pitchMax = 84
  const rows = pitchMax - pitchMin
  const rowH = rollH / rows
  const active = effectiveLayers(pattern)
  const highlight = [["pad"], ["drums", "bass"], ["melody"], ["drums", "bass", "pad", "melody"], ["drums", "bass", "pad", "melody"], ["drums", "bass", "pad", "melody"], ["drums", "bass", "pad", "melody"]][state.step]

  ctx.fillStyle = "#dcebf7"
  ctx.font = "800 12px Manrope, system-ui, sans-serif"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(`${SCENES[pattern.scene].label} · ${pattern.chordLabel}`, 14, 18)
  ctx.fillStyle = "#8eaec5"
  ctx.font = "700 10px Manrope, system-ui, sans-serif"
  ctx.fillText(`такт ${pattern.bar + 1} · интенсивность ${Math.round(pattern.intensity * 100)}%`, 14, 35)
  ctx.fillStyle = "#547185"
  ctx.textAlign = "right"
  ctx.fillText("Piano roll · 16 шагов", W - 12, 18)
  ctx.textAlign = "left"

  for (let row = 0; row <= rows; row += 1) {
    const y = top + row * rowH
    ctx.strokeStyle = row % 12 === 0 ? "rgba(128, 172, 202, 0.18)" : "rgba(128, 172, 202, 0.07)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(gutter, y)
    ctx.lineTo(W - right, y)
    ctx.stroke()
  }
  for (let midi = pitchMin; midi <= pitchMax; midi += 1) {
    if (midi % 12 !== 0) continue
    const y = top + (pitchMax - midi) * rowH + rowH / 2
    ctx.fillStyle = "#6b8da5"
    ctx.font = "600 9px Manrope, system-ui, sans-serif"
    ctx.textAlign = "right"
    ctx.fillText(noteName(midi), gutter - 6, y)
  }

  for (let step = 0; step <= 16; step += 1) {
    const x = gutter + step * stepW
    ctx.strokeStyle = step % 4 === 0 ? "rgba(160, 200, 228, 0.22)" : "rgba(160, 200, 228, 0.07)"
    ctx.lineWidth = step % 4 === 0 ? 1.2 : 1
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, drumTop)
    ctx.stroke()
  }

  const drawNotes = (layer) => {
    if (!pattern.active[layer] || !active[layer]) return
    const dim = !highlight.includes(layer)
    ctx.globalAlpha = dim ? 0.24 : 1
    for (const event of pattern.events[layer]) {
      const midi = Array.isArray(event.midi) ? event.midi[0] : event.midi
      if (midi < pitchMin || midi > pitchMax) continue
      const x = gutter + event.step * stepW + 2
      const y = top + (pitchMax - midi) * rowH + 2
      const width = Math.max(4, Math.min(16, event.duration || 1) * stepW - 4)
      const height = Math.max(4, rowH - 4)
      ctx.fillStyle = LAYERS[layer].color
      roundRect(x, y, width, height, Math.min(3, height / 2))
      ctx.fill()
      if (layer === "melody" && width > 9) {
        ctx.fillStyle = "rgba(8, 24, 34, 0.45)"
        ctx.fillRect(x + 3, y + height - 4, 2, 2)
      }
    }
    ctx.globalAlpha = 1
  }
  drawNotes("pad")
  drawNotes("bass")
  drawNotes("melody")

  for (let step = 0; step <= 16; step += 1) {
    const x = gutter + step * stepW
    ctx.strokeStyle = step % 4 === 0 ? "rgba(160, 200, 228, 0.22)" : "rgba(160, 200, 228, 0.07)"
    ctx.beginPath()
    ctx.moveTo(x, drumTop)
    ctx.lineTo(x, H - 12)
    ctx.stroke()
  }
  const drumLanes = ["kick", "snare", "hat"]
  drumLanes.forEach((type, index) => {
    const y = drumTop + index * (drumH / 3) + drumH / 6
    ctx.fillStyle = "#6b8da5"
    ctx.font = "700 8px Manrope, system-ui, sans-serif"
    ctx.textAlign = "right"
    ctx.fillText(type === "kick" ? "KICK" : type === "snare" ? "SNARE" : "HAT", gutter - 6, y)
    for (const event of pattern.events.drums) {
      if (event.type !== type) continue
      const x = gutter + event.step * stepW + stepW / 2
      ctx.beginPath()
      ctx.arc(x, y, type === "kick" ? 5 : 3.5, 0, Math.PI * 2)
      ctx.fillStyle = LAYERS.drums.color
      ctx.globalAlpha = active.drums && highlight.includes("drums") ? 1 : 0.2
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })

  const step = currentStep()
  if (step >= 0) {
    const x = gutter + step * stepW + stepW / 2
    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, top - 4)
    ctx.lineTo(x, H - 10)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, top - 5, 3, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()
  }

  ctx.strokeStyle = "rgba(128, 172, 202, 0.22)"
  ctx.beginPath()
  ctx.moveTo(gutter, drumTop)
  ctx.lineTo(W - right, drumTop)
  ctx.stroke()
}

function loop() {
  draw()
  updateActivity()
  if (state.playing) {
    const step = currentStep()
    if (step >= 0) {
      document.querySelectorAll(".transport-pulse i").forEach((bar, index) => {
        bar.classList.toggle("is-on", index === step % 4)
      })
    }
  }
  requestAnimationFrame(loop)
}

function init() {
  fillSelect(els.stepScale, SCALES, state.scale)
  fillSelect(els.labScale, SCALES, state.scale)
  fillSelect(els.labInstrument, INSTRUMENTS, state.instrument)
  fillSelect(els.labScene, SCENES, state.scene)

  buildLayerControls()
  engine = new SoundtrackEngine({
    onBar: (pattern, bar) => {
      state.pattern = pattern
      state.bar = bar
      state.playing = true
      updateTransport()
      updateReadouts()
      updateActivity()
    },
    onScene: (sceneKey) => {
      state.scene = sceneKey
      state.pendingScene = null
      applyDefaults(sceneKey)
      engine.setState(state)
      state.preview = makePreview()
      state.pattern = engine.pattern || state.preview
      syncControls()
    },
  })
  engine.setState(state)
  state.preview = makePreview()
  state.pattern = state.preview
  bindControls()
  syncControls()
  setStep(0)
  setLevel(1)
  draw()
  requestAnimationFrame(loop)
}

init()
