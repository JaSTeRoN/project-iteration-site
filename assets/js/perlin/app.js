import { fade, fbm2, makePermutation, perlin2 } from "./noise.js"
import { accumulateLineField, fieldToShades, makeRandomLines } from "./line-noise.js"

const GRADIENTS = [0.95, -0.62, 0.48, -0.88, 0.36, 0.78]
const DEFAULTS = {
  seed: 37,
  scale: 4,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
  sea: 0.45,
  palette: "terrain",
}

const canvas = document.querySelector("#perlin-canvas")
const ctx = canvas.getContext("2d")
const hint = document.querySelector("#canvas-hint")
const tabs = [...document.querySelectorAll("[data-level]")]
const panels = [...document.querySelectorAll(".perlin-panel")]

const els = {
  stepKicker: document.querySelector("#step-kicker"),
  stepTitle: document.querySelector("#step-title"),
  stepText: document.querySelector("#step-text"),
  sampleField: document.querySelector("#sample-field"),
  sample: document.querySelector("#perlin-sample"),
  stepBack: document.querySelector("#step-back"),
  stepNext: document.querySelector("#step-next"),
  stepReset: document.querySelector("#step-reset"),
  scale: document.querySelector("#scale"),
  scaleOutput: document.querySelector("#scale-output"),
  octaves: document.querySelector("#octaves"),
  octavesOutput: document.querySelector("#octaves-output"),
  persistence: document.querySelector("#persistence"),
  persistenceOutput: document.querySelector("#persistence-output"),
  lacunarity: document.querySelector("#lacunarity"),
  lacunarityOutput: document.querySelector("#lacunarity-output"),
  sea: document.querySelector("#sea"),
  seaOutput: document.querySelector("#sea-output"),
  palette: document.querySelector("#palette"),
  randomize: document.querySelector("#randomize"),
  reset: document.querySelector("#reset"),
  status: document.querySelector("#sandbox-status"),
  linearTitle: document.querySelector("#linear-title"),
  linearText: document.querySelector("#linear-text"),
  linearFormula: document.querySelector("#linear-formula"),
  lineCountButtons: [...document.querySelectorAll("[data-line-count]")],
  linearNormalize: document.querySelector("#linear-normalize"),
  linearShowLine: document.querySelector("#linear-show-line"),
  linearPrev: document.querySelector("#linear-prev"),
  linearNext: document.querySelector("#linear-next"),
  linearStep: document.querySelector("#linear-step"),
  linearNew: document.querySelector("#linear-new"),
  linearToSandbox: document.querySelector("#linear-to-sandbox"),
  linearStatus: document.querySelector("#linear-status"),
}

const steps = [
  {
    title: "Рваный случайный шум",
    text: "Если брать случайное число в каждой точке, получается рваная кривая: соседние значения никак не связаны. Для гор, облаков и текстур нужен шум, у которого соседние значения переходят друг в друга плавно.",
  },
  {
    title: "Один отрезок между узлами",
    text: "Возьмём один отрезок между двумя узлами A и B и точку P внутри. Для левого узла смещение до P положительное, для правого — отрицательное: точка находится левее B. Эти два числа — dA и dB — показаны синей и красной стрелками.",
  },
  {
    title: "Наклоны в узлах",
    text: "В каждом узле задан случайный наклон — градиент. Это не высота, а направление и крутизна изменения шума рядом с узлом. Стрелка вверх означает, что вклад растёт, вниз — падает.",
  },
  {
    title: "Влияние левого градиента",
    text: "Считаем первый вклад: умножаем наклон gA на смещение dA. Если наклон и смещение направлены в одну сторону, вклад положительный; если в разные — отрицательный. На рисунке это синяя вертикальная полоска hA.",
  },
  {
    title: "Влияние правого градиента",
    text: "То же самое для правого узла: hB = gB × dB. Обрати внимание на знак dB: смещение к правому узлу отрицательное, поэтому знак вклада зависит и от наклона, и от того, с какой стороны находится точка.",
  },
  {
    title: "Смешиваем два влияния",
    text: "У нас есть два числа hA и hB. Нужно выбрать между ними. Вес t — это положение точки внутри отрезка: 0 у левого узла, 1 у правого. Линейное смешивание: h = hA·(1−t) + hB·t.",
  },
  {
    title: "Плавное смешивание",
    text: "Линейное смешивание даёт изломы в узлах. Перлин заменяет t на сглаженное значение w = fade(t). У концов отрезка w меняется медленно, поэтому кривая подходит к узлам плавно, без острых углов: h = hA·(1−w) + hB·w.",
  },
  {
    title: "Повторяем для всех отрезков",
    text: "Считаем значение в каждой точке отрезка и повторяем для всех остальных отрезков. На стыках соседние куски совпадают по значению и наклону, поэтому получается одна непрерывная плавная кривая.",
  },
  {
    title: "В 2D: клетка и четыре градиента",
    text: "В двумерном случае точка P попадает внутрь квадратной клетки. У клетки четыре угла: 00, 10, 01 и 11. В каждом углу задан свой двумерный градиент — стрелка. Дальше нужно учесть вклад всех четырёх углов.",
  },
  {
    title: "Четыре вклада",
    text: "От каждого угла проводим вектор к точке P и берём скалярное произведение с градиентом угла. Получаем четыре числа: n00, n10, n01 и n11. В 1D было два вклада, в 2D их четыре — по одному на каждый угол.",
  },
  {
    title: "Сначала смешиваем по горизонтали",
    text: "Сначала смешиваем пары по горизонтали. На верхней кромке смешиваем n00 и n10 с весом u — получаем top. На нижней кромке так же смешиваем n01 и n11 — получаем bottom. Вес u — горизонтальное положение точки внутри клетки.",
  },
  {
    title: "Потом смешиваем по вертикали",
    text: "Теперь смешиваем top и bottom по вертикали с весом v. Получаем одно число h — значение шума в точке P. В 2D смешивание идёт в два прохода: сначала по X, потом по Y.",
  },
  {
    title: "Повторяем для всей плоскости",
    text: "Каждая клетка сетки считается так же: четыре градиента, четыре вклада, два горизонтальных смешивания и одно вертикальное. В результате получается двумерное поле шума. В игре его раскрашивают как карту высот: синее — низко, зелёное — суша, белое — горы.",
  },
  {
    title: "Один слой шума",
    text: "Один слой шума — это крупные, плавные формы. Если взять только его, получится слишком гладко: в рельефе не будет мелких деталей — камней, трещин, небольших неровностей.",
  },
  {
    title: "Добавляем второй слой",
    text: "Добавим второй слой: та же сетка, но в два раза мельче (частота ×2) и в два раза слабее (амплитуда ×0.5). Складываем слои: крупная форма плюс мелкие детали. Справа видно, как сумма отличается от каждого слоя по отдельности.",
  },
  {
    title: "Больше октав",
    text: "Можно добавить 4, 6 и больше слоёв. Каждый следующий мельче и слабее. Настойчивость задаёт силу следующего слоя, лакунарность — во сколько раз он мельче. Чем больше октав, тем больше деталей; в песочнице это можно покрутить.",
  },
]

