import {
  ACCESSORIES,
  BODY_SHAPES,
  COMBINATION_COUNT,
  EYES,
  HEADS,
  PALETTES,
  TARGETS,
  TEXTURES,
  TYPE_PALETTE,
  TYPES,
  WING_PATTERNS,
  averageFitness,
  bestOf,
  combinationCount,
  createGenome,
  createNoiseSampler,
  createPopulation,
  crossover,
  evolvePopulation,
  fitnessBreakdown,
  grammarTrace,
  mutate,
  rerollModules,
  rerollParts,
  updateGenome,
} from "./creature.js"

const canvas = document.querySelector("#bestiary-canvas")
const ctx = canvas.getContext("2d")
const hint = document.querySelector("#canvas-hint")
const tabs = [...document.querySelectorAll("[data-level]")]
const panels = [...document.querySelectorAll(".bestiary-panel")]

const els = {
  stepKicker: document.querySelector("#step-kicker"),
  stepTitle: document.querySelector("#step-title"),
  stepText: document.querySelector("#step-text"),
  stepFormula: document.querySelector("#step-formula"),
  stepOutput: document.querySelector("#step-output"),
  stepButtons: [...document.querySelectorAll("[data-step]")],
  stepPanels: [...document.querySelectorAll("[data-step-panel]")],
  stepBack: document.querySelector("#step-back"),
  stepNext: document.querySelector("#step-next"),
  stepReset: document.querySelector("#step-reset"),
  comboHead: document.querySelector("#combo-head"),
  comboAccessory: document.querySelector("#combo-accessory"),
  comboPalette: document.querySelector("#combo-palette"),
  comboEye: document.querySelector("#combo-eye"),
  comboBody: document.querySelector("#combo-body"),
  comboWing: document.querySelector("#combo-wing"),
  comboRandom: document.querySelector("#combo-random"),
  paramHeight: document.querySelector("#param-height"),
  paramHeightOutput: document.querySelector("#param-height-output"),
  paramWingspan: document.querySelector("#param-wingspan"),
  paramWingspanOutput: document.querySelector("#param-wingspan-output"),
  paramLegs: document.querySelector("#param-legs"),
  paramLegsOutput: document.querySelector("#param-legs-output"),
  paramStats: document.querySelector("#param-stats"),
  grammarSize: document.querySelector("#grammar-size"),
  grammarType: document.querySelector("#grammar-type"),
  grammarReroll: document.querySelector("#grammar-reroll"),
  grammarTrace: document.querySelector("#grammar-trace"),
  noiseKind: document.querySelector("#noise-kind"),
  noiseScale: document.querySelector("#noise-scale"),
  noiseScaleOutput: document.querySelector("#noise-scale-output"),
  noiseMask: document.querySelector("#noise-mask"),
  noiseRandom: document.querySelector("#noise-random"),
  noiseInfo: document.querySelector("#noise-info"),
  evoTarget: document.querySelector("#evo-target"),
  evoMutation: document.querySelector("#evo-mutation"),
  evoMutationOutput: document.querySelector("#evo-mutation-output"),
  evoRun: document.querySelector("#evo-run"),
  evoReset: document.querySelector("#evo-reset"),
  evoStats: document.querySelector("#evo-stats"),
  evoControls: document.querySelector("#evo-controls"),
  evoDetail: document.querySelector("#evo-detail"),
  evoDetailTitle: document.querySelector("#evo-detail-title"),
  evoDetailStats: document.querySelector("#evo-detail-stats"),
  evoOrigin: document.querySelector("#evo-origin"),
  evoBreakdown: document.querySelector("#evo-breakdown"),
  evoBack: document.querySelector("#evo-back"),
  labSeed: document.querySelector("#lab-seed"),
  labRandom: document.querySelector("#lab-random"),
  labType: document.querySelector("#lab-type"),
  labHeight: document.querySelector("#lab-height"),
  labHeightOutput: document.querySelector("#lab-height-output"),
  labWingspan: document.querySelector("#lab-wingspan"),
  labWingspanOutput: document.querySelector("#lab-wingspan-output"),
  labTexture: document.querySelector("#lab-texture"),
  labHead: document.querySelector("#lab-head"),
  labAccessory: document.querySelector("#lab-accessory"),
  labPalette: document.querySelector("#lab-palette"),
  labEye: document.querySelector("#lab-eye"),
  labBody: document.querySelector("#lab-body"),
  labWing: document.querySelector("#lab-wing"),
  labLegs: document.querySelector("#lab-legs"),
  labLegsOutput: document.querySelector("#lab-legs-output"),
  labScale: document.querySelector("#lab-scale"),
  labScaleOutput: document.querySelector("#lab-scale-output"),
  labMask: document.querySelector("#lab-mask"),
  labStats: document.querySelector("#lab-stats"),
  labReset: document.querySelector("#lab-reset"),
  labDownload: document.querySelector("#lab-download"),
}

const STEPS = [
  {
    title: "Комбинаторика",
    text: "Собери моба из готовых частей: голова, аксессуар, палитра, глаза, телосложение и рисунок крыльев. Меняй части местами и перекрашивай — получаются новые визуалы без новой геометрии.",
    formula: "4 головы × 4 брони × 4 палитры × 3 глаза = 192 комбинации",
  },
  {
    title: "Параметрические модели",
    text: "Теперь форма задаётся числами. Высота управляет здоровьем и скоростью, размах крыльев и длина лап — силуэтом. Параметры зависят друг от друга.",
    formula: "height → health = height × 100 + random(−25, 50)\nheight → speed = 1 / height",
  },
  {
    title: "Грамматика и модули",
    text: "Размер тела задаёт количество крыльев, количество крыльев — их форму, а тип моба меняет голову и окрас. Это модульная сборка по правилам.",
    formula: "body_size → wing_count → wing_shape\ntype → head + palette",
  },
  {
    title: "Шумы и генеративные функции",
    text: "Форма остаётся, а поверхность становится уникальной. Perlin подходит для ткани и курток, Worley — для кожи рептилии и перепонок.",
    formula: "texture(p) = noise(p × scale)\nmask → где текстура применяется",
  },
  {
    title: "Эволюция",
    text: "Популяция из 50 мобов. Считаем пригодность — насколько особь подходит к цели, оставляем лучших, скрещиваем и добавляем мутации. Через несколько поколений признаки сходятся к цели.",
    formula: "child = crossover(parentA, parentB)\nchild += mutation(rate)",
  },
]

