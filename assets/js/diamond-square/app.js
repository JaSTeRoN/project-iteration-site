import { generateDiamondSquare, sampleGrid } from "./algorithm.js"

const TUTORIAL_SIZE = 5
const TUTORIAL_SEED = 23
const TUTORIAL_ROUGHNESS = 0.55
const DEFAULTS = { size: 33, roughness: 0.55, sea: 0.45, palette: "terrain", smooth: true, grid: false, seed: 37 }

const canvas = document.querySelector("#diamond-canvas")
const ctx = canvas.getContext("2d")
const hint = document.querySelector("#canvas-hint")
const tabs = [...document.querySelectorAll("[data-level]")]
const panels = [...document.querySelectorAll(".diamond-panel")]

const els = {
  stepKicker: document.querySelector("#step-kicker"),
  stepTitle: document.querySelector("#step-title"),
  stepText: document.querySelector("#step-text"),
  stepFormula: document.querySelector("#step-formula"),
  stepCalc: document.querySelector("#step-calc"),
  cellInfo: document.querySelector("#cell-info"),
  stepBack: document.querySelector("#step-back"),
  stepNext: document.querySelector("#step-next"),
  stepReset: document.querySelector("#step-reset"),
  size: document.querySelector("#size"),
  roughness: document.querySelector("#roughness"),
  roughnessOutput: document.querySelector("#roughness-output"),
  sea: document.querySelector("#sea"),
  seaOutput: document.querySelector("#sea-output"),
  palette: document.querySelector("#palette"),
  smooth: document.querySelector("#smooth"),
  grid: document.querySelector("#show-grid"),
  randomize: document.querySelector("#randomize"),
  reset: document.querySelector("#reset"),
  status: document.querySelector("#sandbox-status"),
  sandboxCellInfo: document.querySelector("#sandbox-cell-info"),
}

const tutorial = generateDiamondSquare(TUTORIAL_SIZE, TUTORIAL_ROUGHNESS, TUTORIAL_SEED)
const tutorialLandscape = generateDiamondSquare(33, 0.55, 37)
const params = { ...DEFAULTS }
let sandbox = generateDiamondSquare(params.size, params.roughness, params.seed)
let W = 0
let H = 0
let dpr = 1
let level = 1
let step = 0
let renderQueued = false
let tutorialGeometry = null
let sandboxGeometry = null
let hoverCell = null
let pinnedCell = null
let defaultFocus = null
let sandboxHover = null
let sandboxPinned = null

const steps = [
  {
    title: "Сетка 5 × 5",
    text: "Diamond-Square работает на квадратной сетке размером 2ⁿ + 1. Для примера возьмём 5 × 5: сначала известны только четыре угла, остальные высоты нужно вычислить.",
  },
  {
    title: "Diamond: какие клетки нужны",
    text: "Чтобы вычислить центр большого квадрата, нужны четыре угла. Стрелки показывают, откуда берутся значения. Центр пока пустой — мы только выбрали источники.",
  },
  {
    title: "Diamond: вычисляем центр",
    text: "Теперь считаем высоту центра: среднее четырёх углов плюс случайное смещение. Новая клетка выделена оранжевым.",
  },
  {
    title: "Square: какие клетки нужны",
    text: "Теперь заполняем середины сторон. У каждой середины есть соседи: у точки на краю их три, у внутренней — четыре. Стрелки показывают источники, а целевые клетки пока пустые.",
  },
  {
    title: "Square: вычисляем середины",
    text: "Считаем каждую середину как среднее доступных соседей плюс случайное смещение. После этого шага заполнены все середины сторон большого квадрата.",
  },
  {
    title: "Следующий уровень",
    text: "Большой квадрат разбился на четыре маленьких. Для каждого снова выполняем diamond-шаг. Шаг сетки уменьшился вдвое, поэтому и случайное смещение стало меньше.",
  },
  {
    title: "Последний square-шаг",
    text: "Осталось заполнить середины сторон у маленьких ромбов. Снова усредняем соседей и добавляем небольшое случайное смещение.",
  },
  {
    title: "Все высоты заполнены",
    text: "Мы получили полную карту высот 5 × 5 в клетках. Теперь её можно сгладить: интерполировать значения между центрами клеток.",
  },
  {
    title: "Сглаживаем высоты",
    text: "Сглаживание — отдельный шаг. Между центрами клеток высоты плавно интерполируются, поэтому резкие границы клеток исчезают, а рельеф становится непрерывным.",
  },
  {
    title: "Раскрашиваем рельеф",
    text: "Сглаженные высоты раскрашиваются: низкие значения — вода, выше — песок, трава, камни и снег. На рисунке — пример для сетки 33 × 33.",
  },
]

