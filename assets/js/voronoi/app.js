import {
  bisectorSegment,
  delaunayEdges,
  nearestIndex,
  polygonArea,
  polygonCentroid,
  voronoiCells,
} from "./geometry.js"
import { makeRng } from "../rng.js"

const COLORS = ["#4f8ef7", "#f2a65a", "#7bc47f", "#e07a8a", "#9b7bd4", "#5bc0be", "#e0c14f", "#8d9db6"]
const SEED_COLOR = "#123a63"
const CENTROID_COLOR = "#c96a1f"
const SELECTED_COLOR = "#0f4f2b"
const MAX_POINTS = 50
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches

const canvas = document.querySelector("#voronoi-canvas")
const ctx = canvas.getContext("2d")
const hint = document.querySelector("#canvas-hint")
const tabs = [...document.querySelectorAll("[data-level]")]
const panels = [...document.querySelectorAll(".voronoi-panel")]

const els = {
  stepKicker: document.querySelector("#step-kicker"),
  stepTitle: document.querySelector("#step-title"),
  stepText: document.querySelector("#step-text"),
  stepBack: document.querySelector("#step-back"),
  stepNext: document.querySelector("#step-next"),
  stepReset: document.querySelector("#step-reset"),
  lloydIter: document.querySelector("#lloyd-iter"),
  lloydSpread: document.querySelector("#lloyd-spread"),
  lloydStep: document.querySelector("#lloyd-step"),
  lloydAuto: document.querySelector("#lloyd-auto"),
  lloydReset: document.querySelector("#lloyd-reset"),
  lloydText2: document.querySelector("#lloyd-text-2"),
  lloydCount: document.querySelector("#lloyd-count"),
  lloydCountOutput: document.querySelector("#lloyd-count-output"),
  lloydRandom: document.querySelector("#lloyd-random"),
  lloydStatus: document.querySelector("#lloyd-status"),
  countRange: document.querySelector("#count-range"),
  countOutput: document.querySelector("#count-output"),
  randomize: document.querySelector("#randomize"),
  addPoints: document.querySelector("#add-points"),
  removePoint: document.querySelector("#remove-point"),
  lloydStep3: document.querySelector("#lloyd-step-3"),
  palette: document.querySelector("#palette"),
  showSeeds: document.querySelector("#show-seeds"),
  showBoundaries: document.querySelector("#show-boundaries"),
  showCentroids: document.querySelector("#show-centroids"),
  fillOpacity: document.querySelector("#fill-opacity"),
  sandboxReset: document.querySelector("#sandbox-reset"),
  sandboxStatus: document.querySelector("#sandbox-status"),
  sandboxIter: document.querySelector("#sandbox-iter"),
}

const steps = [
  {
    title: "Семь точек",
    text: "На плоскости семь точек — A, B, C, D, E, F, G. Каждая точка станет центром своей ячейки. Сначала определим, какие точки являются соседями.",
  },
  {
    title: "Соединяем соседние точки",
    text: "Соседние точки соединяем отрезками. Получается триангуляция Делоне: она соединяет именно те пары точек, у которых в диаграмме Вороного будет общая граница. Это скелет построения.",
  },
  {
    title: "Серединные перпендикуляры",
    text: "У каждого отрезка отметим середину и восстановим перпендикуляр к нему. Такой перпендикуляр — множество точек, равноудалённых от концов отрезка. Пока нарисуем только короткие штрихи.",
  },
  {
    title: "Продлеваем перпендикуляры",
    text: "Продлим каждый серединный перпендикуляр до пересечения с другими. Пока это только вспомогательные прямые: границ ячеек ещё нет, мы только готовим материал для них.",
  },
  {
    title: "Находим пересечения",
    text: "Там, где перпендикуляры пересекаются, появляются вершины будущих ячеек. Отметим их оранжевыми точками. Это ещё не границы — только узлы, из которых будут собраны ячейки.",
  },
  {
    title: "Выбираем участки для границ",
    text: "Не каждый кусок перпендикуляра нужен. Оставляем только те участки, которые действительно ограничивают ячейки: между двумя вершинами или от вершины до края рисунка. Выделим их оранжевым пунктиром — это ещё не финальные границы, а выбранные заготовки.",
  },
  {
    title: "Рисуем границы ячеек",
    text: "Теперь по выбранным участкам проводим настоящие границы. Они замыкаются в многоугольники вокруг каждой точки — это уже контуры ячеек.",
  },
  {
    title: "Заливаем ячейки",
    text: "Каждый замкнутый многоугольник — ячейка. Закрасим их, чтобы было видно, какая область соответствует какой точке.",
  },
  {
    title: "Диаграмма Вороного",
    text: "Готово: плоскость разбита на ячейки. Ячейка каждой точки — это область, все точки которой ближе к ней, чем к любой другой. Наведите курсор или коснитесь плоскости: подсветится ячейка ближайшей точки.",
  },
]