const TYPE_LABELS = TYPES
const EYE_LABELS = EYES

let W = 0
let H = 0
let dpr = 1
let level = 1
let step = 0
let genome = createGenome(37)
let population = []
let populationSeed = 37
let generation = 0
let target = "hunter"
let selectedIndex = -1
let populationGeometry = null
const thumbCache = new Map()

function fillSelect(select, values, selected) {
  select.innerHTML = Object.entries(values)
    .map(([value, item]) => `<option value="${value}">${item.label}</option>`)
    .join("")
  select.value = selected
}

function initSelects() {
  fillSelect(els.comboHead, HEADS, genome.head)
  fillSelect(els.comboAccessory, ACCESSORIES, genome.accessory)
  fillSelect(els.comboPalette, PALETTES, genome.palette)
  fillSelect(els.comboEye, EYES, genome.eye)
  fillSelect(els.comboBody, BODY_SHAPES, genome.bodyShape)
  fillSelect(els.comboWing, WING_PATTERNS, genome.wingPattern)
  fillSelect(els.grammarType, TYPES, genome.type)
  fillSelect(els.noiseKind, TEXTURES, genome.texture.kind)
  fillSelect(els.labType, TYPES, genome.type)
  fillSelect(els.labTexture, TEXTURES, genome.texture.kind)
  fillSelect(els.labHead, HEADS, genome.head)
  fillSelect(els.labAccessory, ACCESSORIES, genome.accessory)
  fillSelect(els.labPalette, PALETTES, genome.palette)
  fillSelect(els.labEye, EYES, genome.eye)
  fillSelect(els.labBody, BODY_SHAPES, genome.bodyShape)
  fillSelect(els.labWing, WING_PATTERNS, genome.wingPattern)
}

function statCards(targetEl, items) {
  targetEl.innerHTML = items
    .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
    .join("")
}

function syncControls() {
  els.comboHead.value = genome.head
  els.comboAccessory.value = genome.accessory
  els.comboPalette.value = genome.palette
  els.comboEye.value = genome.eye
  els.comboBody.value = genome.bodyShape
  els.comboWing.value = genome.wingPattern
  els.paramHeight.value = String(genome.height.toFixed(2))
  els.paramHeightOutput.textContent = genome.height.toFixed(2)
  els.paramWingspan.value = String(genome.wingspan.toFixed(2))
  els.paramWingspanOutput.textContent = genome.wingspan.toFixed(2)
  els.paramLegs.value = String(genome.legs.toFixed(2))
  els.paramLegsOutput.textContent = genome.legs.toFixed(2)
  els.grammarSize.value = genome.bodySize
  els.grammarType.value = genome.type
  els.noiseKind.value = genome.texture.kind
  els.noiseScale.value = String(genome.texture.scale)
  els.noiseScaleOutput.textContent = String(genome.texture.scale)
  els.noiseMask.checked = genome.texture.maskHead
  els.labType.value = genome.type
  els.labHeight.value = String(genome.height.toFixed(2))
  els.labHeightOutput.textContent = genome.height.toFixed(2)
  els.labWingspan.value = String(genome.wingspan.toFixed(2))
  els.labWingspanOutput.textContent = genome.wingspan.toFixed(2)
  els.labTexture.value = genome.texture.kind
  els.labHead.value = genome.head
  els.labAccessory.value = genome.accessory
  els.labPalette.value = genome.palette
  els.labEye.value = genome.eye
  els.labBody.value = genome.bodyShape
  els.labWing.value = genome.wingPattern
  els.labLegs.value = String(genome.legs.toFixed(2))
  els.labLegsOutput.textContent = genome.legs.toFixed(2)
  els.labScale.value = String(genome.texture.scale)
  els.labScaleOutput.textContent = String(genome.texture.scale)
  els.labMask.checked = genome.texture.maskHead
  els.labSeed.textContent = `сид ${genome.seed}`
  const textureNotes = {
    none: "Текстура выключена — виден чистый окрас.",
    perlin: "Perlin даёт мягкие пятна, ткань и потёртости.",
    worley: "Worley даёт чешуйки и кожу рептилии.",
    bands: "Полосы подчёркивают форму крыльев и тела.",
    cells: "Ячеистый шум похож на крупную чешую.",
    grain: "Зерно добавляет мелкую шероховатость.",
  }
  els.noiseInfo.textContent = textureNotes[genome.texture.kind] || textureNotes.none
  statCards(els.paramStats, [
    ["Высота", genome.height.toFixed(2)],
    ["Здоровье", String(genome.health)],
    ["Скорость", genome.speed.toFixed(2)],
  ])
  statCards(els.labStats, [
    ["Здоровье", String(genome.health)],
    ["Скорость", genome.speed.toFixed(2)],
    ["Крылья", `${genome.wingCount}`],
  ])
}

function updateStepOutput() {
  if (step === 0) {
    els.stepFormula.textContent = `${Object.keys(HEADS).length} голов × ${Object.keys(ACCESSORIES).length} аксессуаров × ${Object.keys(PALETTES).length} палитр × ${Object.keys(EYES).length} варианта глаз × ${Object.keys(BODY_SHAPES).length} телосложения × ${Object.keys(WING_PATTERNS).length} рисунка крыльев = ${combinationCount().toLocaleString("ru-RU")} комбинаций`
    els.stepOutput.textContent = `${combinationCount().toLocaleString("ru-RU")} комбинаций · ${HEADS[genome.head].label} · ${BODY_SHAPES[genome.bodyShape].label}`
  } else if (step === 1) {
    els.stepOutput.textContent = `height = ${genome.height.toFixed(2)} · health = ${genome.health} · speed = ${genome.speed.toFixed(2)}`
  } else if (step === 2) {
    els.stepOutput.textContent = `${genome.bodySize} → ${genome.wingCount} крыльев → ${genome.wingShape} · ${TYPES[genome.type].label}`
    els.grammarTrace.innerHTML = grammarTrace(genome).map((line) => `<div>${line}</div>`).join("")
  } else if (step === 3) {
    els.stepOutput.textContent = `${TEXTURES[genome.texture.kind].label} · масштаб ${genome.texture.scale} · ${genome.texture.maskHead ? "голова без текстуры" : "текстура на всей голове"}`
  } else {
    const best = bestOf(population)
    els.stepOutput.textContent = `Поколение ${generation} · лучшая ${best ? best.fitness : 0} · средняя ${population.length ? averageFitness(population) : 0}`
    statCards(els.evoStats, [
      ["Поколение", String(generation)],
      ["Лучшая", String(best ? best.fitness : 0)],
      ["Средняя", String(population.length ? averageFitness(population) : 0)],
    ])
  }
}