let W = 0
let H = 0
let dpr = 1
let level = 1
let step = 0
let sample = 0.35
let permutation = makePermutation(DEFAULTS.seed)
let permutationSeed = DEFAULTS.seed
let renderQueued = false

const params = { ...DEFAULTS }
const linear = { count: 10, seed: 37, normalize: true, showLine: true, lines: null, fields: new Map() }
const LINEAR_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 1000, 10000]

const terrainCanvas = document.createElement("canvas")
const terrainCtx = terrainCanvas.getContext("2d", { willReadFrequently: true })
const heightCanvas = document.createElement("canvas")
const heightCtx = heightCanvas.getContext("2d", { willReadFrequently: true })

function valueColor(value, sea, palette) {
  const v = Math.max(0, Math.min(1, value))
  if (palette === "gray") {
    const shade = Math.round(v * 255)
    return [shade, shade, shade]
  }
  if (palette === "heat") {
    if (v < 0.5) return mixColor([21, 45, 96], [83, 173, 201], v * 2)
    if (v < 0.78) return mixColor([83, 173, 201], [244, 213, 99], (v - 0.5) / 0.28)
    return mixColor([244, 213, 99], [186, 58, 43], (v - 0.78) / 0.22)
  }
  if (v < sea) {
    const depth = sea === 0 ? 0 : v / sea
    return mixColor([8, 32, 67], [55, 137, 186], depth)
  }
  if (v < sea + 0.03) return [214, 196, 147]
  if (v < sea + 0.18) return mixColor([154, 187, 119], [87, 141, 87], (v - sea - 0.03) / 0.15)
  if (v < sea + 0.33) return mixColor([87, 141, 87], [55, 104, 72], (v - sea - 0.18) / 0.15)
  if (v < sea + 0.46) return mixColor([112, 113, 107], [151, 151, 143], (v - sea - 0.33) / 0.13)
  return mixColor([225, 231, 233], [255, 255, 255], Math.min(1, (v - sea - 0.46) / 0.2))
}

function mixColor(from, to, t) {
  const amount = Math.max(0, Math.min(1, t))
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ]
}

function permutationFor(seed) {
  if (permutationSeed !== seed) {
    permutation = makePermutation(seed)
    permutationSeed = seed
  }
  return permutation
}