let W = 0
let H = 0
let dpr = 1
let initialized = false
let level = 1
let hover = null
let dragging = false
let busy = false
let autoTimer = null
let animationFrame = 0

const l1 = { points: [], step: 0 }
const l2 = { points: [], startPoints: [], iter: 0, auto: false }
const l3 = { points: [], selected: -1, addMode: false, iter: 0, busy: false }

function relativePoints(list, colors = COLORS) {
  return list.map((point, index) => ({
    x: point.x * W,
    y: point.y * H,
    color: colors[index % colors.length],
    label: point.label,
  }))
}

function randomPoints(count, seed) {
  const rng = makeRng(seed)
  return Array.from({ length: count }, (_, index) => ({
    x: (0.08 + rng() * 0.84) * W,
    y: (0.08 + rng() * 0.84) * H,
    color: COLORS[index % COLORS.length],
  }))
}

function initLevels() {
  l1.points = relativePoints([
    { x: 0.47, y: 0.47, label: "A" },
    { x: 0.57, y: 0.13, label: "B" },
    { x: 0.82, y: 0.29, label: "C" },
    { x: 0.78, y: 0.62, label: "D" },
    { x: 0.63, y: 0.84, label: "E" },
    { x: 0.31, y: 0.86, label: "F" },
    { x: 0.18, y: 0.32, label: "G" },
  ])
  l2.points = randomPoints(9, 37)
  l2.startPoints = clonePoints(l2.points)
  l3.points = randomPoints(12, 11)
  initialized = true
}

function clonePoints(points) {
  return points.map((point) => ({ ...point }))
}