function updateStepUi() {
  const current = STEPS[step]
  els.stepKicker.textContent = `Шаг ${step + 1} из ${STEPS.length}`
  els.stepTitle.textContent = current.title
  els.stepText.textContent = current.text
  els.stepFormula.textContent = current.formula
  els.stepButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.step) === step))
  })
  els.stepPanels.forEach((panel) => {
    panel.hidden = Number(panel.dataset.stepPanel) !== step
  })
  els.stepBack.disabled = step === 0
  els.stepNext.textContent = step === STEPS.length - 1 ? "В лабораторию" : "Дальше"
  syncControls()
  updateStepOutput()
  hint.hidden = true
  canvas.style.cursor = step === 4 && selectedIndex < 0 ? "pointer" : "default"
}

function setStep(next) {
  step = Math.max(0, Math.min(STEPS.length - 1, next))
  selectedIndex = -1
  els.evoDetail.hidden = true
  els.evoControls.hidden = false
  if (step === 4) ensurePopulation()
  updateStepUi()
  if (level === 1) draw()
}

function ensurePopulation() {
  if (!population.length) {
    population = createPopulation(50, populationSeed, target)
    generation = 0
    selectedIndex = -1
    thumbCache.clear()
  }
}

function resetPopulation(newSeed = populationSeed) {
  populationSeed = newSeed
  population = createPopulation(50, populationSeed, target)
  generation = 0
  selectedIndex = -1
  thumbCache.clear()
  els.evoDetail.hidden = true
  els.evoControls.hidden = false
  updateStepOutput()
  if (level === 1 && step === 4) draw()
}

function fillHex(hex) {
  const value = hex.replace("#", "")
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

function mixColor(a, b, t) {
  const ca = fillHex(a)
  const cb = fillHex(b)
  return `rgb(${Math.round(ca.r + (cb.r - ca.r) * t)}, ${Math.round(ca.g + (cb.g - ca.g) * t)}, ${Math.round(ca.b + (cb.b - ca.b) * t)})`
}

function makeNoisePattern(kind, scale, seed, palette) {
  if (kind === "none") return null
  const size = 96
  const sampler = createNoiseSampler(kind, scale, seed)
  const c = document.createElement("canvas")
  c.width = size
  c.height = size
  const g = c.getContext("2d")
  const image = g.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = sampler(x / size, y / size)
      const color = mixColor(palette.body, palette.accent, value)
      const match = color.match(/\d+/g).map(Number)
      const index = (y * size + x) * 4
      image.data[index] = match[0]
      image.data[index + 1] = match[1]
      image.data[index + 2] = match[2]
      image.data[index + 3] = 255
    }
  }
  g.putImageData(image, 0, 0)
  return c
}

function drawWing(g, side, pair, genome, palette) {
  const shape = genome.wingShape
  const span = 66 + genome.wingspan * 46 - pair * 5
  const depth = shape === "wide" ? 58 : shape === "long" ? 40 : shape === "bony" ? 48 : 46
  const anchorY = 166 + pair * 11
  g.save()
  g.translate(160, anchorY)
  g.scale(side, 1)
  g.beginPath()
  g.moveTo(8, 0)
  g.bezierCurveTo(span * 0.28, -depth, span * 0.78, -depth * 0.95, span, -8)
  if (shape === "bony") {
    g.lineTo(span * 0.82, depth * 0.28)
    g.lineTo(span * 0.7, depth * 0.06)
    g.lineTo(span * 0.58, depth * 0.34)
    g.lineTo(span * 0.46, depth * 0.08)
    g.lineTo(span * 0.33, depth * 0.38)
    g.lineTo(span * 0.2, depth * 0.14)
    g.lineTo(8, 12)
  } else {
    g.quadraticCurveTo(span * 0.8, depth * 0.35, span * 0.62, depth * 0.12)
    g.quadraticCurveTo(span * 0.48, depth * 0.5, span * 0.34, depth * 0.12)
    g.quadraticCurveTo(span * 0.2, depth * 0.35, 8, 11)
  }
  g.closePath()
  g.fillStyle = palette.membrane
  g.globalAlpha = genome.wingPattern === "skeletal" ? 0.26 : 0.88 - pair * 0.1
  g.fill()
  g.globalAlpha = 1
  g.strokeStyle = palette.accent
  g.lineWidth = 1.8
  g.stroke()
  g.strokeStyle = "rgba(8, 16, 30, 0.28)"
  g.lineWidth = 1
  for (const t of [0.28, 0.52, 0.76]) {
    g.beginPath()
    g.moveTo(10, 0)
    g.quadraticCurveTo(span * t, -depth * 0.35, span * t + 8, depth * 0.08)
    g.stroke()
  }
  if (genome.wingPattern === "feather") {
    g.strokeStyle = "rgba(255, 255, 255, 0.26)"
    g.lineWidth = 1.2
    for (const t of [0.22, 0.4, 0.58, 0.76]) {
      g.beginPath()
      g.moveTo(span * t, -depth * 0.18)
      g.quadraticCurveTo(span * (t + 0.08), depth * 0.05, span * (t + 0.12), depth * 0.2)
      g.stroke()
    }
  }
  if (genome.wingPattern === "skeletal") {
    g.strokeStyle = palette.accent
    g.lineWidth = 2.2
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      g.beginPath()
      g.moveTo(9, 0)
      g.lineTo(span * t, -depth * 0.18)
      g.stroke()
    }
    for (const t of [0.3, 0.55, 0.78]) {
      g.beginPath()
      g.moveTo(span * t, -4)
      g.lineTo(span * t, depth * 0.22)
      g.stroke()
    }
  }
  g.restore()
}