const stepConfigs = [
  { grid: 0, arrows: null },
  { grid: 0, arrows: 1, targetOnly: true },
  { grid: 1, arrows: 1 },
  { grid: 1, arrows: 2, targetOnly: true },
  { grid: 2, arrows: 2 },
  { grid: 3, arrows: 3 },
  { grid: 4, arrows: 4 },
  { grid: 4, arrows: null },
  { smooth: true },
  { terrain: true },
]

function colorFor(value, sea, palette) {
  const v = Math.max(0, Math.min(1, value))
  if (palette === "gray") {
    const shade = Math.round(v * 255)
    return [shade, shade, shade]
  }
  if (palette === "heat") {
    if (v < 0.5) return mix([21, 45, 96], [83, 173, 201], v * 2)
    if (v < 0.78) return mix([83, 173, 201], [244, 213, 99], (v - 0.5) / 0.28)
    return mix([244, 213, 99], [186, 58, 43], (v - 0.78) / 0.22)
  }
  if (v < sea) return mix([8, 32, 67], [55, 137, 186], sea === 0 ? 0 : v / sea)
  if (v < sea + 0.03) return [214, 196, 147]
  if (v < sea + 0.18) return mix([154, 187, 119], [87, 141, 87], (v - sea - 0.03) / 0.15)
  if (v < sea + 0.33) return mix([87, 141, 87], [55, 104, 72], (v - sea - 0.18) / 0.15)
  if (v < sea + 0.46) return mix([112, 113, 107], [151, 151, 143], (v - sea - 0.33) / 0.13)
  return mix([225, 231, 233], [255, 255, 255], Math.min(1, (v - sea - 0.46) / 0.2))
}

function mix(from, to, t) {
  const amount = Math.max(0, Math.min(1, t))
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ]
}

function luminance([r, g, b]) {
  return r * 0.299 + g * 0.587 + b * 0.114
}

function drawArrowLine(from, to, color) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  if (length < 4) return
  const end = { x: from.x + Math.cos(angle) * (length - 10), y: from.y + Math.sin(angle) * (length - 10) }
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.7
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(end.x, end.y)
  ctx.lineTo(end.x - 8 * Math.cos(angle - 0.5), end.y - 8 * Math.sin(angle - 0.5))
  ctx.lineTo(end.x - 8 * Math.cos(angle + 0.5), end.y - 8 * Math.sin(angle + 0.5))
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