function scalePoints(points, sx, sy) {
  for (const point of points) {
    point.x *= sx
    point.y *= sy
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect()
  if (rect.width < 10 || rect.height < 10) return
  const nextW = Math.round(rect.width)
  const nextH = Math.round(rect.height)
  const sx = W ? nextW / W : 1
  const sy = H ? nextH / H : 1
  W = nextW
  H = nextH
  dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (!initialized) {
    initLevels()
  } else if (sx !== 1 || sy !== 1) {
    scalePoints(l1.points, sx, sy)
    scalePoints(l2.points, sx, sy)
    scalePoints(l2.startPoints, sx, sy)
    scalePoints(l3.points, sx, sy)
  }
  draw()
}

function currentPoints() {
  if (level === 1) return l1.points
  if (level === 2) return l2.points
  return l3.points
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "")
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawGrid() {
  ctx.save()
  ctx.strokeStyle = "rgba(36, 72, 112, 0.07)"
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

function pathCell(polygon) {
  ctx.beginPath()
  polygon.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
  ctx.closePath()
}

function fillCell(polygon, color, alpha) {
  if (polygon.length < 3) return
  pathCell(polygon)
  ctx.fillStyle = hexToRgba(color, alpha)
  ctx.fill()
}

function strokeCell(polygon, color, width) {
  if (polygon.length < 3) return
  pathCell(polygon)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

function isOuterEdge(a, b) {
  const edge = 1.2
  return (a.x <= edge && b.x <= edge)
    || (a.x >= W - edge && b.x >= W - edge)
    || (a.y <= edge && b.y <= edge)
    || (a.y >= H - edge && b.y >= H - edge)
}

function cellEdgeKey(a, b) {
  const first = `${Math.round(a.x * 2)}:${Math.round(a.y * 2)}`
  const second = `${Math.round(b.x * 2)}:${Math.round(b.y * 2)}`
  return first < second ? `${first}|${second}` : `${second}|${first}`
}

function uniqueCellEdges(cells, skipOuter = false) {
  const edges = new Map()
  for (const cell of cells) {
    for (let i = 0; i < cell.length; i += 1) {
      const a = cell[i]
      const b = cell[(i + 1) % cell.length]
      if (skipOuter && isOuterEdge(a, b)) continue
      const key = cellEdgeKey(a, b)
      if (!edges.has(key)) edges.set(key, [a, b])
    }
  }
  return [...edges.values()]
}

function strokeCellEdges(cells, color, width, dash = [], skipOuter = false) {
  for (const [a, b] of uniqueCellEdges(cells, skipOuter)) {
    drawLine(a, b, color, width, dash)
  }
}

function drawCells(cells, points, alpha, boundaries = true) {
  cells.forEach((cell, index) => fillCell(cell, points[index]?.color || COLORS[index % COLORS.length], alpha))
  if (boundaries) {
    cells.forEach((cell) => strokeCell(cell, "rgba(255, 255, 255, 0.82)", 2.4))
    cells.forEach((cell) => strokeCell(cell, "rgba(23, 54, 88, 0.16)", 0.8))
  }
}

function drawLine(a, b, color, width, dash = []) {
  ctx.save()
  ctx.beginPath()
  ctx.setLineDash(dash)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()
}

function drawSeed(point, index, withLabel = false) {
  const radius = withLabel ? 13 : 8
  ctx.save()
  ctx.beginPath()
  ctx.arc(point.x, point.y, radius + 2, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = point.color || SEED_COLOR
  ctx.fill()
  ctx.strokeStyle = "rgba(15, 40, 65, 0.35)"
  ctx.lineWidth = 1
  ctx.stroke()
  if (withLabel) {
    ctx.fillStyle = "#ffffff"
    ctx.font = "700 14px Manrope, system-ui, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(point.label || String(index + 1), point.x, point.y + 0.5)
  }
  ctx.restore()
}

function drawCentroids(cells, points) {
  cells.forEach((cell, index) => {
    const centroid = polygonCentroid(cell)
    ctx.save()
    ctx.beginPath()
    ctx.arc(centroid.x, centroid.y, 6, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255, 250, 243, 0.9)"
    ctx.fill()
    ctx.strokeStyle = CENTROID_COLOR
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(centroid.x - 3, centroid.y)
    ctx.lineTo(centroid.x + 3, centroid.y)
    ctx.moveTo(centroid.x, centroid.y - 3)
    ctx.lineTo(centroid.x, centroid.y + 3)
    ctx.stroke()
    ctx.restore()
    const seed = points[index]
    const distance = Math.hypot(seed.x - centroid.x, seed.y - centroid.y)
    if (distance > 4) drawArrow(seed, centroid)
  })
}

function drawArrow(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const end = {
    x: from.x + Math.cos(angle) * Math.max(0, length - 8),
    y: from.y + Math.sin(angle) * Math.max(0, length - 8),
  }
  drawLine(from, end, "rgba(201, 106, 31, 0.7)", 1.6, [4, 4])
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(end.x, end.y)
  ctx.lineTo(end.x - 7 * Math.cos(angle - 0.5), end.y - 7 * Math.sin(angle - 0.5))
  ctx.lineTo(end.x - 7 * Math.cos(angle + 0.5), end.y - 7 * Math.sin(angle + 0.5))
  ctx.closePath()
  ctx.fillStyle = "rgba(201, 106, 31, 0.8)"
  ctx.fill()
  ctx.restore()
}

function drawLabel(text, x, y, color = "#0f4f2b") {
  ctx.save()
  ctx.font = "700 12px Manrope, system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.lineWidth = 4
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)"
  ctx.strokeText(text, x, y)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}

function drawHover() {
  if (!hover || l1.step !== steps.length - 1) return
  const index = nearestIndex(l1.points, hover.x, hover.y)
  const nearest = l1.points[index]
  if (!nearest) return
  drawLine(hover, nearest, "rgba(15, 79, 43, 0.65)", 2, [5, 4])
  ctx.save()
  ctx.beginPath()
  ctx.arc(hover.x, hover.y, 5, 0, Math.PI * 2)
  ctx.fillStyle = "#0f4f2b"
  ctx.fill()
  ctx.strokeStyle = "white"
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
  drawLabel(`ближе к ${nearest.label}`, hover.x, hover.y - 16, "#0f4f2b")
}

function drawDelaunay(points, edges, color, width) {
  for (const [a, b] of edges) drawLine(points[a], points[b], color, width)
}

function drawPerpendicularTicks(points, edges) {
  for (const [a, b] of edges) {
    const first = points[a]
    const second = points[b]
    const mid = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
    const length = Math.hypot(second.x - first.x, second.y - first.y)
    if (length < 1) continue
    const nx = -(second.y - first.y) / length
    const ny = (second.x - first.x) / length
    drawLine(
      { x: mid.x - nx * 11, y: mid.y - ny * 11 },
      { x: mid.x + nx * 11, y: mid.y + ny * 11 },
      "rgba(15, 79, 43, 0.8)",
      2,
    )
    ctx.save()
    ctx.beginPath()
    ctx.arc(mid.x, mid.y, 2.6, 0, Math.PI * 2)
    ctx.fillStyle = "#0f4f2b"
    ctx.fill()
    ctx.restore()
  }
}

function drawVoronoiVertices(cells) {
  const seen = []
  for (const cell of cells) {
    for (const point of cell) {
      if (point.x < 2 || point.x > W - 2 || point.y < 2 || point.y > H - 2) continue
      if (seen.some((other) => Math.hypot(other.x - point.x, other.y - point.y) < 1.2)) continue
      seen.push(point)
    }
  }
  for (const point of seen) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = "#c96a1f"
    ctx.fill()
    ctx.strokeStyle = "white"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }
}

function drawLevel1() {
  const points = l1.points
  const cells = voronoiCells(points, W, H)
  const edges = delaunayEdges(points)

  if (l1.step === 1) {
    drawDelaunay(points, edges, "rgba(70, 95, 125, 0.72)", 1.6)
  } else if (l1.step === 2) {
    drawDelaunay(points, edges, "rgba(70, 95, 125, 0.3)", 1.1)
    drawPerpendicularTicks(points, edges)
  } else if (l1.step === 3 || l1.step === 4) {
    drawDelaunay(points, edges, "rgba(47, 93, 145, 0.55)", 1.6)
    for (const [a, b] of edges) {
      const line = bisectorSegment(points[a], points[b], W, H)
      if (line) drawLine(line[0], line[1], "rgba(15, 79, 43, 0.42)", 1.5, [7, 6])
    }
    drawPerpendicularTicks(points, edges)
    if (l1.step === 4) drawVoronoiVertices(cells)
  } else if (l1.step === 5) {
    drawDelaunay(points, edges, "rgba(70, 95, 125, 0.18)", 1)
    for (const [a, b] of edges) {
      const line = bisectorSegment(points[a], points[b], W, H)
      if (line) drawLine(line[0], line[1], "rgba(15, 79, 43, 0.12)", 1, [5, 5])
    }
    strokeCellEdges(cells, "rgba(201, 106, 31, 0.95)", 2.6, [6, 5], true)
    drawVoronoiVertices(cells)
  } else if (l1.step === 6) {
    strokeCellEdges(cells, "rgba(15, 79, 43, 0.95)", 2.8, [], true)
  } else if (l1.step === 7) {
    drawCells(cells, points, 0.3, true)
  } else if (l1.step === 8) {
    drawCells(cells, points, 0.3, true)
    if (hover) {
      const index = nearestIndex(points, hover.x, hover.y)
      fillCell(cells[index], points[index].color, 0.32)
      strokeCell(cells[index], SELECTED_COLOR, 2.4)
    }
    drawHover()
  }

  points.forEach((point, index) => drawSeed(point, index, true))
}

function drawLevel2() {
  const points = l2.points
  const cells = voronoiCells(points, W, H)
  drawCells(cells, points, 0.26, true)
  drawCentroids(cells, points)
  points.forEach((point, index) => drawSeed(point, index, false))
}

function drawLevel3() {
  const points = l3.points
  const cells = voronoiCells(points, W, H)
  const alpha = Number(els.fillOpacity.value) / 100
  cells.forEach((cell, index) => fillCell(cell, points[index].color, alpha))
  if (els.showBoundaries.checked) {
    cells.forEach((cell) => strokeCell(cell, "rgba(255, 255, 255, 0.8)", 2))
    cells.forEach((cell) => strokeCell(cell, "rgba(23, 54, 88, 0.18)", 0.9))
  }
  if (l3.selected >= 0 && cells[l3.selected]) {
    strokeCell(cells[l3.selected], SELECTED_COLOR, 3)
  }
  if (els.showCentroids.checked) {
    for (const cell of cells) {
      const centroid = polygonCentroid(cell)
      ctx.save()
      ctx.beginPath()
      ctx.arc(centroid.x, centroid.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255, 250, 243, 0.9)"
      ctx.fill()
      ctx.strokeStyle = CENTROID_COLOR
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    }
  }
  if (els.showSeeds.checked) {
    points.forEach((point, index) => {
      drawSeed(point, index, false)
      if (index === l3.selected) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(point.x, point.y, 13, 0, Math.PI * 2)
        ctx.strokeStyle = SELECTED_COLOR
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.restore()
      }
    })
  }
}

function draw() {
  if (!ctx || W === 0 || H === 0) return
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = "#f1f7fe"
  ctx.fillRect(0, 0, W, H)
  drawGrid()
  if (level === 1) drawLevel1()
  else if (level === 2) drawLevel2()
  else drawLevel3()
}

function setHint(text) {
  hint.textContent = text
  hint.hidden = !text
}

function updateSandboxStatus(text, kind = "") {
  els.sandboxStatus.textContent = text
  els.sandboxStatus.className = `voronoi-note voronoi-status ${kind}`
}

function updateCount() {
  els.countOutput.textContent = String(l3.points.length)
  els.countRange.value = String(Math.min(MAX_POINTS, Math.max(2, l3.points.length)))
}

function updateSandboxIter() {
  els.sandboxIter.textContent = String(l3.iter)
}

function syncPalette() {
  const selected = l3.points[l3.selected]
  els.palette.querySelectorAll("[data-color]").forEach((button) => {
    button.setAttribute("aria-pressed", String(Boolean(selected) && button.dataset.color === selected.color))
  })
}

function updateSelectionStatus() {
  const selected = l3.points[l3.selected]
  if (!selected) {
    updateSandboxStatus(`Точек: ${l3.points.length}. Кликните по ячейке, чтобы выбрать её.`)
  } else {
    updateSandboxStatus(`Точек: ${l3.points.length}. Выбрана точка ${l3.selected + 1}.`)
  }
  syncPalette()
}

function setStep(next) {
  l1.step = Math.max(0, Math.min(steps.length - 1, next))
  const step = steps[l1.step]
  els.stepKicker.textContent = `Шаг ${l1.step + 1} из ${steps.length}`
  els.stepTitle.textContent = step.title
  els.stepText.textContent = step.text
  els.stepBack.disabled = l1.step === 0
  els.stepNext.textContent = l1.step === steps.length - 1 ? "К релаксации Ллойда" : "Дальше"
  setHint(l1.step === steps.length - 1 ? "Наведите курсор или коснитесь плоскости — подсветится ячейка ближайшей точки" : "")
  draw()
}

function stopAuto() {
  window.clearTimeout(autoTimer)
  autoTimer = null
  l2.auto = false
  els.lloydAuto.textContent = "Запустить"
  els.lloydAuto.setAttribute("aria-pressed", "false")
}

function spreadPercent(cells) {
  const areas = cells.map(polygonArea).filter((area) => area > 0)
  if (areas.length === 0) return 0
  const mean = areas.reduce((sum, area) => sum + area, 0) / areas.length
  if (mean === 0) return 0
  const variance = areas.reduce((sum, area) => sum + (area - mean) ** 2, 0) / areas.length
  return (Math.sqrt(variance) / mean) * 100
}

function updateLloydPanel() {
  els.lloydIter.textContent = String(l2.iter)
  const cells = voronoiCells(l2.points, W, H)
  els.lloydSpread.textContent = `${spreadPercent(cells).toFixed(1)}%`
  els.lloydText2.textContent = l2.iter >= 8
    ? "После нескольких шагов ячейки становятся похожи по размеру и форме. Это и есть релаксация Ллойда: точки постепенно сходятся к центрам своих областей."
    : "На шаге каждая точка переезжает в центр масс своей ячейки. Ячейки перестраиваются, центры масс смещаются — повторяем."
  els.lloydCountOutput.textContent = String(l2.points.length)
  els.lloydCount.value = String(Math.min(30, Math.max(3, l2.points.length)))
}

function animatePoints(points, targets, duration = 420) {
  if (duration === 0 || REDUCED) {
    points.forEach((point, index) => {
      point.x = targets[index].x
      point.y = targets[index].y
    })
    draw()
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const from = points.map((point) => ({ x: point.x, y: point.y }))
    const start = performance.now()
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = t * t * (3 - 2 * t)
      points.forEach((point, index) => {
        point.x = from[index].x + (targets[index].x - from[index].x) * eased
        point.y = from[index].y + (targets[index].y - from[index].y) * eased
      })
      draw()
      if (t < 1) {
        animationFrame = requestAnimationFrame(frame)
      } else {
        animationFrame = 0
        resolve()
      }
    }
    animationFrame = requestAnimationFrame(frame)
  })
}