function drawTerrain(x, y, width, height, options) {
  const resW = Math.max(120, Math.round(width / 3))
  const resH = Math.max(80, Math.round(height / 3))
  terrainCanvas.width = resW
  terrainCanvas.height = resH
  const image = terrainCtx.createImageData(resW, resH)
  const perm = permutationFor(options.seed)
  for (let py = 0; py < resH; py += 1) {
    for (let px = 0; px < resW; px += 1) {
      const nx = (px / resW) * options.scale
      const ny = (py / resH) * options.scale
      const noise = fbm2(nx, ny, perm, options)
      const value = noise * 0.5 + 0.5
      const [r, g, b] = valueColor(value, options.sea, options.palette)
      const index = (py * resW + px) * 4
      image.data[index] = r
      image.data[index + 1] = g
      image.data[index + 2] = b
      image.data[index + 3] = 255
    }
  }
  terrainCtx.putImageData(image, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(terrainCanvas, x, y, width, height)
  ctx.restore()
}

function renderHeightPanel(x, y, width, height, valueAt, label) {
  const resW = Math.max(100, Math.round(width / 2))
  const resH = Math.max(80, Math.round(height / 2))
  heightCanvas.width = resW
  heightCanvas.height = resH
  const image = heightCtx.createImageData(resW, resH)
  for (let py = 0; py < resH; py += 1) {
    for (let px = 0; px < resW; px += 1) {
      const value = Math.max(0, Math.min(1, valueAt(px / resW, py / resH)))
      const shade = Math.round(value * 255)
      const index = (py * resW + px) * 4
      image.data[index] = shade
      image.data[index + 1] = shade
      image.data[index + 2] = shade
      image.data[index + 3] = 255
    }
  }
  heightCtx.putImageData(image, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(heightCanvas, x, y, width, height)
  ctx.strokeStyle = "rgba(23, 54, 88, 0.28)"
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1)
  if (label) {
    ctx.font = "700 11px Manrope, system-ui, sans-serif"
    const textWidth = ctx.measureText(label).width
    ctx.fillStyle = "rgba(7, 17, 28, 0.78)"
    ctx.fillRect(x + 8, y + 8, textWidth + 14, 24)
    ctx.fillStyle = "#eaf3fd"
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillText(label, x + 15, y + 20)
  }
  ctx.restore()
}

function drawBackground() {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = "#f1f7fe"
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.strokeStyle = "rgba(36, 72, 112, 0.06)"
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

function graphGeometry() {
  const padLeft = 48
  const padRight = 48
  const padTop = 34
  const padBottom = 44
  const plotWidth = W - padLeft - padRight
  const zeroY = H * 0.56
  return {
    padLeft,
    padRight,
    padTop,
    padBottom,
    plotWidth,
    zeroY,
    scaleX: plotWidth / 5,
    scaleY: Math.min(H * 0.55, (H - padTop - padBottom) * 0.42),
  }
}

function plotX(value, geometry) {
  return geometry.padLeft + value * geometry.scaleX
}

function plotY(value, geometry) {
  return geometry.zeroY - value * geometry.scaleY
}

function drawGraphAxes(geometry) {
  ctx.save()
  ctx.strokeStyle = "rgba(23, 54, 88, 0.35)"
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(geometry.padLeft, geometry.zeroY)
  ctx.lineTo(W - geometry.padRight, geometry.zeroY)
  ctx.stroke()
  ctx.fillStyle = "#5a7087"
  ctx.font = "600 12px Manrope, system-ui, sans-serif"
  ctx.textAlign = "center"
  for (let i = 0; i <= 5; i += 1) {
    const x = plotX(i, geometry)
    ctx.strokeStyle = "rgba(23, 54, 88, 0.14)"
    ctx.beginPath()
    ctx.moveTo(x, geometry.padTop)
    ctx.lineTo(x, H - geometry.padBottom)
    ctx.stroke()
    ctx.fillText(String(i), x, H - geometry.padBottom + 18)
  }
  ctx.fillStyle = "rgba(23, 54, 88, 0.55)"
  ctx.fillText("координата", W / 2, H - 10)
  ctx.restore()
}

function drawNode(x, geometry, gradient) {
  const px = plotX(x, geometry)
  ctx.save()
  ctx.beginPath()
  ctx.arc(px, geometry.zeroY, 4, 0, Math.PI * 2)
  ctx.fillStyle = "#24405f"
  ctx.fill()
  if (gradient !== undefined) {
    const dy = gradient * 34
    const from = { x: px - 17, y: geometry.zeroY + dy }
    const to = { x: px + 17, y: geometry.zeroY - dy }
    ctx.strokeStyle = "rgba(47, 93, 145, 0.95)"
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - 8 * Math.cos(angle - 0.5), to.y - 8 * Math.sin(angle - 0.5))
    ctx.lineTo(to.x - 8 * Math.cos(angle + 0.5), to.y - 8 * Math.sin(angle + 0.5))
    ctx.closePath()
    ctx.fillStyle = "rgba(47, 93, 145, 0.95)"
    ctx.fill()
  }
  ctx.restore()
}

function tutorialValue(x) {
  const cell = Math.min(4, Math.max(0, Math.floor(x)))
  const local = x - cell
  const left = GRADIENTS[cell] * local
  const right = GRADIENTS[cell + 1] * (local - 1)
  return { value: left + (right - left) * fade(local), left, right, cell, local }
}

function drawCurve(getValue, color, width, dash = []) {
  const geometry = graphGeometry()
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash(dash)
  ctx.beginPath()
  for (let index = 0; index <= 240; index += 1) {
    const x = (index / 240) * 4.999
    const y = plotY(getValue(x), geometry)
    if (index === 0) ctx.moveTo(plotX(x, geometry), y)
    else ctx.lineTo(plotX(x, geometry), y)
  }
  ctx.stroke()
  ctx.restore()
}

function drawSample(geometry, sampleX = sample) {
  const value = tutorialValue(sampleX).value
  const x = plotX(sampleX, geometry)
  const y = plotY(value, geometry)
  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = "rgba(23, 54, 88, 0.35)"
  ctx.beginPath()
  ctx.moveTo(x, geometry.zeroY)
  ctx.lineTo(x, y)
  ctx.stroke()
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, 6.5, 0, Math.PI * 2)
  ctx.fillStyle = "#c96a1f"
  ctx.fill()
  ctx.strokeStyle = "white"
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.restore()
}

function drawWhiteNoise(geometry) {
  const rng = makeRngLocal(17)
  const buckets = 58
  const values = Array.from({ length: buckets }, () => (rng() * 2 - 1) * 0.24)
  ctx.save()
  ctx.strokeStyle = "rgba(155, 91, 79, 0.9)"
  ctx.lineWidth = 2.2
  ctx.beginPath()
  values.forEach((value, index) => {
    const x = geometry.padLeft + ((index + 0.5) / buckets) * geometry.plotWidth
    const y = plotY(value, geometry)
    if (index === 0) ctx.moveTo(x, y)
    else {
      const previousX = geometry.padLeft + ((index - 0.5) / buckets) * geometry.plotWidth
      ctx.lineTo(previousX, y)
      ctx.lineTo(x, y)
    }
  })
  ctx.stroke()
  ctx.restore()
}

function makeRngLocal(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function drawStep0() {
  const geometry = graphGeometry()
  drawGraphAxes(geometry)
  drawWhiteNoise(geometry)
}

function drawArrow(from, to, color, width = 2.4) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - 9 * Math.cos(angle - 0.5), to.y - 9 * Math.sin(angle - 0.5))
  ctx.lineTo(to.x - 9 * Math.cos(angle + 0.5), to.y - 9 * Math.sin(angle + 0.5))
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

