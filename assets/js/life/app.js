import {
  PATTERNS,
  countNeighbors,
  countPopulation,
  createRandomBoard,
  makeBoard,
  patternSize,
  stampPattern,
  stepLife,
} from "./algorithm.js"

const TUTORIAL_SIZE = 5
const DEFAULT_SIZE = { cols: 48, rows: 32 }

const canvas = document.querySelector("#life-canvas")
const ctx = canvas.getContext("2d")
const tabs = [...document.querySelectorAll("[data-level]")]
const panels = [...document.querySelectorAll(".life-panel")]

const els = {
  stepKicker: document.querySelector("#step-kicker"),
  stepTitle: document.querySelector("#step-title"),
  stepText: document.querySelector("#step-text"),
  stepFormula: document.querySelector("#step-formula"),
  stepResult: document.querySelector("#step-result"),
  stepCalc: document.querySelector("#step-calc"),
  cellInfo: document.querySelector("#cell-info"),
  stepBack: document.querySelector("#step-back"),
  stepNext: document.querySelector("#step-next"),
  stepReset: document.querySelector("#step-reset"),
  generation: document.querySelector("#generation"),
  population: document.querySelector("#population"),
  startPause: document.querySelector("#start-pause"),
  stepOnce: document.querySelector("#step-once"),
  randomize: document.querySelector("#randomize"),
  clear: document.querySelector("#clear"),
  speed: document.querySelector("#speed"),
  speedOutput: document.querySelector("#speed-output"),
  size: document.querySelector("#size"),
  wrap: document.querySelector("#wrap"),
  pattern: document.querySelector("#pattern"),
  placePattern: document.querySelector("#place-pattern"),
  sandboxCellInfo: document.querySelector("#sandbox-cell-info"),
}

function ruleBoard(centerAlive, neighbors) {
  const board = makeBoard(TUTORIAL_SIZE, TUTORIAL_SIZE)
  board[2][2] = centerAlive ? 1 : 0
  for (const [x, y] of neighbors) board[y][x] = 1
  return board
}

function blinkerPair() {
  const first = makeBoard(7, 7)
  ;[[2, 3], [3, 3], [4, 3]].forEach(([x, y]) => {
    first[y][x] = 1
  })
  const second = stepLife(first).board
  return [first, second]
}

function gliderPair() {
  const first = makeBoard(9, 9)
  stampPattern(first, PATTERNS.glider, 2, 2)
  let current = first
  for (let i = 0; i < 4; i += 1) current = stepLife(current).board
  return [first, current]
}

const [blinkerBefore, blinkerAfter] = blinkerPair()
const [gliderBefore, gliderAfter] = gliderPair()