function bodyMetrics(genome) {
  const bodyScale = genome.height / 2.8
  const shape = BODY_SHAPES[genome.bodyShape]
  const bodyCY = 202
  const bodyH = 52 * bodyScale * shape.height
  const bodyW = 42 * (0.78 + bodyScale * 0.22) * shape.width
  const bodyTop = bodyCY - bodyH / 2
  const headR = 21 + bodyScale * 5
  const headY = bodyTop - 8 - (genome.head === "hooded" ? 3 : 0)
  return { bodyScale, bodyCY, bodyH, bodyW, bodyTop, headR, headY }
}

function drawBody(g, genome, palette) {
  const metrics = bodyMetrics(genome)
  const { bodyCY, bodyH, bodyW, bodyTop } = metrics
  for (let pair = Math.ceil(genome.wingCount / 2) - 1; pair >= 0; pair -= 1) {
    drawWing(g, -1, pair, genome, palette)
    drawWing(g, 1, pair, genome, palette)
  }
  const bodyGradient = g.createLinearGradient(160 - bodyW / 2, bodyTop, 160 + bodyW / 2, bodyCY + bodyH / 2)
  bodyGradient.addColorStop(0, palette.body)
  bodyGradient.addColorStop(1, palette.wing)
  g.beginPath()
  g.ellipse(160, bodyCY, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2)
  g.fillStyle = bodyGradient
  g.fill()
  g.strokeStyle = palette.accent
  g.lineWidth = 2
  g.stroke()
  g.beginPath()
  g.ellipse(160, bodyCY + 6, bodyW * 0.28, bodyH * 0.28, 0, 0, Math.PI * 2)
  g.fillStyle = "rgba(255, 255, 255, 0.08)"
  g.fill()
  const legStart = bodyCY + bodyH / 2 - 6
  const legEnd = Math.min(276, legStart + 20 + genome.legs * 22)
  for (const side of [-1, 1]) {
    g.beginPath()
    g.moveTo(160 + side * bodyW * 0.24, legStart)
    g.lineTo(160 + side * bodyW * 0.27, legEnd)
    g.strokeStyle = palette.body
    g.lineWidth = 6
    g.stroke()
    g.beginPath()
    g.ellipse(160 + side * bodyW * 0.28, legEnd + 2, 7, 4, 0, 0, Math.PI * 2)
    g.fillStyle = palette.wing
    g.fill()
    g.strokeStyle = palette.accent
    g.lineWidth = 1
    g.stroke()
  }
  return metrics
}

function drawHead(g, genome, palette) {
  const { headY, headR: r } = bodyMetrics(genome)
  g.save()
  g.strokeStyle = palette.accent
  g.lineWidth = 2
  g.fillStyle = palette.body
  if (genome.head === "hooded") {
    g.beginPath()
    g.moveTo(160 - r * 1.1, headY + r * 0.8)
    g.quadraticCurveTo(160 - r * 1.3, headY - r * 1.45, 160, headY - r * 1.5)
    g.quadraticCurveTo(160 + r * 1.3, headY - r * 1.45, 160 + r * 1.1, headY + r * 0.8)
    g.closePath()
    g.fillStyle = palette.wing
    g.fill()
    g.stroke()
  }
  if (genome.head === "angular") {
    g.beginPath()
    g.moveTo(160 - r, headY)
    g.lineTo(160 - r * 0.65, headY - r * 0.9)
    g.lineTo(160, headY - r * 1.1)
    g.lineTo(160 + r * 0.65, headY - r * 0.9)
    g.lineTo(160 + r, headY)
    g.lineTo(160 + r * 0.55, headY + r * 0.75)
    g.lineTo(160 - r * 0.55, headY + r * 0.75)
    g.closePath()
    g.fillStyle = palette.body
    g.fill()
    g.stroke()
  } else if (genome.head === "wide") {
    g.beginPath()
    g.ellipse(160, headY, r * 1.32, r * 0.72, 0, 0, Math.PI * 2)
    g.fillStyle = palette.body
    g.fill()
    g.stroke()
  } else if (genome.head === "split") {
    for (const side of [-1, 1]) {
      g.beginPath()
      g.ellipse(160 + side * r * 0.46, headY, r * 0.58, r * 0.86, 0, 0, Math.PI * 2)
      g.fillStyle = palette.body
      g.fill()
      g.stroke()
    }
    g.beginPath()
    g.moveTo(160, headY - r * 0.8)
    g.lineTo(160, headY + r * 0.75)
    g.strokeStyle = palette.accent
    g.stroke()
  } else {
    g.beginPath()
    g.ellipse(160, headY, r * (genome.head === "skull" ? 0.92 : 1), r * 0.88, 0, 0, Math.PI * 2)
    g.fillStyle = palette.body
    g.fill()
    g.stroke()
  }
  if (genome.head === "skull") {
    g.beginPath()
    g.moveTo(160 - r * 0.5, headY + r * 0.55)
    g.lineTo(160 + r * 0.5, headY + r * 0.55)
    g.lineTo(160 + r * 0.35, headY + r * 1.0)
    g.lineTo(160 - r * 0.35, headY + r * 1.0)
    g.closePath()
    g.fillStyle = palette.wing
    g.fill()
    g.stroke()
    for (const side of [-1, 1]) {
      g.beginPath()
      g.arc(160 + side * r * 0.45, headY + r * 0.25, r * 0.2, 0, Math.PI * 2)
      g.fillStyle = "rgba(8, 16, 30, 0.42)"
      g.fill()
    }
  }
  if (genome.head !== "hooded") {
    g.beginPath()
    g.moveTo(160 - r * 0.75, headY - r * 0.55)
    g.lineTo(160 - r * 0.62, headY - r * 1.65)
    g.lineTo(160 - r * 0.12, headY - r * 0.75)
    g.closePath()
    g.fillStyle = palette.wing
    g.fill()
    g.stroke()
    g.beginPath()
    g.moveTo(160 + r * 0.75, headY - r * 0.55)
    g.lineTo(160 + r * 0.62, headY - r * 1.65)
    g.lineTo(160 + r * 0.12, headY - r * 0.75)
    g.closePath()
    g.fill()
    g.stroke()
  }
  if (genome.head === "horned") {
    for (const side of [-1, 1]) {
      g.beginPath()
      g.moveTo(160 + side * r * 0.55, headY - r * 0.8)
      g.lineTo(160 + side * r * 0.9, headY - r * 1.95)
      g.lineTo(160 + side * r * 0.25, headY - r * 1.02)
      g.closePath()
      g.fillStyle = palette.accent
      g.fill()
    }
  }
  if (genome.head === "crest") {
    for (let i = 0; i < 3; i += 1) {
      g.beginPath()
      g.moveTo(160 + (i - 1) * 8, headY - r * 0.8)
      g.lineTo(160 + (i - 1) * 9, headY - r * 1.55)
      g.lineTo(160 + (i - 1) * 8 + 5, headY - r * 0.82)
      g.closePath()
      g.fillStyle = palette.accent
      g.fill()
    }
  }
  g.restore()
  return { headY, r }
}

