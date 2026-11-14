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
  stepCalc: document.querySelector("#step-calc"),
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

const steps = [
  {
    title: "Сетка 5 × 5",
    text: "Diamond-Square работает на квадратной сетке размером 2ⁿ + 1. Для примера возьмём 5 × 5: сначала известны только четыре угла, остальные высоты нужно вычислить.",
  },
  {
    title: "Diamond-шаг",
    text: "Находим центр большого квадрата. Его высота — среднее четырёх углов плюс случайное смещение. На первом уровне квадрат один, поэтому появляется одна новая точка.",
  },
  {
    title: "Square-шаг",
    text: "Теперь заполняем середины сторон. У внутренней точки четыре соседа, у точки на краю — только три; берём среднее доступных и добавляем случайное смещение. После этого шага заполнены все середины рёбер большого квадрата.",
  },
  {
    title: "Следующий уровень",
    text: "Большой квадрат разбился на четыре маленьких. Для каждого снова выполняем diamond-шаг: находим центр, усредняем четыре угла и добавляем смещение. Шаг сетки уменьшился вдвое, поэтому и случайное смещение стало меньше.",
  },
  {
    title: "Последний square-шаг",
    text: "Осталось заполнить середины сторон у маленьких ромбов. Снова усредняем соседей и добавляем небольшое случайное смещение. После этого все 25 высот известны.",
  },
  {
    title: "Все высоты заполнены",
    text: "Мы получили карту высот 5 × 5. В настоящей сетке 33 × 33 или 65 × 65 те же два шага повторяются, пока не будут заполнены все клетки.",
  },
  {
    title: "Превращаем высоты в рельеф",
    text: "Высоты можно раскрасить: низкие значения — вода, выше — песок, трава, камни и снег. На рисунке — та же раскраска для сетки 33 × 33, как в песочнице.",
  },
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

function drawGrid(phase, highlight = true) {
  const size = TUTORIAL_SIZE
  const cell = Math.min((W * 0.72) / size, (H * 0.78) / size)
  const left = (W - cell * size) / 2
  const top = (H - cell * size) / 2
  const added = new Map()
  if (highlight) {
    for (const item of phase.added) added.set(`${item.x}:${item.y}`, item)
  }

  ctx.save()
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = phase.grid[y][x]
      const px = left + x * cell
      const py = top + y * cell
      if (value === null) {
        ctx.fillStyle = "rgba(23, 54, 88, 0.04)"
        ctx.fillRect(px, py, cell, cell)
        ctx.fillStyle = "rgba(23, 54, 88, 0.25)"
        ctx.font = "600 13px Manrope, system-ui, sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("·", px + cell / 2, py + cell / 2)
      } else {
        const [r, g, b] = colorFor(value, 0.45, "terrain")
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.fillRect(px, py, cell, cell)
        ctx.fillStyle = luminance([r, g, b]) > 150 ? "#15324d" : "#ffffff"
        ctx.font = `700 ${Math.max(10, Math.min(14, cell * 0.16))}px Manrope, system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(value.toFixed(2), px + cell / 2, py + cell / 2)
      }
      if (added.has(`${x}:${y}`)) {
        ctx.strokeStyle = "#ff8a3d"
        ctx.lineWidth = 3
        ctx.strokeRect(px + 2, py + 2, cell - 4, cell - 4)
      }
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

function renderSandbox() {
  const resW = Math.max(180, Math.round(W / 2))
  const resH = Math.max(120, Math.round(H / 2))
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
  ctx.drawImage(offscreen, 0, 0, W, H)
  if ((params.grid || !params.smooth) && sandbox.size <= 33) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)"
    ctx.lineWidth = 1
    const cells = sandbox.size - 1
    for (let i = 1; i < cells; i += 1) {
      const x = (i / cells) * W
      const y = (i / cells) * H
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
  }
  ctx.restore()
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
  if (step === 6) {
    drawTutorialTerrain()
    return
  }
  const phase = tutorial.phases[step === 5 ? 4 : step]
  drawGrid(phase, step !== 5)
}

function calcText(phase) {
  if (!phase.added.length) return "Углы заданы случайными числами. Остальные клетки пока пустые."
  const cell = phase.added[0]
  const neighborValues = cell.neighbors.map((item) => item.value.toFixed(2))
  const average = (cell.average).toFixed(2)
  const offset = `${cell.offset >= 0 ? "+" : ""}${cell.offset.toFixed(2)}`
  const kind = phase.kind === "diamond" ? "среднее четырёх углов" : `среднее ${cell.neighbors.length} соседей`
  return `${kind}: (${neighborValues.join(" + ")}) / ${cell.neighbors.length} = ${average}. Случайное смещение: ${offset}. Новая высота: ${cell.value.toFixed(2)}.`
}

function setStep(next) {
  step = Math.max(0, Math.min(steps.length - 1, next))
  const current = steps[step]
  els.stepKicker.textContent = `Шаг ${step + 1} из ${steps.length}`
  els.stepTitle.textContent = current.title
  els.stepText.textContent = current.text
  if (step === 0) {
    els.stepCalc.textContent = "Углы заданы случайными числами. Остальные клетки пока пустые."
  } else if (step === 5) {
    els.stepCalc.textContent = "Все 25 высот известны. В большой сетке шаги повторяются до полного заполнения."
  } else if (step === 6) {
    els.stepCalc.textContent = "Низкие высоты — вода, затем песок, трава, камни и снег."
  } else {
    els.stepCalc.textContent = calcText(tutorial.phases[step])
  }
  els.stepBack.disabled = step === 0
  els.stepNext.textContent = step === steps.length - 1 ? "В песочницу" : "Дальше"
  setHint(step === 6 ? "Карта высот превратилась в рельеф" : "", "top")
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
    setHint("Меняйте размер, шероховатость и уровень воды", "bottom")
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