async function lloydStep(animated = true) {
  if (busy) return
  busy = true
  els.lloydStep.disabled = true
  const cells = voronoiCells(l2.points, W, H)
  const targets = cells.map(polygonCentroid)
  await animatePoints(l2.points, targets, animated ? 420 : 0)
  l2.iter += 1
  busy = false
  els.lloydStep.disabled = false
  updateLloydPanel()
  els.lloydStatus.textContent = `Шаг ${l2.iter}: точки переехали в центры масс своих ячеек.`
  draw()
}

async function runAuto() {
  if (!l2.auto) return
  await lloydStep(true)
  if (l2.auto) autoTimer = window.setTimeout(runAuto, 900)
}

function generateLloydMap(count = l2.points.length, seed = Math.floor(Math.random() * 100000)) {
  stopAuto()
  const safeCount = Math.max(3, Math.min(30, count))
  l2.points = randomPoints(safeCount, seed)
  l2.startPoints = clonePoints(l2.points)
  l2.iter = 0
  els.lloydStatus.textContent = "Новое стартовое расположение. Оранжевые кольца — центры масс."
  updateLloydPanel()
  draw()
}

function resetLloyd() {
  stopAuto()
  l2.points = clonePoints(l2.startPoints)
  l2.iter = 0
  els.lloydStatus.textContent = "Диаграмма вернулась к стартовому расположению точек."
  updateLloydPanel()
  draw()
}