function drawEyes(g, genome, palette) {
  const { headY, headR: r } = bodyMetrics(genome)
  const eyeColor = EYES[genome.eye].color
  const radius = 3.2 + genome.eyeSize * 2.2
  for (const side of [-1, 1]) {
    g.beginPath()
    g.arc(160 + side * r * 0.38, headY + 2, radius, 0, Math.PI * 2)
    g.fillStyle = eyeColor
    g.shadowColor = eyeColor
    g.shadowBlur = 9
    g.fill()
    g.shadowBlur = 0
    g.beginPath()
    g.arc(160 + side * r * 0.38, headY + 1, radius * 0.38, 0, Math.PI * 2)
    g.fillStyle = "#17243a"
    g.fill()
  }
  g.strokeStyle = palette.accent
  g.lineWidth = 1.2
  for (const side of [-1, 1]) {
    g.beginPath()
    g.moveTo(160 + side * r * 0.12, headY - 5)
    g.lineTo(160 + side * r * 0.67, headY - 6)
    g.stroke()
  }
}

function drawAccessory(g, genome, palette) {
  const { headY, headR: r, bodyCY, bodyH } = bodyMetrics(genome)
  if (genome.accessory === "helmet") {
    g.beginPath()
    g.arc(160, headY - 2, r * 1.08, Math.PI * 1.06, Math.PI * 1.94)
    g.lineTo(160 + r * 0.78, headY + 1)
    g.lineTo(160 - r * 0.78, headY + 1)
    g.closePath()
    g.fillStyle = "#7d8aa7"
    g.fill()
    g.strokeStyle = "#d1dcf0"
    g.lineWidth = 1.5
    g.stroke()
    for (const side of [-1, 1]) {
      g.beginPath()
      g.arc(160 + side * r * 0.68, headY + 2, 2, 0, Math.PI * 2)
      g.fillStyle = "#e9f0ff"
      g.fill()
    }
  } else if (genome.accessory === "spikes") {
    for (let i = 0; i < 5; i += 1) {
      g.beginPath()
      g.moveTo(130 + i * 15, 228)
      g.lineTo(126 + i * 15, 248)
      g.lineTo(138 + i * 15, 234)
      g.closePath()
      g.fillStyle = palette.accent
      g.fill()
    }
  } else if (genome.accessory === "armor") {
    const plate = g.createLinearGradient(140, 188, 180, 236)
    plate.addColorStop(0, "#b8c5d9")
    plate.addColorStop(1, "#6f7f9c")
    g.beginPath()
    g.moveTo(160 - 21, 187)
    g.lineTo(160 + 21, 187)
    g.lineTo(160 + 17, 220)
    g.lineTo(160, 234)
    g.lineTo(160 - 17, 220)
    g.closePath()
    g.fillStyle = plate
    g.fill()
    g.strokeStyle = "#e2ebf8"
    g.lineWidth = 1.5
    g.stroke()
    for (const side of [-1, 1]) {
      g.beginPath()
      g.arc(160 + side * 30, 194, 9, 0, Math.PI * 2)
      g.fillStyle = "#8c9ab4"
      g.fill()
      g.strokeStyle = "#dce7f7"
      g.lineWidth = 1.2
      g.stroke()
    }
    g.beginPath()
    g.moveTo(160, 194)
    g.lineTo(160, 224)
    g.strokeStyle = "rgba(255, 255, 255, 0.35)"
    g.lineWidth = 1
    g.stroke()
  } else if (genome.accessory === "crown") {
    g.beginPath()
    g.moveTo(160 - r * 0.8, headY - r * 0.95)
    g.lineTo(160 - r * 0.55, headY - r * 1.55)
    g.lineTo(160 - r * 0.18, headY - r * 1.05)
    g.lineTo(160, headY - r * 1.65)
    g.lineTo(160 + r * 0.18, headY - r * 1.05)
    g.lineTo(160 + r * 0.55, headY - r * 1.55)
    g.lineTo(160 + r * 0.8, headY - r * 0.95)
    g.closePath()
    g.fillStyle = "#f0c96a"
    g.fill()
    g.strokeStyle = "#fff0b8"
    g.lineWidth = 1.4
    g.stroke()
  } else if (genome.accessory === "goggles") {
    g.strokeStyle = "#2b3344"
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(160 - r * 0.95, headY - r * 0.05)
    g.lineTo(160 + r * 0.95, headY - r * 0.05)
    g.stroke()
    for (const side of [-1, 1]) {
      g.beginPath()
      g.arc(160 + side * r * 0.38, headY + 1, r * 0.26, 0, Math.PI * 2)
      g.fillStyle = "rgba(150, 230, 255, 0.35)"
      g.fill()
      g.strokeStyle = "#dce7f7"
      g.lineWidth = 1.5
      g.stroke()
    }
  } else if (genome.accessory === "scarf") {
    g.beginPath()
    g.ellipse(160, headY + r * 0.9, r * 0.95, r * 0.24, 0, 0, Math.PI * 2)
    g.fillStyle = palette.accent
    g.fill()
    g.beginPath()
    g.moveTo(160 + r * 0.55, headY + r * 0.95)
    g.lineTo(160 + r * 1.35, headY + r * 1.5)
    g.lineTo(160 + r * 1.1, headY + r * 1.75)
    g.lineTo(160 + r * 0.4, headY + r * 1.2)
    g.closePath()
    g.fillStyle = palette.accent
    g.fill()
  } else if (genome.accessory === "crystals") {
    for (const [x, y, size] of [[120, 190, 11], [200, 195, 9], [135, 215, 7]]) {
      g.beginPath()
      g.moveTo(x, y - size)
      g.lineTo(x + size * 0.55, y)
      g.lineTo(x, y + size * 0.7)
      g.lineTo(x - size * 0.45, y)
      g.closePath()
      g.fillStyle = "rgba(170, 235, 255, 0.85)"
      g.fill()
      g.strokeStyle = "#e8fbff"
      g.lineWidth = 1
      g.stroke()
    }
  }
}