const steps = [
  {
    title: "Восемь соседей",
    text: "У каждой клетки ровно восемь соседей — восемь позиций вокруг. Считаются только живые. У центральной клетки здесь два живых соседа.",
    board: ruleBoard(true, [[1, 2], [3, 2]]),
    focus: { x: 2, y: 2 },
    result: "останется живой",
    calc: "n = 2 · клетка живая → n = 2 или 3 → остаётся живой.",
  },
  {
    title: "Выживание: 2 или 3",
    text: "Если у живой клетки два или три живых соседа, она остаётся живой. Здесь n = 3 — клетка выживает.",
    board: ruleBoard(true, [[1, 2], [3, 2], [2, 1]]),
    focus: { x: 2, y: 2 },
    result: "останется живой",
    calc: "n = 3 · клетка живая → n = 2 или 3 → остаётся живой.",
  },
  {
    title: "Смерть: меньше двух",
    text: "Если живых соседей меньше двух, клетка погибает от одиночества. У центральной клетки только один сосед — она не выживет.",
    board: ruleBoard(true, [[2, 1]]),
    focus: { x: 2, y: 2 },
    result: "погибнет",
    calc: "n = 1 · клетка живая → n < 2 → погибает.",
  },
  {
    title: "Смерть: больше трёх",
    text: "Если живых соседей больше трёх, клетка погибает от перенаселения. Здесь у центральной клетки четыре соседа.",
    board: ruleBoard(true, [[1, 2], [3, 2], [2, 1], [2, 3]]),
    focus: { x: 2, y: 2 },
    result: "погибнет",
    calc: "n = 4 · клетка живая → n > 3 → погибает.",
  },
  {
    title: "Рождение: ровно три",
    text: "Если мёртвая клетка имеет ровно три живых соседа, в ней рождается новая жизнь. Центральная клетка пока пустая, но n = 3.",
    board: ruleBoard(false, [[1, 2], [3, 2], [2, 1]]),
    focus: { x: 2, y: 2 },
    result: "родится",
    calc: "n = 3 · клетка мёртвая → n = 3 → рождается.",
  },
  {
    title: "Всё одновременно",
    text: "Все клетки считают соседей по старому полю и меняются одновременно. Мигалка из трёх клеток через поколение становится вертикальной, а ещё через одно — снова горизонтальной.",
    boards: [blinkerBefore, blinkerAfter],
    labels: ["сейчас", "через 1 поколение"],
    result: "мигалка",
    calc: "Три клетки по горизонтали → три по вертикали → снова по горизонтали.",
  },
  {
    title: "Из правил — движение",
    text: "Простые правила порождают устойчивые фигуры. Планер за четыре поколения смещается на одну клетку вправо и вниз, сохраняя форму.",
    boards: [gliderBefore, gliderAfter],
    labels: ["поколение 0", "поколение 4"],
    result: "планер",
    calc: "Четыре поколения → вся фигура сдвинулась на (1, 1).",
  },
]

let W = 0
let H = 0
let dpr = 1
let level = 1
let step = 0
let hoverCell = null
let pinnedCell = null
let lifeGeometries = []

const sandbox = {
  rows: DEFAULT_SIZE.rows,
  cols: DEFAULT_SIZE.cols,
  board: makeBoard(DEFAULT_SIZE.rows, DEFAULT_SIZE.cols),
  generation: 0,
  speed: 8,
  wrap: true,
  running: false,
  pattern: "pulsar",
}
let sandboxGeometry = null
let sandboxHover = null
let paintState = null
let drawing = false
let animationId = 0
let lastTick = 0

function allDead(rows, cols) {
  return makeBoard(rows, cols)
}

function placePattern(name) {
  const pattern = PATTERNS[name]
  const size = patternSize(pattern)
  sandbox.board = allDead(sandbox.rows, sandbox.cols)
  const x = Math.max(0, Math.floor((sandbox.cols - size.width) / 2))
  const y = Math.max(0, Math.floor((sandbox.rows - size.height) / 2))
  stampPattern(sandbox.board, pattern, x, y)
  sandbox.generation = 0
  sandbox.pattern = name
  sandboxHover = null
  updateSandboxInfo()
  updateSandboxStats()
  draw()
}

function resetSandbox() {
  setRunning(false)
  sandbox.generation = 0
  placePattern(sandbox.pattern)
}

function updateSandboxStats() {
  els.generation.textContent = String(sandbox.generation)
  els.population.textContent = String(countPopulation(sandbox.board))
}

function setRunning(running) {
  sandbox.running = running
  els.startPause.textContent = running ? "Пауза" : "Старт"
  els.startPause.setAttribute("aria-pressed", String(running))
  if (running) {
    lastTick = 0
    if (!animationId) animationId = requestAnimationFrame(animationLoop)
  }
}

function animationLoop(now) {
  animationId = 0
  if (!sandbox.running) return
  if (!lastTick) lastTick = now
  const interval = 1000 / sandbox.speed
  if (now - lastTick >= interval) {
    lastTick = now
    advanceSandbox()
  }
  animationId = requestAnimationFrame(animationLoop)
}