function drawGrid(config, focus) {
  const size = TUTORIAL_SIZE
  const cell = Math.min((W * 0.72) / size, (H * 0.78) / size)
  const left = (W - cell * size) / 2
  const top = (H - cell * size) / 2
  tutorialGeometry = { left, top, cell, size }
  const center = (x, y) => ({ x: left + (x + 0.5) * cell, y: top + (y + 0.5) * cell })
  const gridPhase = tutorial.phases[config.grid]
  const arrowPhase = config.arrows !== null ? tutorial.phases[config.arrows] : null
  const focusInfo = arrowPhase && focus
    ? arrowPhase.added.find((item) => item.x === focus.x && item.y === focus.y)
    : null

  ctx.save()
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = gridPhase.grid[y][x]
      const px = left + x * cell
      const py = top + y * cell
      if (value === null) {
        ctx.fillStyle = "rgba(23, 54, 88, 0.04)"
        ctx.fillRect(px, py, cell, cell)
      } else {
        const [r, g, b] = colorFor(value, 0.45, "terrain")
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.fillRect(px, py, cell, cell)
      }
    }
  }

  if (arrowPhase) {
    const targets = arrowPhase.added.length <= 4
      ? arrowPhase.added
      : (focusInfo ? [focusInfo] : [])
    for (const target of targets) {
      for (const neighbor of target.neighbors) {
        ctx.save()
        ctx.strokeStyle = "rgba(47, 93, 145, 0.55)"
        ctx.setLineDash([4, 4])
        ctx.lineWidth = 1.4
        ctx.strokeRect(left + neighbor.x * cell + 4, top + neighbor.y * cell + 4, cell - 8, cell - 8)
        ctx.restore()
        drawArrowLine(center(neighbor.x, neighbor.y), center(target.x, target.y), "rgba(47, 93, 145, 0.55)")
      }
      const targetValue = gridPhase.grid[target.y][target.x]
      ctx.save()
      ctx.setLineDash(targetValue === null ? [6, 4] : [])
      ctx.strokeStyle = "#ff8a3d"
      ctx.lineWidth = 3
      ctx.strokeRect(left + target.x * cell + 2, top + target.y * cell + 2, cell - 4, cell - 4)
      ctx.restore()
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = gridPhase.grid[y][x]
      const px = left + x * cell
      const py = top + y * cell
      if (value === null) {
        ctx.fillStyle = "rgba(23, 54, 88, 0.25)"
        ctx.font = "600 13px Manrope, system-ui, sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("·", px + cell / 2, py + cell / 2)
      } else {
        const [r, g, b] = colorFor(value, 0.45, "terrain")
        ctx.fillStyle = luminance([r, g, b]) > 150 ? "#15324d" : "#ffffff"
        ctx.font = `700 ${Math.max(10, Math.min(14, cell * 0.16))}px Manrope, system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(value.toFixed(2), px + cell / 2, py + cell / 2)
      }
    }
  }

  if (focus) {
    const focusIsTarget = arrowPhase && arrowPhase.added.some((item) => item.x === focus.x && item.y === focus.y)
    if (!focusIsTarget) {
      ctx.save()
      ctx.strokeStyle = "#0f4f2b"
      ctx.lineWidth = 3.5
      ctx.strokeRect(left + focus.x * cell + 1, top + focus.y * cell + 1, cell - 2, cell - 2)
      ctx.restore()
    }
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)"
  ctx.lineWidth = 1.2
  for (let i = 0; i <= size; i += 1) {
    ctx.beginPath()
    ctx.moveTo(left + i * cell, top)
    ctx.lineTo(left + i * cell, top + size * cell)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(left, top + i * cell)
    ctx.lineTo(left + size * cell, top + i * cell)
    ctx.stroke()
  }

  ctx.fillStyle = "#5a7087"
  ctx.font = "600 11px Manrope, system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (let i = 0; i < size; i += 1) {
    ctx.fillText(String(i), left + (i + 0.5) * cell, top - 10)
    ctx.fillText(String(i), left - 12, top + (i + 0.5) * cell)
  }
  ctx.restore()
}

function drawTutorialTerrain() {
  const resW = Math.max(160, Math.round(W / 2))
  const resH = Math.max(120, Math.round(H / 2))
  const image = ctx.createImageData(resW, resH)
  for (let py = 0; py < resH; py += 1) {
    for (let px = 0; px < resW; px += 1) {
      const value = sampleGrid(tutorialLandscape.grid, tutorialLandscape.size, px / (resW - 1), py / (resH - 1))
      const [r, g, b] = colorFor(value, 0.45, "terrain")
      const index = (py * resW + px) * 4
      image.data[index] = r
      image.data[index + 1] = g
      image.data[index + 2] = b
      image.data[index + 3] = 255
    }
  }
  const offscreen = document.createElement("canvas")
  offscreen.width = resW
  offscreen.height = resH
  offscreen.getContext("2d").putImageData(image, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(offscreen, 0, 0, W, H)
  ctx.restore()
}

function drawSmoothedTutorial() {
  const resW = Math.max(160, Math.round(W / 2))
  const resH = Math.max(120, Math.round(H / 2))
  const image = ctx.createImageData(resW, resH)
  for (let py = 0; py < resH; py += 1) {
    for (let px = 0; px < resW; px += 1) {
      const value = sampleGrid(tutorial.grid, TUTORIAL_SIZE, px / (resW - 1), py / (resH - 1))
      const shade = Math.round(value * 255)
      const index = (py * resW + px) * 4
      image.data[index] = shade
      image.data[index + 1] = shade
      image.data[index + 2] = shade
      image.data[index + 3] = 255
    }
  }
  const offscreen = document.createElement("canvas")
  offscreen.width = resW
  offscreen.height = resH
  offscreen.getContext("2d").putImageData(image, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(offscreen, 0, 0, W, H)
  ctx.fillStyle = "rgba(7, 17, 28, 0.72)"
  ctx.fillRect(12, 12, 190, 28)
  ctx.fillStyle = "#eaf3fd"
  ctx.font = "700 13px Manrope, system-ui, sans-serif"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText("сглаженные высоты", 22, 26)
  ctx.restore()
}

function drawSandboxAxes(inner) {
  const size = sandbox.size
  const ticks = 4
  ctx.save()
  ctx.strokeStyle = "rgba(23, 54, 88, 0.45)"
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(inner.x, inner.y + inner.height)
  ctx.lineTo(inner.x + inner.width, inner.y + inner.height)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(inner.x, inner.y)
  ctx.lineTo(inner.x, inner.y + inner.height)
  ctx.stroke()
  ctx.fillStyle = "#5a7087"
  ctx.font = "600 10px Manrope, system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  for (let i = 0; i <= ticks; i += 1) {
    const x = inner.x + (inner.width * i) / ticks
    const label = Math.round(((size - 1) * i) / ticks)
    ctx.beginPath()
    ctx.moveTo(x, inner.y + inner.height)
    ctx.lineTo(x, inner.y + inner.height + 4)
    ctx.stroke()
    ctx.fillText(String(label), x, inner.y + inner.height + 7)
  }
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  for (let i = 0; i <= ticks; i += 1) {
    const y = inner.y + inner.height - (inner.height * i) / ticks
    const label = Math.round(((size - 1) * i) / ticks)
    ctx.beginPath()
    ctx.moveTo(inner.x - 4, y)
    ctx.lineTo(inner.x, y)
    ctx.stroke()
    ctx.fillText(String(label), inner.x - 7, y)
  }
  ctx.textAlign = "left"
  ctx.fillStyle = "#43556c"
  ctx.font = "700 11px Manrope, system-ui, sans-serif"
  ctx.fillText("x", inner.x + inner.width + 6, inner.y + inner.height + 7)
  ctx.textAlign = "right"
  ctx.fillText("y", inner.x - 8, inner.y - 8)
  ctx.restore()
}

function drawSandboxMarker(cell, inner) {
  if (!cell) return
  const gridW = inner.width / (sandbox.size - 1)
  const gridH = inner.height / (sandbox.size - 1)
  const cx = inner.x + cell.x * gridW
  const cy = inner.y + cell.y * gridH
  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = "rgba(15, 79, 43, 0.4)"
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx, inner.y + inner.height)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(inner.x, cy)
  ctx.stroke()
  ctx.restore()

  const x0 = Math.max(inner.x, cx - gridW / 2)
  const y0 = Math.max(inner.y, cy - gridH / 2)
  const x1 = Math.min(inner.x + inner.width, cx + gridW / 2)
  const y1 = Math.min(inner.y + inner.height, cy + gridH / 2)
  ctx.save()
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)"
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  ctx.strokeStyle = "#0f4f2b"
  ctx.lineWidth = 2.5
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
  ctx.restore()

  const text = `x = ${cell.x} · y = ${cell.y} · h = ${cell.value.toFixed(3)}`
  ctx.save()
  ctx.font = "700 11px Manrope, system-ui, sans-serif"
  const width = ctx.measureText(text).width + 16
  let bx = cx + 12
  let by = cy - 32
  if (bx + width > inner.x + inner.width) bx = cx - width - 12
  if (by < inner.y) by = cy + 16
  ctx.fillStyle = "rgba(7, 17, 28, 0.82)"
  ctx.fillRect(bx, by, width, 24)
  ctx.fillStyle = "#eaf3fd"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(text, bx + 8, by + 12)
  ctx.restore()
}

function renderSandbox() {
  const margin = { left: 48, right: 16, top: 16, bottom: 38 }
  const inner = {
    x: margin.left,
    y: margin.top,
    width: W - margin.left - margin.right,
    height: H - margin.top - margin.bottom,
  }
  sandboxGeometry = { inner, size: sandbox.size }
  const resW = Math.max(180, Math.round(inner.width / 2))
  const resH = Math.max(120, Math.round(inner.height / 2))
  const image = ctx.createImageData(resW, resH)
  for (let py = 0; py < resH; py += 1) {
    for (let px = 0; px < resW; px += 1) {
      const value = sampleGrid(
        sandbox.grid,
        sandbox.size,
        px / (resW - 1),
        py / (resH - 1),
        params.smooth,
      )
      const [r, g, b] = colorFor(value, params.sea, params.palette)
      const index = (py * resW + px) * 4
      image.data[index] = r
      image.data[index + 1] = g
      image.data[index + 2] = b
      image.data[index + 3] = 255
    }
  }
  const offscreen = document.createElement("canvas")
  offscreen.width = resW
  offscreen.height = resH
  offscreen.getContext("2d").putImageData(image, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(offscreen, inner.x, inner.y, inner.width, inner.height)
  ctx.restore()

  if ((params.grid || !params.smooth) && sandbox.size <= 33) {
    ctx.save()
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)"
    ctx.lineWidth = 1
    const cells = sandbox.size - 1
    for (let i = 1; i < cells; i += 1) {
      const x = inner.x + (i / cells) * inner.width
      const y = inner.y + (i / cells) * inner.height
      ctx.beginPath()
      ctx.moveTo(x, inner.y)
      ctx.lineTo(x, inner.y + inner.height)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(inner.x, y)
      ctx.lineTo(inner.x + inner.width, y)
      ctx.stroke()
    }
    ctx.restore()
  }
  drawSandboxAxes(inner)
  drawSandboxMarker(sandboxHover || sandboxPinned, inner)
}

function drawBackground() {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = "#eef4fb"
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.strokeStyle = "rgba(36, 72, 112, 0.05)"
  ctx.lineWidth = 1
  for (let x = 40; x < W; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, H)
    ctx.stroke()
  }
  for (let y = 40; y < H; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(W, y + 0.5)
    ctx.stroke()
  }
  ctx.restore()
}

function draw() {
  if (!ctx || W === 0 || H === 0) return
  drawBackground()
  if (level === 2) {
    renderSandbox()
    return
  }
  const config = stepConfigs[step]
  if (config.terrain) {
    drawTutorialTerrain()
    return
  }
  if (config.smooth) {
    drawSmoothedTutorial()
    return
  }
  drawGrid(config, hoverCell || pinnedCell || defaultFocus)
}

function formulaForStep(index) {
  if (index === 0) return "h = random()"
  if (index === 1 || index === 2) return "h = (h₁ + h₂ + h₃ + h₄) / 4 + rand(−r, +r)"
  if (index === 3 || index === 4) return "h = (h₁ + … + hₙ) / n + rand(−r, +r)\nn = 3 на краю, 4 внутри"
  if (index === 5) return "h = (h₁ + h₂ + h₃ + h₄) / 4 + rand(−r, +r)\nшаг и r уменьшились вдвое"
  if (index === 6) return "h = (h₁ + … + hₙ) / n + rand(−r, +r)"
  if (index === 7) return "все высоты h(x, y) известны"
  if (index === 8) return "h(u,v) = (1−u)(1−v)·h₀₀ + u(1−v)·h₁₀ + (1−u)v·h₀₁ + uv·h₁₁"
  return "цвет = палитра(h, уровень воды)"
}

function describeCell(info) {
  const values = info.neighbors.map((item) => item.value.toFixed(2))
  const offset = `${info.offset >= 0 ? "+" : ""}${info.offset.toFixed(2)}`
  return `(${values.join(" + ")}) / ${info.neighbors.length} = ${info.average.toFixed(2)}; смещение ${offset}; h = ${info.value.toFixed(2)}.`
}

function defaultCalc(index) {
  if (index === 0) return "Углы заданы случайными числами. Остальные клетки пока пустые."
  if (index === 7) return "Все 25 высот известны. Теперь поле можно сгладить."
  if (index === 8) return "Высоты между центрами клеток интерполируются — резкие границы исчезают."
  if (index === 9) return "Низкие высоты — вода, затем песок, трава, камни и снег."
  return "Наведите на вычисленную клетку, чтобы увидеть расчёт."
}

function updateTutorialUi() {
  const config = stepConfigs[step]
  if (config.grid === undefined) {
    els.cellInfo.textContent = step === 8
      ? "Сглаживание — отдельный шаг после построения поля."
      : "Это пример раскраски высот на большой сетке."
    els.stepCalc.textContent = defaultCalc(step)
    return
  }
  const focus = hoverCell || pinnedCell || defaultFocus
  if (!focus) {
    els.cellInfo.textContent = "Наведите на значение в клетке — покажу её координаты и высоту."
    els.stepCalc.textContent = defaultCalc(step)
    return
  }
  const gridPhase = tutorial.phases[config.grid]
  const arrowPhase = config.arrows !== null ? tutorial.phases[config.arrows] : null
  const value = gridPhase.grid[focus.y][focus.x]
  const info = arrowPhase
    ? arrowPhase.added.find((item) => item.x === focus.x && item.y === focus.y)
    : null
  const valueText = value === null ? "клетка пока пустая" : `высота ${value.toFixed(2)}`
  const sourceText = info && info.neighbors.length
    ? ` · источники: ${info.neighbors.map((item) => `(${item.x},${item.y})`).join(", ")}`
    : ""
  els.cellInfo.textContent = `x = ${focus.x}, y = ${focus.y} · ${valueText}${sourceText}`
  els.stepCalc.textContent = info ? describeCell(info) : defaultCalc(step)
}

function setStep(next) {
  step = Math.max(0, Math.min(steps.length - 1, next))
  const current = steps[step]
  const config = stepConfigs[step]
  hoverCell = null
  pinnedCell = null
  if (config && config.arrows !== null && config.arrows !== undefined) {
    const first = tutorial.phases[config.arrows].added[0]
    defaultFocus = first ? { x: first.x, y: first.y } : null
  } else if (step === 0) {
    defaultFocus = { x: 0, y: 0 }
  } else {
    defaultFocus = null
  }
  els.stepKicker.textContent = `Шаг ${step + 1} из ${steps.length}`
  els.stepTitle.textContent = current.title
  els.stepText.textContent = current.text
  els.stepFormula.textContent = formulaForStep(step)
  updateTutorialUi()
  els.stepBack.disabled = step === 0
  els.stepNext.textContent = step === steps.length - 1 ? "В песочницу" : "Дальше"
  setHint("", "top")
  if (level === 1) draw()
}

function setHint(text, placement = "top") {
  hint.textContent = text
  hint.hidden = !text
  hint.classList.toggle("top", placement === "top")
}

function setLevel(next) {
  level = next
  tabs.forEach((tab) => tab.setAttribute("aria-selected", String(Number(tab.dataset.level) === level)))
  panels.forEach((panel) => {
    panel.hidden = Number(panel.id.replace("panel-", "")) !== level
  })
  if (level === 2) {
    readParams()
    updateStatus()
    sandboxHover = null
    sandboxPinned = null
    updateSandboxInfo()
    setHint("", "bottom")
    draw()
  } else {
    setStep(step)
  }
}

function readParams() {
  params.size = Number(els.size.value)
  params.roughness = Number(els.roughness.value)
  params.sea = Number(els.sea.value)
  params.palette = els.palette.value
  params.smooth = els.smooth.checked
  params.grid = els.grid.checked
}

function updateOutputs() {
  els.roughnessOutput.textContent = Number(els.roughness.value).toFixed(2)
  els.seaOutput.textContent = Number(els.sea.value).toFixed(2)
}

function updateStatus() {
  els.status.textContent = `Сетка ${params.size} × ${params.size} · сид ${params.seed}.`
}

function regenerate() {
  sandbox = generateDiamondSquare(params.size, params.roughness, params.seed)
  sandboxHover = null
  sandboxPinned = null
  updateSandboxInfo()
}

function syncControls() {
  els.size.value = String(params.size)
  els.roughness.value = String(params.roughness)
  els.sea.value = String(params.sea)
  els.palette.value = params.palette
  els.smooth.checked = params.smooth
  els.grid.checked = params.grid
  updateOutputs()
}

function scheduleRender() {
  if (renderQueued) return
  renderQueued = true
  requestAnimationFrame(() => {
    renderQueued = false
    if (level === 2) {
      readParams()
      updateStatus()
    }
    draw()
  })
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

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * (W / rect.width),
    y: (event.clientY - rect.top) * (H / rect.height),
  }
}

function tutorialCellAt(event) {
  if (!tutorialGeometry) return null
  const { left, top, cell, size } = tutorialGeometry
  const point = canvasPoint(event)
  const x = Math.floor((point.x - left) / cell)
  const y = Math.floor((point.y - top) / cell)
  if (x < 0 || y < 0 || x >= size || y >= size) return null
  return { x, y }
}

function sandboxCellAt(event) {
  if (!sandboxGeometry) return null
  const { inner, size } = sandboxGeometry
  const point = canvasPoint(event)
  if (point.x < inner.x || point.x > inner.x + inner.width || point.y < inner.y || point.y > inner.y + inner.height) {
    return null
  }
  const nx = (point.x - inner.x) / inner.width
  const ny = (point.y - inner.y) / inner.height
  const x = Math.max(0, Math.min(size - 1, Math.round(nx * (size - 1))))
  const y = Math.max(0, Math.min(size - 1, Math.round(ny * (size - 1))))
  return { x, y, value: sandbox.grid[y][x] }
}

function updateSandboxInfo() {
  const cell = sandboxHover || sandboxPinned
  els.sandboxCellInfo.textContent = cell
    ? `x = ${cell.x}, y = ${cell.y} · высота ${cell.value.toFixed(3)}`
    : "Наведите на рельеф — покажу координаты и высоту."
}

canvas.addEventListener("pointermove", (event) => {
  if (level === 1) {
    const config = stepConfigs[step]
    if (config.grid === undefined) return
    const cell = tutorialCellAt(event)
    if (!cell) return
    if (hoverCell && hoverCell.x === cell.x && hoverCell.y === cell.y) return
    hoverCell = cell
    updateTutorialUi()
    draw()
    return
  }
  const cell = sandboxCellAt(event)
  if (!cell) return
  if (sandboxHover && sandboxHover.x === cell.x && sandboxHover.y === cell.y) return
  sandboxHover = cell
  updateSandboxInfo()
  draw()
})

canvas.addEventListener("pointerleave", () => {
  if (level === 1) {
    hoverCell = null
    updateTutorialUi()
    draw()
    return
  }
  sandboxHover = null
  updateSandboxInfo()
  draw()
})

canvas.addEventListener("click", (event) => {
  if (level === 1) {
    const config = stepConfigs[step]
    if (config.grid === undefined) return
    const cell = tutorialCellAt(event)
    if (!cell) return
    if (pinnedCell && pinnedCell.x === cell.x && pinnedCell.y === cell.y) pinnedCell = null
    else pinnedCell = cell
    updateTutorialUi()
    draw()
    return
  }
  const cell = sandboxCellAt(event)
  if (!cell) return
  if (sandboxPinned && sandboxPinned.x === cell.x && sandboxPinned.y === cell.y) sandboxPinned = null
  else sandboxPinned = cell
  updateSandboxInfo()
  draw()
})

tabs.forEach((tab) => tab.addEventListener("click", () => setLevel(Number(tab.dataset.level))))
els.stepBack.addEventListener("click", () => setStep(step - 1))
els.stepNext.addEventListener("click", () => {
  if (step === steps.length - 1) setLevel(2)
  else setStep(step + 1)
})
els.stepReset.addEventListener("click", () => setStep(0))

els.size.addEventListener("change", () => {
  readParams()
  regenerate()
  updateStatus()
  draw()
})
els.roughness.addEventListener("input", () => {
  updateOutputs()
  readParams()
  regenerate()
  scheduleRender()
})
els.sea.addEventListener("input", () => {
  updateOutputs()
  readParams()
  scheduleRender()
})
els.palette.addEventListener("input", () => {
  readParams()
  scheduleRender()
})
els.smooth.addEventListener("change", () => {
  readParams()
  scheduleRender()
})
els.grid.addEventListener("change", () => {
  readParams()
  scheduleRender()
})
els.randomize.addEventListener("click", () => {
  params.seed = Math.floor(Math.random() * 100000)
  regenerate()
  updateStatus()
  draw()
})
els.reset.addEventListener("click", () => {
  Object.assign(params, DEFAULTS)
  regenerate()
  syncControls()
  updateStatus()
  draw()
})

syncControls()
regenerate()
setLevel(1)

const observer = new ResizeObserver(resize)
observer.observe(canvas)
window.addEventListener("resize", resize)
requestAnimationFrame(resize)