function randomizeSandbox(count = l3.points.length, seed = Math.floor(Math.random() * 100000)) {
  const safeCount = Math.max(2, Math.min(MAX_POINTS, count))
  l3.points = randomPoints(safeCount, seed)
  l3.selected = -1
  l3.iter = 0
  updateSandboxIter()
  updateCount()
  updateSelectionStatus()
  draw()
}

function addPoint(x, y) {
  if (l3.points.length >= MAX_POINTS) {
    updateSandboxStatus(`Больше ${MAX_POINTS} точек не поместится — удалите пару.`, "bad")
    return
  }
  l3.points.push({ x, y, color: COLORS[l3.points.length % COLORS.length] })
  l3.selected = l3.points.length - 1
  updateCount()
  updateSelectionStatus()
  draw()
}

function removeSelected() {
  if (l3.selected < 0) {
    updateSandboxStatus("Сначала выберите точку или ячейку.", "bad")
    return
  }
  l3.points.splice(l3.selected, 1)
  l3.selected = -1
  updateCount()
  updateSelectionStatus()
  draw()
}

function lloydSandbox() {
  if (l3.busy) return
  l3.busy = true
  const cells = voronoiCells(l3.points, W, H)
  const targets = cells.map(polygonCentroid)
  animatePoints(l3.points, targets, 360).then(() => {
    l3.iter += 1
    l3.busy = false
    l3.selected = -1
    updateSandboxIter()
    updateSelectionStatus()
    updateSandboxStatus("Точки переехали в центры масс — диаграмма стала ровнее.", "good")
    draw()
  })
}