function advanceSandbox() {
  sandbox.board = stepLife(sandbox.board, { wrap: sandbox.wrap }).board
  sandbox.generation += 1
  updateSandboxStats()
  updateSandboxInfo()
  draw()
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

function drawBoard(board, left, top, cell, options = {}) {
  const rows = board.length
  const cols = board[0].length
  const focus = options.focus || null
  const changed = options.changed || new Map()
  ctx.save()
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const px = left + x * cell
      const py = top + y * cell
      ctx.fillStyle = board[y][x] ? "#2f9e63" : "#e8eef7"
      ctx.fillRect(px, py, cell, cell)
    }
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)"
  ctx.lineWidth = 1
  for (let i = 0; i <= cols; i += 1) {
    ctx.beginPath()
    ctx.moveTo(left + i * cell, top)
    ctx.lineTo(left + i * cell, top + rows * cell)
    ctx.stroke()
  }
  for (let i = 0; i <= rows; i += 1) {
    ctx.beginPath()
    ctx.moveTo(left, top + i * cell)
    ctx.lineTo(left + cols * cell, top + i * cell)
    ctx.stroke()
  }
  for (const [key, item] of changed) {
    const [x, y] = key.split(":").map(Number)
    if (item === "born") {
      ctx.strokeStyle = "#ff8a3d"
      ctx.lineWidth = 2.5
      ctx.strokeRect(left + x * cell + 2, top + y * cell + 2, cell - 4, cell - 4)
    } else {
      ctx.strokeStyle = "rgba(163, 59, 44, 0.5)"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(left + x * cell + 4, top + y * cell + 4)
      ctx.lineTo(left + (x + 1) * cell - 4, top + (y + 1) * cell - 4)
      ctx.moveTo(left + (x + 1) * cell - 4, top + y * cell + 4)
      ctx.lineTo(left + x * cell + 4, top + (y + 1) * cell - 4)
      ctx.stroke()
    }
  }
  if (focus) {
    const px = left + focus.x * cell
    const py = top + focus.y * cell
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = focus.x + dx
        const ny = focus.y + dy
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        ctx.save()
        ctx.strokeStyle = "rgba(47, 93, 145, 0.7)"
        ctx.setLineDash([3, 3])
        ctx.lineWidth = 1.4
        ctx.strokeRect(left + nx * cell + 2, top + ny * cell + 2, cell - 4, cell - 4)
        ctx.restore()
      }
    }
    ctx.save()
    ctx.strokeStyle = "#ff8a3d"
    ctx.setLineDash(board[focus.y][focus.x] ? [] : [5, 4])
    ctx.lineWidth = 3
    ctx.strokeRect(px + 1, py + 1, cell - 2, cell - 2)
    ctx.restore()
    const count = countNeighbors(board, focus.x, focus.y, false)
    const label = `n = ${count}`
    ctx.save()
    ctx.font = "800 12px Manrope, system-ui, sans-serif"
    const width = ctx.measureText(label).width + 14
    let bx = px + cell / 2 - width / 2
    let by = py - 28
    if (by < top) by = py + cell + 8
    if (bx < left) bx = left + 4
    ctx.fillStyle = "rgba(7, 17, 28, 0.82)"
    ctx.fillRect(bx, by, width, 22)
    ctx.fillStyle = "#eaf3fd"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(label, bx + width / 2, by + 11)
    ctx.restore()
  }
  ctx.restore()
}

function drawSingle(board, focus) {
  const size = board.length
  const cell = Math.min((W * 0.68) / size, (H * 0.7) / size)
  const left = (W - cell * size) / 2
  const top = (H - cell * size) / 2
  lifeGeometries = [{ boardIndex: 0, board, left, top, cell, size, mode: "single" }]
  drawBoard(board, left, top, cell, { focus })
  ctx.save()
  ctx.fillStyle = "#5a7087"
  ctx.font = "600 11px Manrope, system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (let i = 0; i < size; i += 1) {
    ctx.fillText(String(i), left + (i + 0.5) * cell, top - 11)
    ctx.fillText(String(i), left - 12, top + (i + 0.5) * cell)
  }
  ctx.restore()
}