function drawTypeDetails(g, genome, palette) {
  if (genome.type === "ice") {
    for (const [x, y, size] of [[128, 128, 8], [192, 122, 6], [205, 145, 5]]) {
      g.beginPath()
      g.moveTo(x, y - size)
      g.lineTo(x + size * 0.65, y)
      g.lineTo(x, y + size * 0.7)
      g.lineTo(x - size * 0.55, y)
      g.closePath()
      g.fillStyle = "rgba(210, 250, 255, 0.8)"
      g.fill()
    }
  }
  if (genome.type === "fire") {
    g.beginPath()
    g.moveTo(150, 108)
    g.quadraticCurveTo(138, 88, 154, 80)
    g.quadraticCurveTo(148, 100, 162, 108)
    g.fillStyle = "rgba(255, 170, 64, 0.8)"
    g.fill()
  }
  if (genome.type === "zombie") {
    g.strokeStyle = "rgba(210, 235, 160, 0.55)"
    g.lineWidth = 1.5
    for (const [x, y] of [[146, 198], [174, 208], [160, 220]]) {
      g.beginPath()
      g.moveTo(x - 4, y)
      g.lineTo(x + 4, y)
      g.stroke()
    }
  }
}

function applyTexture(g, genome, palette) {
  const patternCanvas = makeNoisePattern(genome.texture.kind, genome.texture.scale, genome.texture.seed, palette)
  if (!patternCanvas) return
  const pattern = g.createPattern(patternCanvas, "repeat")
  g.save()
  g.globalCompositeOperation = "source-atop"
  g.globalAlpha = 0.48
  g.fillStyle = pattern
  g.fillRect(0, 0, 320, 320)
  g.restore()
}

function makeCreatureCanvas(genome, size = 320, simple = false) {
  const c = document.createElement("canvas")
  c.width = size
  c.height = size
  const g = c.getContext("2d")
  g.scale(size / 320, size / 320)
  const palette = PALETTES[genome.palette]
  drawBody(g, genome, palette)
  if (!simple && genome.texture.kind !== "none" && !genome.texture.maskHead) drawHead(g, genome, palette)
  if (!simple) applyTexture(g, genome, palette)
  if (simple || genome.texture.kind === "none" || genome.texture.maskHead) drawHead(g, genome, palette)
  drawEyes(g, genome, palette)
  drawAccessory(g, genome, palette)
  drawTypeDetails(g, genome, palette)
  return c
}

function drawStageBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H)
  gradient.addColorStop(0, "#dbe8f6")
  gradient.addColorStop(1, "#edf3fa")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.strokeStyle = "rgba(36, 72, 112, 0.07)"
  ctx.lineWidth = 1
  for (let x = 40; x < W; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 40; y < H; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.restore()
}