function setLevel(next) {
  if (![1, 2, 3].includes(next)) return
  level = next
  if (level !== 2) stopAuto()
  tabs.forEach((tab) => tab.setAttribute("aria-selected", String(Number(tab.dataset.level) === level)))
  panels.forEach((panel) => {
    panel.hidden = Number(panel.id.replace("panel-", "")) !== level
  })
  if (level === 1) {
    setStep(l1.step)
    setHint(l1.step === steps.length - 1 ? "Наведите курсор или коснитесь плоскости — подсветится ячейка ближайшей точки" : "")
  } else if (level === 2) {
    updateLloydPanel()
    setHint("Оранжевые кольца — центры масс ячеек")
    draw()
  } else {
    updateCount()
    updateSandboxIter()
    updateSelectionStatus()
    setHint("Перетаскивайте точки • клик по ячейке — выбрать • правый клик — удалить")
    draw()
  }
  canvas.style.cursor = level === 3 && l3.addMode ? "crosshair" : "default"
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function findPoint(x, y, radius = 16) {
  let best = -1
  let bestDistance = radius * radius
  l3.points.forEach((point, index) => {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2
    if (distance <= bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
}

function buildPalette() {
  for (const color of COLORS) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "voronoi-swatch"
    button.dataset.color = color
    button.style.background = color
    button.setAttribute("aria-label", `Перекрасить в ${color}`)
    button.setAttribute("aria-pressed", "false")
    button.addEventListener("click", () => {
      if (l3.selected < 0) {
        updateSandboxStatus("Сначала выберите ячейку, которую хотите перекрасить.", "bad")
        return
      }
      l3.points[l3.selected].color = color
      syncPalette()
      draw()
      updateSandboxStatus(`Точка ${l3.selected + 1} перекрашена.`, "good")
    })
    els.palette.append(button)
  }
}

canvas.addEventListener("pointerdown", (event) => {
  if (level === 1 && l1.step === steps.length - 1) {
    hover = canvasPoint(event)
    draw()
    return
  }
  if (level !== 3) return
  if (event.button !== 0) return
  const point = canvasPoint(event)
  const hit = findPoint(point.x, point.y)
  if (hit >= 0) {
    l3.selected = hit
    dragging = true
    canvas.setPointerCapture(event.pointerId)
    updateSelectionStatus()
    draw()
    return
  }
  if (l3.addMode) {
    addPoint(point.x, point.y)
    return
  }
  const nearest = nearestIndex(l3.points, point.x, point.y)
  l3.selected = nearest
  updateSelectionStatus()
  draw()
})

canvas.addEventListener("pointermove", (event) => {
  if (level === 1 && l1.step === steps.length - 1) {
    hover = canvasPoint(event)
    draw()
    return
  }
  if (level !== 3) return
  if (dragging && l3.selected >= 0) {
    const point = canvasPoint(event)
    const current = l3.points[l3.selected]
    current.x = Math.max(0, Math.min(W, point.x))
    current.y = Math.max(0, Math.min(H, point.y))
    updateSelectionStatus()
    draw()
  }
})

canvas.addEventListener("pointerup", () => {
  dragging = false
})

canvas.addEventListener("pointerleave", () => {
  if (level === 1) {
    hover = null
    draw()
  }
  dragging = false
})

canvas.addEventListener("contextmenu", (event) => {
  if (level === 3) {
    event.preventDefault()
    const point = canvasPoint(event)
    const hit = findPoint(point.x, point.y)
    if (hit >= 0) {
      l3.points.splice(hit, 1)
      l3.selected = -1
      updateCount()
      updateSelectionStatus()
      draw()
    }
  }
})

window.addEventListener("keydown", (event) => {
  if (level !== 3) return
  const tag = document.activeElement?.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
  if ((event.key === "Delete" || event.key === "Backspace") && l3.selected >= 0) {
    event.preventDefault()
    removeSelected()
  }
})

tabs.forEach((tab) => tab.addEventListener("click", () => setLevel(Number(tab.dataset.level))))

els.stepBack.addEventListener("click", () => setStep(l1.step - 1))
els.stepNext.addEventListener("click", () => {
  if (l1.step === steps.length - 1) setLevel(2)
  else setStep(l1.step + 1)
})
els.stepReset.addEventListener("click", () => {
  l1.points = relativePoints([
    { x: 0.47, y: 0.47, label: "A" },
    { x: 0.57, y: 0.13, label: "B" },
    { x: 0.82, y: 0.29, label: "C" },
    { x: 0.78, y: 0.62, label: "D" },
    { x: 0.63, y: 0.84, label: "E" },
    { x: 0.31, y: 0.86, label: "F" },
    { x: 0.18, y: 0.32, label: "G" },
  ])
  setStep(0)
})

els.lloydStep.addEventListener("click", () => { lloydStep(true) })
els.lloydReset.addEventListener("click", resetLloyd)
els.lloydCount.addEventListener("input", () => {
  els.lloydCountOutput.textContent = els.lloydCount.value
})
els.lloydCount.addEventListener("change", () => {
  generateLloydMap(Number(els.lloydCount.value), Math.floor(Math.random() * 100000))
})
els.lloydRandom.addEventListener("click", () => {
  generateLloydMap(l2.points.length, Math.floor(Math.random() * 100000))
})
els.lloydAuto.addEventListener("click", () => {
  if (l2.auto) {
    stopAuto()
    els.lloydStatus.textContent = "Пауза. Можно продолжить или сбросить."
    return
  }
  l2.auto = true
  els.lloydAuto.textContent = "Остановить"
  els.lloydAuto.setAttribute("aria-pressed", "true")
  runAuto()
})

els.countRange.addEventListener("input", () => {
  els.countOutput.textContent = els.countRange.value
})
els.countRange.addEventListener("change", () => {
  randomizeSandbox(Number(els.countRange.value), Math.floor(Math.random() * 100000))
})

els.randomize.addEventListener("click", () => randomizeSandbox(l3.points.length, Math.floor(Math.random() * 100000)))
els.addPoints.addEventListener("click", () => {
  l3.addMode = !l3.addMode
  els.addPoints.setAttribute("aria-pressed", String(l3.addMode))
  canvas.style.cursor = l3.addMode ? "crosshair" : "default"
  updateSandboxStatus(l3.addMode ? "Кликните по пустому месту, чтобы добавить точку." : "Режим добавления выключен.")
})
els.removePoint.addEventListener("click", removeSelected)
els.lloydStep3.addEventListener("click", lloydSandbox)
els.showSeeds.addEventListener("change", draw)
els.showBoundaries.addEventListener("change", draw)
els.showCentroids.addEventListener("change", draw)
els.fillOpacity.addEventListener("input", draw)
els.sandboxReset.addEventListener("click", () => {
  l3.points = randomPoints(12, 11)
  l3.selected = -1
  l3.iter = 0
  updateSandboxIter()
  updateCount()
  updateSelectionStatus()
  setHint("Перетаскивайте точки • клик по ячейке — выбрать • правый клик — удалить")
  draw()
})

buildPalette()
setLevel(1)

const observer = new ResizeObserver(resize)
observer.observe(canvas)
window.addEventListener("resize", resize)
requestAnimationFrame(resize)