function drawTwo(boards, labels) {
  const size = boards[0].length
  const gap = 54
  const cell = Math.min((W - gap * 3) / (size * 2), (H * 0.62) / size)
  const total = cell * size * 2 + gap
  const left = (W - total) / 2
  const top = H * 0.22
  lifeGeometries = []
  boards.forEach((board, index) => {
    const boardLeft = left + index * (cell * size + gap)
    const boardTop = top
    const changed = new Map()
    if (index === 1) {
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          if (boards[index - 1][y][x] !== board[y][x]) {
            changed.set(`${x}:${y}`, board[y][x] ? "born" : "died")
          }
        }
      }
    }
    const focus = (hoverCell || pinnedCell) && (hoverCell || pinnedCell).boardIndex === index
      ? (hoverCell || pinnedCell)
      : null
    lifeGeometries.push({ boardIndex: index, board, left: boardLeft, top: boardTop, cell, size, mode: "pair" })
    drawBoard(board, boardLeft, boardTop, cell, { focus, changed })
    ctx.save()
    ctx.fillStyle = "#5a7087"
    ctx.font = "700 12px Manrope, system-ui, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "bottom"
    ctx.fillText(labels[index], boardLeft + (cell * size) / 2, boardTop - 14)
    ctx.restore()
  })
  ctx.save()
  ctx.strokeStyle = "rgba(47, 93, 145, 0.7)"
  ctx.fillStyle = "rgba(47, 93, 145, 0.7)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(left + cell * size + 12, top + (cell * size) / 2)
  ctx.lineTo(left + cell * size + gap - 12, top + (cell * size) / 2)
  ctx.stroke()
  const x = left + cell * size + gap - 12
  const y = top + (cell * size) / 2
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x - 10, y - 6)
  ctx.lineTo(x - 10, y + 6)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawStep() {
  const current = steps[step]
  if (current.boards) {
    drawTwo(current.boards, current.labels)
    return
  }
  drawSingle(current.board, hoverCell || pinnedCell || current.focus)
}

function drawSandbox() {
  const cols = sandbox.cols
  const rows = sandbox.rows
  const cell = Math.min((W - 24) / cols, (H - 24) / rows)
  const left = (W - cols * cell) / 2
  const top = (H - rows * cell) / 2
  sandboxGeometry = { left, top, cell, cols, rows }
  ctx.save()
  ctx.fillStyle = "#e8eef7"
  ctx.fillRect(left, top, cols * cell, rows * cell)
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (sandbox.board[y][x]) {
        ctx.fillStyle = "#2f9e63"
        ctx.fillRect(left + x * cell, top + y * cell, cell + 0.5, cell + 0.5)
      }
    }
  }
  ctx.strokeStyle = "rgba(36, 72, 112, 0.13)"
  ctx.lineWidth = 0.7
  for (let i = 0; i <= cols; i += 1) {
    ctx.beginPath()
    ctx.moveTo(left + i * cell, top)
    ctx.lineTo(left + i * cell, top + rows * cell)
    ctx.stroke()
  }
  for (let i = 0; i <= rows; i += 1) {
    ctx.beginPath()
    ctx.moveTo(left, top + i * cell)
    ctx.lineTo(left + cols * cell, top + i * cell)
    ctx.stroke()
  }
  if (sandboxHover) {
    const { x, y } = sandboxHover
    ctx.strokeStyle = "#0f4f2b"
    ctx.lineWidth = 2.5
    ctx.strokeRect(left + x * cell + 1, top + y * cell + 1, cell - 2, cell - 2)
  }
  ctx.restore()
}

function draw() {
  if (!ctx || W === 0 || H === 0) return
  drawBackground()
  if (level === 2) drawSandbox()
  else drawStep()
}

function lifeCellAt(event) {
  const point = canvasPoint(event)
  for (const geometry of lifeGeometries) {
    const { left, top, cell, size } = geometry
    const x = Math.floor((point.x - left) / cell)
    const y = Math.floor((point.y - top) / cell)
    if (x < 0 || y < 0 || x >= size || y >= size) continue
    return { x, y, boardIndex: geometry.boardIndex, board: geometry.board }
  }
  return null
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * (W / rect.width),
    y: (event.clientY - rect.top) * (H / rect.height),
  }
}