function drawCreatureScene() {
  drawStageBackground()
  const size = Math.min(W * 0.67, H * 0.82)
  const x = (W - size) / 2
  const y = (H - size) / 2 + 12
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(W / 2, H * 0.79, size * 0.27, size * 0.07, 0, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(7, 17, 28, 0.16)"
  ctx.fill()
  ctx.restore()
  const creature = makeCreatureCanvas(genome, 480)
  ctx.drawImage(creature, x, y, size, size)
  ctx.save()
  ctx.fillStyle = "rgba(7, 17, 28, 0.75)"
  const label = `сид ${genome.seed} · ${TYPES[genome.type].label}`
  ctx.font = "700 11px Manrope, system-ui, sans-serif"
  const width = ctx.measureText(label).width + 18
  ctx.fillRect(x + 8, y + 8, width, 24)
  ctx.fillStyle = "#eaf3fd"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(label, x + 17, y + 20)
  ctx.restore()
}

function getThumb(genome) {
  const key = `${genome.seed}:${genome.height.toFixed(2)}:${genome.wingspan.toFixed(2)}:${genome.wingCount}:${genome.type}:${genome.palette}:${genome.head}:${genome.accessory}:${genome.eye}:${genome.eyeSize.toFixed(2)}:${genome.bodyShape}:${genome.wingPattern}`
  if (!thumbCache.has(key)) thumbCache.set(key, makeCreatureCanvas(genome, 150, true))
  return thumbCache.get(key)
}

function selectPopulation(index) {
  const item = population[index]
  if (!item) return
  selectedIndex = index
  canvas.style.cursor = "default"
  renderEvolutionDetail(item, index)
  draw()
}

function renderEvolutionDetail(item, index) {
  const genome = item.genome
  const lineage = item.lineage || { generation: 0, parents: null, mutationRate: 0, elite: false }
  els.evoControls.hidden = true
  els.evoDetail.hidden = false
  els.evoDetailTitle.textContent = `Особь #${index + 1} · ${TYPES[genome.type].label}`
  statCards(els.evoDetailStats, [
    ["Пригодность", String(item.fitness)],
    ["Здоровье", String(genome.health)],
    ["Скорость", genome.speed.toFixed(2)],
  ])
  const origin = lineage.parents
    ? `Поколение ${lineage.generation} · скрещивание сидов ${lineage.parents[0]} и ${lineage.parents[1]} · мутация ${(lineage.mutationRate * 100).toFixed(0)}%`
    : lineage.elite
      ? `Поколение ${lineage.generation} · элита, перешла без изменений`
      : `Поколение ${lineage.generation} · случайная особь`
  els.evoOrigin.textContent = `${origin}. Гены: ${HEADS[genome.head].label.toLowerCase()}, ${BODY_SHAPES[genome.bodyShape].label.toLowerCase()}, ${genome.wingCount} крыльев (${WING_PATTERNS[genome.wingPattern].label.toLowerCase()}), ${PALETTES[genome.palette].label.toLowerCase()}, ${TEXTURES[genome.texture.kind].label.toLowerCase()}.`
  const breakdown = fitnessBreakdown(genome, target)
  const rows = breakdown.parts
    .map((part) => `<div class="bestiary-breakdown-row"><span>${part.label}</span><span>${part.actual} → ${part.target}</span><strong>+${Math.round(part.score * part.weight * 100)}</strong></div>`)
    .join("")
  els.evoBreakdown.innerHTML = `
    <div class="bestiary-breakdown-head">Пригодность ${breakdown.score} / 100 · цель «${TARGETS[target].label}»</div>
    <div class="bestiary-breakdown-formula">F = 0.28·высота + 0.24·крылья + 0.15·тип + 0.12·палитра + 0.11·глаза + 0.10·голова</div>
    ${rows}
    <div class="bestiary-breakdown-total">Сумма вкладов: +${breakdown.score} / 100</div>
  `
}

function drawPopulationDetail() {
  drawStageBackground()
  const item = population[selectedIndex]
  if (!item) return
  const size = Math.min(W * 0.67, H * 0.82)
  const x = (W - size) / 2
  const y = (H - size) / 2 + 12
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(W / 2, H * 0.79, size * 0.27, size * 0.07, 0, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(7, 17, 28, 0.16)"
  ctx.fill()
  ctx.restore()
  const creature = makeCreatureCanvas(item.genome, 480)
  ctx.drawImage(creature, x, y, size, size)
  ctx.save()
  ctx.fillStyle = "rgba(7, 17, 28, 0.75)"
  const label = `Особь #${selectedIndex + 1} · пригодность ${item.fitness}`
  ctx.font = "700 12px Manrope, system-ui, sans-serif"
  const width = ctx.measureText(label).width + 20
  ctx.fillRect(x + 8, y + 8, width, 26)
  ctx.fillStyle = "#eaf3fd"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(label, x + 18, y + 21)
  ctx.restore()
}

function drawPopulationScene() {
  drawStageBackground()
  ensurePopulation()
  if (selectedIndex >= 0) {
    drawPopulationDetail()
    return
  }
  const columns = W < 620 ? 5 : 10
  const rows = Math.ceil(population.length / columns)
  const gap = 8
  const cell = Math.min((W - 40 - gap * (columns - 1)) / columns, (H - 70 - gap * (rows - 1)) / rows)
  const gridW = columns * cell + (columns - 1) * gap
  const gridH = rows * cell + (rows - 1) * gap
  const left = (W - gridW) / 2
  const top = Math.max(42, (H - gridH) / 2)
  populationGeometry = { left, top, cell, gap, columns, rows }
  const best = bestOf(population)
  population.forEach((item, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const x = left + col * (cell + gap)
    const y = top + row * (cell + gap)
    const thumb = getThumb(item.genome)
    ctx.save()
    ctx.fillStyle = "rgba(248, 251, 254, 0.82)"
    ctx.fillRect(x, y, cell, cell)
    ctx.drawImage(thumb, x + 2, y + 2, cell - 4, cell - 12)
    ctx.fillStyle = item === best ? "#146b3a" : "#5a7087"
    ctx.font = `700 ${Math.max(8, Math.min(10, cell * 0.16))}px Manrope, system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(String(item.fitness), x + cell / 2, y + cell - 2)
    if (item === best) {
      ctx.strokeStyle = "#ff8a3d"
      ctx.lineWidth = 2.5
      ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
    }
    ctx.restore()
  })
  ctx.save()
  ctx.fillStyle = "rgba(7, 17, 28, 0.75)"
  const label = `Поколение ${generation} · ${TARGETS[target].label}`
  ctx.font = "700 12px Manrope, system-ui, sans-serif"
  const width = ctx.measureText(label).width + 20
  ctx.fillRect(12, 10, width, 26)
  ctx.fillStyle = "#eaf3fd"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(label, 22, 23)
  ctx.restore()
}

function draw() {
  if (!ctx || W === 0 || H === 0) return
  if (level === 2) drawCreatureScene()
  else if (step === 4) drawPopulationScene()
  else drawCreatureScene()
}

function setLevel(next) {
  level = next
  tabs.forEach((tab) => tab.setAttribute("aria-selected", String(Number(tab.dataset.level) === level)))
  panels.forEach((panel) => {
    panel.hidden = Number(panel.id.replace("panel-", "")) !== level
  })
  if (level === 2) {
    syncControls()
    hint.hidden = true
    draw()
  } else {
    setStep(step)
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect()
  if (rect.width < 10 || rect.height < 10) return
  W = Math.round(rect.width)
  H = Math.round(rect.height)
  dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  draw()
}

function bindSelect(select, key, after) {
  select.addEventListener("change", () => {
    const patch = { [key]: select.value }
    if (after) Object.assign(patch, after(select.value))
    genome = updateGenome(genome, patch)
    syncControls()
    updateStepOutput()
    draw()
  })
}

initSelects()

els.stepButtons.forEach((button) => {
  button.addEventListener("click", () => setStep(Number(button.dataset.step)))
})
els.stepBack.addEventListener("click", () => setStep(step - 1))
els.stepNext.addEventListener("click", () => {
  if (step === STEPS.length - 1) setLevel(2)
  else setStep(step + 1)
})
els.stepReset.addEventListener("click", () => {
  genome = createGenome(37)
  population = []
  generation = 0
  thumbCache.clear()
  setStep(0)
})

bindSelect(els.comboHead, "head")
bindSelect(els.comboAccessory, "accessory")
bindSelect(els.comboPalette, "palette")
bindSelect(els.comboEye, "eye")
bindSelect(els.comboBody, "bodyShape")
bindSelect(els.comboWing, "wingPattern")
bindSelect(els.grammarType, "type", (value) => ({ palette: TYPE_PALETTE[value] }))
bindSelect(els.noiseKind, "texture", (value) => ({ texture: { ...genome.texture, kind: value } }))
bindSelect(els.labType, "type", (value) => ({ palette: TYPE_PALETTE[value] }))
bindSelect(els.labTexture, "texture", (value) => ({ texture: { ...genome.texture, kind: value } }))
bindSelect(els.labHead, "head")
bindSelect(els.labAccessory, "accessory")
bindSelect(els.labPalette, "palette")
bindSelect(els.labEye, "eye")
bindSelect(els.labBody, "bodyShape")
bindSelect(els.labWing, "wingPattern")

els.comboRandom.addEventListener("click", () => {
  genome = rerollParts(genome, Math.floor(Math.random() * 100000))
  syncControls()
  updateStepOutput()
  draw()
})

for (const [input, key] of [[els.paramHeight, "height"], [els.paramWingspan, "wingspan"], [els.paramLegs, "legs"]]) {
  input.addEventListener("input", () => {
    genome = updateGenome(genome, { [key]: Number(input.value) })
    syncControls()
    updateStepOutput()
    draw()
  })
}

els.grammarSize.addEventListener("change", () => {
  const base = { small: 2.15, medium: 2.8, large: 3.4 }
  genome = updateGenome(genome, { bodySize: els.grammarSize.value, height: base[els.grammarSize.value] })
  genome = rerollModules(genome)
  syncControls()
  updateStepOutput()
  draw()
})

els.grammarReroll.addEventListener("click", () => {
  genome = rerollModules(genome)
  syncControls()
  updateStepOutput()
  draw()
})

els.noiseScale.addEventListener("input", () => {
  genome = updateGenome(genome, { texture: { ...genome.texture, scale: Number(els.noiseScale.value) } })
  syncControls()
  updateStepOutput()
  draw()
})
els.noiseMask.addEventListener("change", () => {
  genome = updateGenome(genome, { texture: { ...genome.texture, maskHead: els.noiseMask.checked } })
  syncControls()
  updateStepOutput()
  draw()
})
els.noiseRandom.addEventListener("click", () => {
  genome = updateGenome(genome, { texture: { ...genome.texture, seed: Math.floor(Math.random() * 100000) } })
  syncControls()
  updateStepOutput()
  draw()
})

els.evoMutation.addEventListener("input", () => {
  els.evoMutationOutput.textContent = Number(els.evoMutation.value).toFixed(2)
})
els.evoTarget.addEventListener("change", () => {
  target = els.evoTarget.value
  resetPopulation(populationSeed)
})
els.evoRun.addEventListener("click", () => {
  ensurePopulation()
  population = evolvePopulation(
    population,
    target,
    Number(els.evoMutation.value),
    populationSeed + generation * 977 + 13,
    generation + 1,
  )
  generation += 1
  selectedIndex = -1
  els.evoDetail.hidden = true
  updateStepOutput()
  draw()
})
els.evoReset.addEventListener("click", () => {
  resetPopulation(Math.floor(Math.random() * 100000))
})

els.labHeight.addEventListener("input", () => {
  genome = updateGenome(genome, { height: Number(els.labHeight.value) })
  syncControls()
  draw()
})
els.labWingspan.addEventListener("input", () => {
  genome = updateGenome(genome, { wingspan: Number(els.labWingspan.value) })
  syncControls()
  draw()
})
els.labLegs.addEventListener("input", () => {
  genome = updateGenome(genome, { legs: Number(els.labLegs.value) })
  syncControls()
  draw()
})
els.labScale.addEventListener("input", () => {
  genome = updateGenome(genome, { texture: { ...genome.texture, scale: Number(els.labScale.value) } })
  syncControls()
  draw()
})
els.labMask.addEventListener("change", () => {
  genome = updateGenome(genome, { texture: { ...genome.texture, maskHead: els.labMask.checked } })
  syncControls()
  draw()
})
els.labRandom.addEventListener("click", () => {
  genome = createGenome(Math.floor(Math.random() * 100000))
  syncControls()
  updateStepOutput()
  draw()
})
els.labReset.addEventListener("click", () => {
  genome = createGenome(37)
  syncControls()
  updateStepOutput()
  draw()
})
els.labDownload.addEventListener("click", () => {
  const creature = makeCreatureCanvas(genome, 640)
  const link = document.createElement("a")
  link.download = `bestiary-${genome.seed}.png`
  link.href = creature.toDataURL("image/png")
  link.click()
})

els.evoBack.addEventListener("click", () => {
  selectedIndex = -1
  els.evoDetail.hidden = true
  els.evoControls.hidden = false
  canvas.style.cursor = "pointer"
  draw()
})

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * (W / rect.width),
    y: (event.clientY - rect.top) * (H / rect.height),
  }
}

canvas.addEventListener("click", (event) => {
  if (level !== 1 || step !== 4 || selectedIndex >= 0 || !populationGeometry) return
  const point = canvasPoint(event)
  const { left, top, cell, gap, columns, rows } = populationGeometry
  const col = Math.floor((point.x - left) / (cell + gap))
  const row = Math.floor((point.y - top) / (cell + gap))
  if (col < 0 || row < 0 || col >= columns || row >= rows) return
  const cellX = left + col * (cell + gap)
  const cellY = top + row * (cell + gap)
  if (point.x > cellX + cell || point.y > cellY + cell) return
  const index = row * columns + col
  if (index < population.length) selectPopulation(index)
})

tabs.forEach((tab) => tab.addEventListener("click", () => setLevel(Number(tab.dataset.level))))

syncControls()
setLevel(1)
const observer = new ResizeObserver(resize)
observer.observe(canvas)
window.addEventListener("resize", resize)
requestAnimationFrame(resize)
