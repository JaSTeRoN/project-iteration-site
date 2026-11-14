import { fade, fbm2, makePermutation } from "./noise.js"

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
    title: "В 2D: четыре угла",
    text: "В двумерном случае у точки четыре соседних узла. В каждом — свой градиент. Считаем четыре вклада и плавно смешиваем их сначала по горизонтали, потом по вертикали. Так получается значение шума в любой точке плоскости.",
  },
  {
    title: "Октавы: больше деталей",
    text: "Один слой шума даёт крупные формы. Чтобы добавить мелкие детали, складываем несколько слоёв с разным масштабом — октав. Слева один слой, справа четыре: берег и горы становятся сложнее.",
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

const terrainCanvas = document.createElement("canvas")
const terrainCtx = terrainCanvas.getContext("2d", { willReadFrequently: true })

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

function draw2DCell() {
  const size = Math.min(W * 0.58, H * 0.62)
  const left = (W - size) / 2
  const top = (H - size) / 2
  const gradients = [[1, 0.35], [-0.7, 0.85], [0.4, -1], [-0.55, -0.6]]
  const corners = [
    { x: left, y: top },
    { x: left + size, y: top },
    { x: left, y: top + size },
    { x: left + size, y: top + size },
  ]
  const point = { x: left + size * 0.62, y: top + size * 0.58 }

  ctx.save()
  ctx.fillStyle = "rgba(79, 142, 247, 0.08)"
  ctx.fillRect(left, top, size, size)
  ctx.strokeStyle = "rgba(23, 54, 88, 0.4)"
  ctx.lineWidth = 1.5
  ctx.strokeRect(left, top, size, size)
  ctx.restore()

  corners.forEach((corner, index) => {
    const [gx, gy] = gradients[index]
    const end = { x: corner.x + gx * 48, y: corner.y + gy * 48 }
    ctx.save()
    ctx.strokeStyle = "rgba(47, 93, 145, 0.9)"
    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.moveTo(corner.x, corner.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    const angle = Math.atan2(end.y - corner.y, end.x - corner.x)
    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(end.x - 9 * Math.cos(angle - 0.5), end.y - 9 * Math.sin(angle - 0.5))
    ctx.lineTo(end.x - 9 * Math.cos(angle + 0.5), end.y - 9 * Math.sin(angle + 0.5))
    ctx.closePath()
    ctx.fillStyle = "rgba(47, 93, 145, 0.9)"
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.setLineDash([4, 5])
    ctx.strokeStyle = "rgba(201, 106, 31, 0.55)"
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(corner.x, corner.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    ctx.restore()
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
  ctx.save()
  ctx.fillStyle = "#5a7087"
  ctx.font = "600 12px Manrope, system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("четыре соседних узла", W / 2, top - 14)
  ctx.restore()
}

function drawOctaves() {
  const gap = 8
  const half = (W - gap) / 2
  drawTerrain(0, 0, half, H, { ...DEFAULTS, octaves: 1 })
  drawTerrain(half + gap, 0, half, H, { ...DEFAULTS, octaves: 4 })
  ctx.save()
  ctx.fillStyle = "rgba(7, 17, 28, 0.72)"
  ctx.fillRect(10, 10, 96, 28)
  ctx.fillRect(half + gap + 10, 10, 108, 28)
  ctx.fillStyle = "#eaf3fd"
  ctx.font = "700 13px Manrope, system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("1 октава", 58, 29)
  ctx.fillText("4 октавы", half + gap + 64, 29)
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)"
  ctx.fillRect(half + gap / 2 - 1, 0, 2, H)
  ctx.restore()
}

function renderSandbox() {
  drawTerrain(0, 0, W, H, params)
}

function draw() {
  if (!ctx || W === 0 || H === 0) return
  drawBackground()
  if (level === 2) {
    renderSandbox()
    return
  }
  if (step === 0) drawStep0()
  else if (step <= 6) drawCellStep(step)
  else if (step === 7) drawStep7()
  else if (step === 8) draw2DCell()
  else drawOctaves()
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
  els.stepNext.textContent = step === steps.length - 1 ? "В песочницу" : "Дальше"
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
  if (level === 2) {
    readParams()
    updateOutputs()
    els.status.textContent = `Сид: ${params.seed}. Октав: ${params.octaves}.`
    setHint("Меняйте параметры — ландшафт пересчитывается", "bottom")
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
    if (level === 2) {
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