function sandboxCellAt(event) {
  if (!sandboxGeometry) return null
  const { left, top, cell, cols, rows } = sandboxGeometry
  const point = canvasPoint(event)
  const x = Math.floor((point.x - left) / cell)
  const y = Math.floor((point.y - top) / cell)
  if (x < 0 || y < 0 || x >= cols || y >= rows) return null
  return { x, y }
}

function resultFor(alive, neighbors) {
  if (alive) {
    return neighbors === 2 || neighbors === 3
      ? { text: "останется живой", kind: "good" }
      : { text: "погибнет", kind: "bad" }
  }
  return neighbors === 3
    ? { text: "родится", kind: "born" }
    : { text: "останется мёртвой", kind: "neutral" }
}

function updateLifeUi() {
  const current = steps[step]
  els.stepKicker.textContent = `Шаг ${step + 1} из ${steps.length}`
  els.stepTitle.textContent = current.title
  els.stepText.textContent = current.text
  els.stepFormula.textContent = "next = alive ? (2 ≤ n ≤ 3)\n       : (n = 3)"
  const focus = hoverCell || pinnedCell || current.focus
  if (current.boards) {
    if (focus) {
      const board = current.boards[focus.boardIndex]
      const alive = board[focus.y][focus.x] === 1
      const neighbors = countNeighbors(board, focus.x, focus.y, false)
      els.cellInfo.textContent = `${current.labels[focus.boardIndex]}: клетка (${focus.x}, ${focus.y}) ${alive ? "живая" : "мёртвая"} · соседей ${neighbors}`
    } else {
      els.cellInfo.textContent = "Наведите на клетку — покажу её состояние и число соседей."
    }
    els.stepResult.textContent = current.result
    els.stepResult.className = "life-result born"
    els.stepCalc.textContent = current.calc
    return
  }
  const board = current.board
  const cell = focus || current.focus
  const alive = board[cell.y][cell.x] === 1
  const neighbors = countNeighbors(board, cell.x, cell.y, false)
  const result = resultFor(alive, neighbors)
  els.cellInfo.textContent = `x = ${cell.x}, y = ${cell.y} · ${alive ? "живая" : "мёртвая"} · соседей ${neighbors}`
  els.stepResult.textContent = result.text
  els.stepResult.className = `life-result ${result.kind}`
  els.stepCalc.textContent = `n = ${neighbors} · клетка ${alive ? "живая" : "мёртвая"} → ${result.text}.`
}

function setStep(next) {
  step = Math.max(0, Math.min(steps.length - 1, next))
  hoverCell = null
  pinnedCell = null
  els.stepBack.disabled = step === 0
  els.stepNext.textContent = step === steps.length - 1 ? "В песочницу" : "Дальше"
  updateLifeUi()
  if (level === 1) draw()
}

function updateSandboxInfo() {
  if (!sandboxHover) {
    els.sandboxCellInfo.textContent = "Наведи на клетку — покажу координаты и число соседей."
    return
  }
  const { x, y } = sandboxHover
  const alive = sandbox.board[y][x] === 1
  const neighbors = countNeighbors(sandbox.board, x, y, sandbox.wrap)
  els.sandboxCellInfo.textContent = `x = ${x}, y = ${y} · ${alive ? "живая" : "мёртвая"} · соседей ${neighbors}`
}