function drawText(text, x, y, color, align = "center", size = 12) {
  ctx.save()
  ctx.font = `700 ${size}px Manrope, system-ui, sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = "middle"
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)"
  ctx.lineWidth = 4
  ctx.strokeText(text, x, y)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}

function cellMetrics() {
  const left = W * 0.14
  const right = W * 0.86
  const zeroY = H * 0.42
  const pX = left + (right - left) * sample
  const gA = 1.1
  const gB = -1
  const dA = sample
  const dB = sample - 1
  const hA = gA * dA
  const hB = gB * dB
  const w = fade(sample)
  const h = hA + (hB - hA) * w
  const hLin = hA + (hB - hA) * sample
  const scaleY = Math.min(H * 0.26, 160)
  return { left, right, zeroY, pX, gA, gB, dA, dB, hA, hB, w, h, hLin, scaleY }
}

function drawCellBase(metrics, reveal) {
  const { left, right, zeroY, pX, t, gA, gB, dA, dB, hA, hB, w, h, scaleY } = metrics
  const valueY = (value) => zeroY - value * scaleY

  ctx.save()
  ctx.fillStyle = "rgba(79, 142, 247, 0.06)"
  ctx.fillRect(left, zeroY - scaleY * 1.25, right - left, scaleY * 2.5)
  ctx.strokeStyle = "rgba(23, 54, 88, 0.32)"
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(left - 18, zeroY)
  ctx.lineTo(right + 18, zeroY)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(left, zeroY, 6, 0, Math.PI * 2)
  ctx.arc(right, zeroY, 6, 0, Math.PI * 2)
  ctx.fillStyle = "#24405f"
  ctx.fill()
  ctx.restore()
  drawText("A", left, zeroY - 18, "#24405f")
  drawText("B", right, zeroY - 18, "#24405f")
  drawText("0", left, zeroY + 130, "#5a7087")
  drawText("1", right, zeroY + 130, "#5a7087")

  ctx.save()
  ctx.beginPath()
  ctx.arc(pX, zeroY, 7, 0, Math.PI * 2)
  ctx.fillStyle = "#c96a1f"
  ctx.fill()
  ctx.strokeStyle = "white"
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.restore()
  drawText("P", pX, zeroY - 18, "#c96a1f")

  if (reveal >= 1) {
    const distanceY = zeroY + 54
    drawArrow({ x: left, y: distanceY }, { x: pX, y: distanceY }, "rgba(79, 142, 247, 0.95)", 2.4)
    drawText(`dA = ${dA >= 0 ? "+" : ""}${dA.toFixed(2)}`, (left + pX) / 2, distanceY - 13, "rgba(47, 93, 145, 0.95)")
    const distanceY2 = zeroY + 82
    drawArrow({ x: right, y: distanceY2 }, { x: pX, y: distanceY2 }, "rgba(224, 122, 138, 0.95)", 2.4)
    drawText(`dB = ${dB.toFixed(2)}`, (right + pX) / 2, distanceY2 - 13, "rgba(190, 80, 98, 0.95)")
  }

  if (reveal >= 2) {
    drawArrow({ x: left, y: zeroY }, { x: left + 44, y: zeroY - gA * 44 }, "rgba(47, 93, 145, 0.95)")
    if (W >= 560) drawText(`gA = ${gA.toFixed(2)}`, left + 50, zeroY - gA * 44 - 12, "rgba(47, 93, 145, 0.95)", "left")
    drawArrow({ x: right, y: zeroY }, { x: right - 44, y: zeroY - gB * 44 }, "rgba(224, 122, 138, 0.95)")
    if (W >= 560) drawText(`gB = ${gB.toFixed(2)}`, right - 50, zeroY - gB * 44 - 12, "rgba(190, 80, 98, 0.95)", "right")
  }

  if (reveal >= 3) {
    ctx.save()
    ctx.strokeStyle = "rgba(47, 93, 145, 0.9)"
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(pX - 13, zeroY)
    ctx.lineTo(pX - 13, valueY(hA))
    ctx.stroke()
    ctx.restore()
    drawText(`hA = ${hA.toFixed(2)}`, pX - 20, valueY(hA) - 10, "rgba(47, 93, 145, 0.95)", "right")
  }

  if (reveal >= 4) {
    ctx.save()
    ctx.strokeStyle = "rgba(224, 122, 138, 0.9)"
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(pX + 13, zeroY)
    ctx.lineTo(pX + 13, valueY(hB))
    ctx.stroke()
    ctx.restore()
    drawText(`hB = ${hB.toFixed(2)}`, pX + 20, valueY(hB) - 10, "rgba(190, 80, 98, 0.95)", "left")
  }

  if (reveal >= 5) {
    const weightY = zeroY + 120
    ctx.save()
    ctx.strokeStyle = "rgba(23, 54, 88, 0.22)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(left, weightY)
    ctx.lineTo(right, weightY)
    ctx.stroke()
    ctx.restore()
    const tX = left + (right - left) * sample
    ctx.save()
    ctx.beginPath()
    ctx.arc(tX, weightY, 5, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(47, 93, 145, 0.95)"
    ctx.fill()
    ctx.restore()
    drawText(`t = ${sample.toFixed(2)}`, tX, weightY - 14, "rgba(47, 93, 145, 0.95)")
  }

  if (reveal >= 6) {
    const weightY = zeroY + 120
    const wX = left + (right - left) * w
    ctx.save()
    ctx.beginPath()
    ctx.arc(wX, weightY, 5, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(15, 79, 43, 0.95)"
    ctx.fill()
    ctx.restore()
    drawText(`w = ${w.toFixed(2)}`, wX, weightY + 14, "rgba(15, 79, 43, 0.95)")
  }
}

function drawCellCurves(metrics, reveal) {
  const { left, right, zeroY, scaleY } = metrics
  const valueY = (value) => zeroY - value * scaleY
  const curve = (smooth, color, width, dash) => {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.setLineDash(dash)
    ctx.beginPath()
    for (let index = 0; index <= 80; index += 1) {
      const t = index / 80
      const hA = metrics.gA * t
      const hB = metrics.gB * (t - 1)
      const h = hA + (hB - hA) * (smooth ? fade(t) : t)
      const x = left + (right - left) * t
      const y = valueY(h)
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.restore()
  }
  if (reveal >= 5) curve(false, "rgba(155, 91, 79, 0.85)", 2, [6, 5])
  if (reveal >= 6) curve(true, "rgba(15, 79, 43, 0.95)", 3, [])
}

function drawCellStep(reveal) {
  const metrics = cellMetrics()
  drawCellBase(metrics, reveal)
  drawCellCurves(metrics, reveal)
  if (reveal >= 5) {
    const valueY = (value) => metrics.zeroY - value * metrics.scaleY
    const shown = reveal >= 6 ? metrics.h : metrics.hLin
    const color = reveal >= 6 ? "rgba(15, 79, 43, 0.95)" : "rgba(155, 91, 79, 0.95)"
    ctx.save()
    ctx.beginPath()
    ctx.arc(metrics.pX, valueY(shown), 6.5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = "white"
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.restore()
    drawText(`h = ${shown.toFixed(2)}`, metrics.pX + 14, valueY(shown) - 12, color, "left")
  }

  if (reveal >= 6 && W >= 560) {
    const box = { x: W - 196, y: 18, width: 176, height: 104 }
    ctx.save()
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)"
    ctx.strokeStyle = "rgba(23, 54, 88, 0.18)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(box.x, box.y, box.width, box.height, 10)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(box.x + 30, box.y + box.height - 24)
    ctx.lineTo(box.x + box.width - 16, box.y + box.height - 24)
    ctx.strokeStyle = "rgba(23, 54, 88, 0.35)"
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(box.x + 30, box.y + box.height - 24)
    ctx.lineTo(box.x + 30, box.y + 18)
    ctx.stroke()
    ctx.beginPath()
    for (let index = 0; index <= 40; index += 1) {
      const t = index / 40
      const x = box.x + 30 + t * (box.width - 46)
      const y = box.y + box.height - 24 - fade(t) * (box.height - 46)
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = "rgba(15, 79, 43, 0.9)"
    ctx.lineWidth = 2
    ctx.stroke()
    const px = box.x + 30 + sample * (box.width - 46)
    const py = box.y + box.height - 24 - fade(sample) * (box.height - 46)
    ctx.beginPath()
    ctx.arc(px, py, 4, 0, Math.PI * 2)
    ctx.fillStyle = "#c96a1f"
    ctx.fill()
    ctx.fillStyle = "#5a7087"
    ctx.font = "600 11px Manrope, system-ui, sans-serif"
    ctx.textAlign = "left"
    ctx.fillText("fade(t)", box.x + 34, box.y + 16)
    ctx.restore()
  }

  if (reveal >= 6 && W >= 560) {
    drawText("плавно", W * 0.14 + 10, metrics.zeroY - metrics.scaleY * 1.18, "rgba(15, 79, 43, 0.9)", "left")
    drawText("линейно", W * 0.14 + 10, metrics.zeroY - metrics.scaleY * 1.18 + 18, "rgba(155, 91, 79, 0.9)", "left")
  }
}

function drawStep7() {
  const geometry = graphGeometry()
  drawGraphAxes(geometry)
  for (let i = 0; i <= 5; i += 1) drawNode(i, geometry)
  drawCurve((x) => tutorialValue(x).value, "rgba(15, 79, 43, 0.95)", 3)
  drawSample(geometry, sample * 4.999)
}

function draw2DCell(reveal) {
  const size = Math.min(W * 0.52, H * 0.58)
  const left = (W - size) / 2
  const top = (H - size) / 2 + 8
  const u = 0.62
  const v = 0.58
  const point = { x: left + size * u, y: top + size * v }
  const gradients = [
    { name: "00", g: [0.9, 0.4], color: "rgba(47, 93, 145, 0.92)" },
    { name: "10", g: [-0.7, 0.8], color: "rgba(224, 122, 138, 0.92)" },
    { name: "01", g: [0.6, -0.9], color: "rgba(155, 123, 212, 0.92)" },
    { name: "11", g: [-0.8, -0.4], color: "rgba(91, 192, 190, 0.92)" },
  ]
  const corners = [
    { x: left, y: top, dx: u, dy: v },
    { x: left + size, y: top, dx: u - 1, dy: v },
    { x: left, y: top + size, dx: u, dy: v - 1 },
    { x: left + size, y: top + size, dx: u - 1, dy: v - 1 },
  ]
  const dot = (gradient, dx, dy) => gradient[0] * dx + gradient[1] * dy
  const values = corners.map((corner, index) => dot(gradients[index].g, corner.dx, corner.dy))
  const [n00, n10, n01, n11] = values
  const topValue = n00 + (n10 - n00) * fade(u)
  const bottomValue = n01 + (n11 - n01) * fade(u)
  const result = topValue + (bottomValue - topValue) * fade(v)

  ctx.save()
  ctx.fillStyle = "rgba(79, 142, 247, 0.07)"
  ctx.fillRect(left, top, size, size)
  ctx.strokeStyle = "rgba(23, 54, 88, 0.38)"
  ctx.lineWidth = 1.5
  ctx.strokeRect(left, top, size, size)
  ctx.restore()

  corners.forEach((corner, index) => {
    const gradient = gradients[index]
    const end = { x: corner.x + gradient.g[0] * 42, y: corner.y + gradient.g[1] * 42 }
    drawArrow({ x: corner.x, y: corner.y }, end, gradient.color, 2.4)
    drawText(gradient.name, corner.x + (index % 2 === 0 ? -16 : 16), corner.y + (index < 2 ? -14 : 16), "rgba(23, 54, 88, 0.8)", index % 2 === 0 ? "right" : "left", 11)
  })

  ctx.save()
  ctx.beginPath()
  ctx.arc(point.x, point.y, 7, 0, Math.PI * 2)
  ctx.fillStyle = "#c96a1f"
  ctx.fill()
  ctx.strokeStyle = "white"
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.restore()
  drawText("P", point.x + 12, point.y - 12, "#c96a1f", "left")
  drawText(`u = ${u.toFixed(2)}`, left + size * u, top + size + 18, "#5a7087")
  drawText(`v = ${v.toFixed(2)}`, left - 18, top + size * v, "#5a7087", "right")

  if (reveal >= 1) {
    corners.forEach((corner, index) => {
      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = gradients[index].color
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(corner.x, corner.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
      ctx.restore()
    })
    drawText(`n00 = ${n00.toFixed(2)}`, left + 18, top + 18, gradients[0].color, "left", 11)
    drawText(`n10 = ${n10.toFixed(2)}`, left + size - 18, top + 18, gradients[1].color, "right", 11)
    drawText(`n01 = ${n01.toFixed(2)}`, left + 18, top + size - 18, gradients[2].color, "left", 11)
    drawText(`n11 = ${n11.toFixed(2)}`, left + size - 18, top + size - 18, gradients[3].color, "right", 11)
  }

  if (reveal >= 2) {
    const topPoint = { x: left + size * u, y: top }
    const bottomPoint = { x: left + size * u, y: top + size }
    ctx.save()
    ctx.setLineDash([5, 5])
    ctx.strokeStyle = "rgba(23, 54, 88, 0.4)"
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(topPoint.x, topPoint.y)
    ctx.lineTo(bottomPoint.x, bottomPoint.y)
    ctx.stroke()
    ctx.restore()
    for (const marker of [topPoint, bottomPoint]) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = "#24405f"
      ctx.fill()
      ctx.strokeStyle = "white"
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    }
    drawText(`top = ${topValue.toFixed(2)}`, topPoint.x - 10, topPoint.y + 14, "#24405f", "right")
    drawText(`bottom = ${bottomValue.toFixed(2)}`, bottomPoint.x - 10, bottomPoint.y - 14, "#24405f", "right")
  }

  if (reveal >= 3) {
    drawText(`h = ${result.toFixed(2)}`, point.x + 14, point.y + 18, "#0f4f2b", "left")
  }
}

function draw2DField() {
  const perm = makePermutation(37)
  const scale = 4
  renderHeightPanel(0, 0, W, H, (x, y) => 0.5 + 0.5 * perlin2(x * scale, y * scale, perm), "")
  ctx.save()
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)"
  ctx.lineWidth = 1.4
  for (let i = 1; i < scale; i += 1) {
    ctx.beginPath()
    ctx.moveTo((W / scale) * i, 0)
    ctx.lineTo((W / scale) * i, H)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, (H / scale) * i)
    ctx.lineTo(W, (H / scale) * i)
    ctx.stroke()
  }
  const cellW = W / scale
  const cellH = H / scale
  const cellX = cellW
  const cellY = cellH
  ctx.strokeStyle = "#c96a1f"
  ctx.lineWidth = 3
  ctx.strokeRect(cellX, cellY, cellW, cellH)
  ctx.restore()
  drawText("одна клетка", cellX + cellW / 2, cellY + 18, "#c96a1f", "center", 12)
}

function drawOctaveSingle() {
  const perm = makePermutation(37)
  renderHeightPanel(0, 0, W, H, (x, y) => 0.5 + 0.5 * perlin2(x * 3, y * 3, perm), "1 октава")
}

function drawOctaveLayers() {
  const perm = makePermutation(37)
  const gap = 8
  const panelW = (W - gap * 2) / 3
  const layer1 = (x, y) => 0.5 + 0.5 * perlin2(x * 3, y * 3, perm)
  const layer2 = (x, y) => 0.5 + 0.25 * perlin2(x * 6, y * 6, perm)
  const sum = (x, y) => {
    const first = 2 * (layer1(x, y) - 0.5)
    const second = 2 * (layer2(x, y) - 0.5)
    return 0.5 + 0.5 * (first + second) / 1.5
  }
  renderHeightPanel(0, 0, panelW, H, layer1, "слой 1")
  renderHeightPanel(panelW + gap, 0, panelW, H, layer2, "слой 2")
  renderHeightPanel(panelW * 2 + gap * 2, 0, panelW, H, sum, "сумма")
  drawText("+", panelW + gap / 2, H / 2, "rgba(23, 54, 88, 0.55)", "center", 22)
  drawText("=", panelW * 2 + gap * 1.5, H / 2, "rgba(23, 54, 88, 0.55)", "center", 22)
}

function drawOctaveMany() {
  const perm = makePermutation(37)
  const gap = 6
  const panelW = (W - gap * 3) / 4
  const counts = [1, 2, 4, 6]
  counts.forEach((octaves, index) => {
    const valueAt = (x, y) => 0.5 + 0.5 * fbm2(x * 3, y * 3, perm, { octaves, persistence: 0.5, lacunarity: 2 })
    renderHeightPanel(index * (panelW + gap), 0, panelW, H, valueAt, `${octaves} окт.`)
  })
}

const lineInfo = {
  10: {
    title: "10 случайных прямых",
    text: "Каждая прямая делит плоскость на две половины: одну заливаем белым, другую — чёрным. В каждой точке усредняем ответы всех прямых — так появляются первые серые оттенки.",
  },
  100: {
    title: "100 случайных прямых",
    text: "Прямых становится больше, области дробятся на более мелкие. Серых оттенков тоже больше: чёрное и белое всё сильнее смешиваются.",
  },
  1000: {
    title: "1 000 случайных прямых",
    text: "Тысяча прямых почти растворяет границы. Усреднение даёт плавное облако — уже похоже на шум, хотя каждая отдельная прямая всё ещё делит плоскость на чёрное и белое.",
  },
  10000: {
    title: "10 000 случайных прямых",
    text: "На десяти тысячах прямых поле становится гладким. Это и есть линейная имитация: много случайных «чёрное/белое», усреднённых в серые оттенки.",
  },
}

function formatCount(value) {
  return value.toLocaleString("ru-RU")
}

function plural(value, one, few, many) {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

function lineWord(value) {
  return plural(value, "линия", "линии", "линий")
}

function levelWord(value) {
  return plural(value, "уровень", "уровня", "уровней")
}

function lineTitle(value) {
  if (value === 0) return "0 случайных прямых"
  if (value === 1) return "1 случайная прямая"
  return `${formatCount(value)} ${plural(value, "случайная прямая", "случайные прямые", "случайных прямых")}`
}

function getLineInfo(count) {
  if (lineInfo[count]) return lineInfo[count]
  if (count === 0) {
    return {
      title: "0 случайных прямых",
      text: "Пока нет ни одной прямой. Поле ровно серое: будущие значения ещё не из чего складывать.",
    }
  }
  return {
    title: lineTitle(count),
    text: "Каждая новая прямая добавляет еще один слой «чёрное/белое». В каждой точке значения всех слоёв усредняются, поэтому число серых уровней растёт вместе с числом прямых.",
  }
}

function lineResolution(count) {
  if (count <= 10) return 360
  if (count <= 100) return 300
  if (count <= 1000) return 220
  return 160
}

function getLineField() {
  if (linear.count === 0) return null
  if (!linear.lines) linear.lines = makeRandomLines(10000, linear.seed)
  const key = `${linear.seed}:${linear.count}`
  if (linear.fields.has(key)) return linear.fields.get(key)
  const field = accumulateLineField(
    linear.lines.slice(0, linear.count),
    lineResolution(linear.count),
  )
  linear.fields.set(key, field)
  return field
}

function drawLastLine(line, left, top, side) {
  const points = []
  const add = (x, y) => {
    if (Math.abs(x) <= 1.0001 && Math.abs(y) <= 1.0001) {
      if (!points.some((point) => Math.abs(point.x - x) < 1e-9 && Math.abs(point.y - y) < 1e-9)) {
        points.push({ x, y })
      }
    }
  }
  if (Math.abs(line.ny) > 1e-8) {
    add(-1, (line.d + line.nx) / line.ny)
    add(1, (line.d - line.nx) / line.ny)
  }
  if (Math.abs(line.nx) > 1e-8) {
    add((line.d + line.ny) / line.nx, -1)
    add((line.d - line.ny) / line.nx, 1)
  }
  if (points.length < 2) return
  let first = points[0]
  let second = points[1]
  let best = -1
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)
      if (distance > best) {
        best = distance
        first = points[i]
        second = points[j]
      }
    }
  }
  const toCanvas = (point) => ({
    x: left + ((point.x + 1) / 2) * side,
    y: top + ((point.y + 1) / 2) * side,
  })
  const a = toCanvas(first)
  const b = toCanvas(second)
  ctx.save()
  ctx.strokeStyle = "rgba(255, 138, 61, 0.95)"
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()
}

function drawLinearLabel(left, top, text) {
  ctx.save()
  ctx.font = "700 12px Manrope, system-ui, sans-serif"
  const width = ctx.measureText(text).width + 20
  ctx.fillStyle = "rgba(7, 17, 28, 0.75)"
  ctx.fillRect(left + 10, top + 10, width, 26)
  ctx.fillStyle = "#eaf3fd"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(text, left + 20, top + 23)
  ctx.restore()
}

function renderLinear() {
  const side = Math.min(W * 0.84, H * 0.84)
  const left = (W - side) / 2
  const top = (H - side) / 2
  const field = getLineField()
  if (!field) {
    ctx.save()
    ctx.fillStyle = "#808080"
    ctx.fillRect(left, top, side, side)
    ctx.restore()
    drawLinearLabel(left, top, "0 линий")
    return
  }
  const shades = fieldToShades(field, linear.normalize)
  const image = ctx.createImageData(field.resolution, field.resolution)
  for (let i = 0; i < shades.length; i += 1) {
    const index = i * 4
    const shade = shades[i]
    image.data[index] = shade
    image.data[index + 1] = shade
    image.data[index + 2] = shade
    image.data[index + 3] = 255
  }
  const offscreen = document.createElement("canvas")
  offscreen.width = field.resolution
  offscreen.height = field.resolution
  offscreen.getContext("2d").putImageData(image, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(offscreen, left, top, side, side)
  ctx.restore()
  if (linear.showLine && linear.lines && linear.count > 0) {
    drawLastLine(linear.lines[linear.count - 1], left, top, side)
  }
  drawLinearLabel(left, top, `${formatCount(linear.count)} ${lineWord(linear.count)}`)
}

function updateLinearUi() {
  const info = getLineInfo(linear.count)
  els.linearTitle.textContent = info.title
  els.linearText.textContent = info.text
  els.linearFormula.textContent = "value(p) = (1/N) · Σ [nᵢ · p > dᵢ]\n[условие] = 1 или 0"
  els.lineCountButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.lineCount) === linear.count))
  })
  const stepIndex = LINEAR_STEPS.indexOf(linear.count)
  const safeIndex = Math.max(0, stepIndex)
  els.linearStep.textContent = `Шаг ${safeIndex + 1}/${LINEAR_STEPS.length} · ${formatCount(linear.count)} ${lineWord(linear.count)}`
  els.linearPrev.disabled = safeIndex <= 0
  els.linearNext.disabled = safeIndex >= LINEAR_STEPS.length - 1
  els.linearNormalize.checked = linear.normalize
  els.linearShowLine.checked = linear.showLine
  els.linearStatus.textContent = `${formatCount(linear.count)} ${lineWord(linear.count)} · ${formatCount(linear.count + 1)} ${levelWord(linear.count + 1)} · сид ${linear.seed}.`
}

function renderSandbox() {
  drawTerrain(0, 0, W, H, params)
}

function draw() {
  if (!ctx || W === 0 || H === 0) return
  drawBackground()
  if (level === 3) {
    renderSandbox()
    return
  }
  if (level === 2) {
    renderLinear()
    return
  }
  if (step === 0) drawStep0()
  else if (step <= 6) drawCellStep(step)
  else if (step === 7) drawStep7()
  else if (step === 8) draw2DCell(0)
  else if (step === 9) draw2DCell(1)
  else if (step === 10) draw2DCell(2)
  else if (step === 11) draw2DCell(3)
  else if (step === 12) draw2DField()
  else if (step === 13) drawOctaveSingle()
  else if (step === 14) drawOctaveLayers()
  else drawOctaveMany()
}

function updateSampleVisibility() {
  els.sampleField.hidden = !(step >= 1 && step <= 7)
}

function setHint(text, placement = "top") {
  hint.textContent = text
  hint.hidden = !text
  hint.classList.toggle("top", placement === "top")
}

function setStep(next) {
  step = Math.max(0, Math.min(steps.length - 1, next))
  const current = steps[step]
  els.stepKicker.textContent = `Шаг ${step + 1} из ${steps.length}`
  els.stepTitle.textContent = current.title
  els.stepText.textContent = current.text
  els.stepBack.disabled = step === 0
  els.stepNext.textContent = step === steps.length - 1 ? "К линейной имитации" : "Дальше"
  updateSampleVisibility()
  if (step >= 1 && step <= 7) {
    setHint(step === 7 ? "Двигайте ползунок — точка движется по графику" : "Двигайте ползунок — точка P движется внутри отрезка", "top")
  } else {
    setHint("", "top")
  }
  if (level === 1) draw()
}

function updateOutputs() {
  els.scaleOutput.textContent = Number(els.scale.value).toFixed(1)
  els.octavesOutput.textContent = String(els.octaves.value)
  els.persistenceOutput.textContent = Number(els.persistence.value).toFixed(2)
  els.lacunarityOutput.textContent = Number(els.lacunarity.value).toFixed(1)
  els.seaOutput.textContent = Number(els.sea.value).toFixed(2)
}

function readParams() {
  params.scale = Number(els.scale.value)
  params.octaves = Number(els.octaves.value)
  params.persistence = Number(els.persistence.value)
  params.lacunarity = Number(els.lacunarity.value)
  params.sea = Number(els.sea.value)
  params.palette = els.palette.value
}

function syncSandbox() {
  els.scale.value = String(params.scale)
  els.octaves.value = String(params.octaves)
  els.persistence.value = String(params.persistence)
  els.lacunarity.value = String(params.lacunarity)
  els.sea.value = String(params.sea)
  els.palette.value = params.palette
  updateOutputs()
}

function setLevel(next) {
  level = next
  tabs.forEach((tab) => tab.setAttribute("aria-selected", String(Number(tab.dataset.level) === level)))
  panels.forEach((panel) => {
    panel.hidden = Number(panel.id.replace("panel-", "")) !== level
  })
  if (level === 3) {
    readParams()
    updateOutputs()
    els.status.textContent = `Сид: ${params.seed}. Октав: ${params.octaves}.`
    setHint("Меняйте параметры — ландшафт пересчитывается", "bottom")
    draw()
  } else if (level === 2) {
    updateLinearUi()
    setHint("", "top")
    draw()
  } else {
    setStep(step)
  }
}

function scheduleRender() {
  if (renderQueued) return
  renderQueued = true
  requestAnimationFrame(() => {
    renderQueued = false
    if (level === 3) {
      readParams()
      els.status.textContent = `Сид: ${params.seed}. Октав: ${params.octaves}.`
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

els.lineCountButtons.forEach((button) => {
  button.addEventListener("click", () => {
    linear.count = Number(button.dataset.lineCount)
    updateLinearUi()
    if (level === 2) draw()
  })
})
els.linearNormalize.addEventListener("change", () => {
  linear.normalize = els.linearNormalize.checked
  if (level === 2) draw()
})
els.linearShowLine.addEventListener("change", () => {
  linear.showLine = els.linearShowLine.checked
  if (level === 2) draw()
})
els.linearPrev.addEventListener("click", () => {
  const index = Math.max(0, LINEAR_STEPS.indexOf(linear.count))
  linear.count = LINEAR_STEPS[Math.max(0, index - 1)]
  updateLinearUi()
  if (level === 2) draw()
})
els.linearNext.addEventListener("click", () => {
  const index = Math.max(0, LINEAR_STEPS.indexOf(linear.count))
  linear.count = LINEAR_STEPS[Math.min(LINEAR_STEPS.length - 1, index + 1)]
  updateLinearUi()
  if (level === 2) draw()
})
els.linearNew.addEventListener("click", () => {
  linear.seed = Math.floor(Math.random() * 100000)
  linear.lines = null
  linear.fields.clear()
  updateLinearUi()
  if (level === 2) draw()
})
els.linearToSandbox.addEventListener("click", () => setLevel(3))

els.stepBack.addEventListener("click", () => setStep(step - 1))
els.stepNext.addEventListener("click", () => {
  if (step === steps.length - 1) setLevel(2)
  else setStep(step + 1)
})
els.stepReset.addEventListener("click", () => {
  sample = 0.35
  els.sample.value = "350"
  setStep(0)
})
els.sample.addEventListener("input", () => {
  sample = Number(els.sample.value) / 1000
  if (level === 1) draw()
})

for (const input of [els.scale, els.octaves, els.persistence, els.lacunarity, els.sea, els.palette]) {
  input.addEventListener("input", () => {
    updateOutputs()
    scheduleRender()
  })
}

els.randomize.addEventListener("click", () => {
  params.seed = Math.floor(Math.random() * 100000)
  permutationSeed = -1
  scheduleRender()
})
els.reset.addEventListener("click", () => {
  Object.assign(params, DEFAULTS)
  permutationSeed = -1
  syncSandbox()
  els.status.textContent = `Сид: ${params.seed}. Октав: ${params.octaves}.`
  draw()
})

syncSandbox()
setLevel(1)

const observer = new ResizeObserver(resize)
observer.observe(canvas)
window.addEventListener("resize", resize)
requestAnimationFrame(resize)