function setLevel(next) {
  level = next
  tabs.forEach((tab) => tab.setAttribute("aria-selected", String(Number(tab.dataset.level) === level)))
  panels.forEach((panel) => {
    panel.hidden = Number(panel.id.replace("panel-", "")) !== level
  })
  if (level === 2) {
    setRunning(false)
    updateSandboxStats()
    updateSandboxInfo()
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

tabs.forEach((tab) => tab.addEventListener("click", () => setLevel(Number(tab.dataset.level))))
els.stepBack.addEventListener("click", () => setStep(step - 1))
els.stepNext.addEventListener("click", () => {
  if (step === steps.length - 1) setLevel(2)
  else setStep(step + 1)
})
els.stepReset.addEventListener("click", () => setStep(0))

els.startPause.addEventListener("click", () => {
  setRunning(!sandbox.running)
})
els.stepOnce.addEventListener("click", () => {
  setRunning(false)
  advanceSandbox()
})
els.randomize.addEventListener("click", () => {
  setRunning(false)
  sandbox.board = createRandomBoard(sandbox.rows, sandbox.cols, 0.3, Math.floor(Math.random() * 100000))
  sandbox.generation = 0
  sandboxHover = null
  updateSandboxStats()
  updateSandboxInfo()
  draw()
})
els.clear.addEventListener("click", () => {
  setRunning(false)
  sandbox.board = allDead(sandbox.rows, sandbox.cols)
  sandbox.generation = 0
  sandboxHover = null
  updateSandboxStats()
  updateSandboxInfo()
  draw()
})
els.speed.addEventListener("input", () => {
  sandbox.speed = Number(els.speed.value)
  els.speedOutput.textContent = `${sandbox.speed} / сек`
})
els.size.addEventListener("change", () => {
  setRunning(false)
  const [cols, rows] = els.size.value.split("x").map(Number)
  sandbox.cols = cols
  sandbox.rows = rows
  sandbox.board = allDead(rows, cols)
  sandbox.generation = 0
  placePattern(els.pattern.value)
})
els.wrap.addEventListener("change", () => {
  sandbox.wrap = els.wrap.checked
  updateSandboxInfo()
})
els.pattern.addEventListener("change", () => {
  sandbox.pattern = els.pattern.value
})
els.placePattern.addEventListener("click", () => {
  setRunning(false)
  placePattern(els.pattern.value)
})

canvas.addEventListener("pointermove", (event) => {
  if (level === 2) {
    const cell = sandboxCellAt(event)
    if (drawing && cell) {
      sandbox.board[cell.y][cell.x] = paintState
      sandboxHover = cell
      updateSandboxStats()
      updateSandboxInfo()
      draw()
      return
    }
    if (!cell) return
    if (sandboxHover && sandboxHover.x === cell.x && sandboxHover.y === cell.y) return
    sandboxHover = cell
    updateSandboxInfo()
    draw()
    return
  }
  const cell = lifeCellAt(event)
  if (!cell) return
  if (hoverCell && hoverCell.x === cell.x && hoverCell.y === cell.y && hoverCell.boardIndex === cell.boardIndex) return
  hoverCell = cell
  updateLifeUi()
  draw()
})

canvas.addEventListener("pointerleave", () => {
  if (level === 2) {
    sandboxHover = null
    drawing = false
    paintState = null
    updateSandboxInfo()
    draw()
    return
  }
  hoverCell = null
  updateLifeUi()
  draw()
})

canvas.addEventListener("pointerdown", (event) => {
  if (level !== 2) return
  const cell = sandboxCellAt(event)
  if (!cell) return
  setRunning(false)
  drawing = true
  paintState = sandbox.board[cell.y][cell.x] ? 0 : 1
  sandbox.board[cell.y][cell.x] = paintState
  sandboxHover = cell
  updateSandboxStats()
  updateSandboxInfo()
  draw()
})

canvas.addEventListener("pointerup", () => {
  drawing = false
  paintState = null
})
canvas.addEventListener("pointercancel", () => {
  drawing = false
  paintState = null
})

canvas.addEventListener("click", (event) => {
  if (level !== 1) return
  const cell = lifeCellAt(event)
  if (!cell) return
  if (pinnedCell && pinnedCell.x === cell.x && pinnedCell.y === cell.y && pinnedCell.boardIndex === cell.boardIndex) pinnedCell = null
  else pinnedCell = cell
  updateLifeUi()
  draw()
})

const observer = new ResizeObserver(resize)
observer.observe(canvas)
window.addEventListener("resize", resize)
requestAnimationFrame(resize)

els.speedOutput.textContent = `${sandbox.speed} / сек`
sandbox.wrap = els.wrap.checked
placePattern("pulsar")
updateSandboxStats()
updateSandboxInfo()
setLevel(1)
