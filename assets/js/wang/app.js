import { bindPointer } from "../camera.js"
import {
  LEVEL_PRESETS,
  acceptsAnywhere,
  anyPlaced,
  applyObject,
  candidateCells,
  catalog,
  centerCell,
  deadEnd,
  dealLevel1,
  describeTile,
  signature,
  emptyBoard,
  generateMap,
  neighborsOf,
  objectOptions,
  placementCheck,
  tryReplace,
} from "./engine.js"
import { cellAt, drawMap, fitMap, tileSvg, drawThumb } from "./render.js"

const EXPLAIN = {
  1: "У плитки четыре стороны, и поворачивать её нельзя. Соседними становятся только стороны с одним и тем же цветом. Первая плитка встаёт в центр, следующая — только вплотную к уже стоящей.",
  2: "Вместо цвета у стороны 0 или 1. Единица значит: из этой стороны выходит дорога. Дорога продолжается у соседа только при такой же единице. На шве написано это число. Дорога чаще идёт прямо и обходит уже проложенную, поэтому пересечений мало. Цвет земли здесь только рисунок, в правило он не входит.",
  3: "К дороге добавляются цвет земли от 0 до 10 и высота травы от 0 до 5. Короткая подпись на шве: дорога, затем цвет/высота, например 1 7/3. Совпасть должны все числа примыкающих сторон. Общее ребро записывается один раз, поэтому готовая карта не спорит сама с собой.",
  4: "Здесь вместе дороги, цвет, высота, вода и объекты. Подпись на шве короткая: 1 7/3 — дорога, цвет и высота, буква «в» — вода. Выберите плитку внизу и нажмите клетку: чужие стороны не встанут. Камень, дерево и камыш к сторонам Вана не относятся и меняются отдельно.",
}

const OBJECT_NAME = { none: "нет", rock: "камень", tree: "дерево", reed: "камыш" }
const CHANNELS = { 1: ["color"] }

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
const explain = document.querySelector("#explain")
const message = document.querySelector("#message")
const stage = document.querySelector("#stage")
const flat = document.querySelector("#flat")
const boardEl = document.querySelector("#board")
const canvas = document.querySelector("#iso")
const zoomControls = document.querySelector("#zoom-controls")
const side = document.querySelector("#side")
const transport = document.querySelector("#transport")
const tray = document.querySelector("#tray")
const detail = document.querySelector("#detail")
const playButton = document.querySelector("#play")
const speedInput = document.querySelector("#speed")

const params = {
  1: { seed: 1, tiles: 9, colors: 4, width: 4, height: 4, hints: true },
  2: { seed: 1, labels: true },
  3: { seed: 2, labels: true },
  4: { seed: 3, labels: true, width: 12, height: 9, roads: 3, waters: 3, colorMax: 10, heightMax: 5, objects: 18 },
}

const state = {
  level: 1,
  board: emptyBoard(4, 4),
  tray: [],
  selected: null,
  history: [],
  map: null,
  reveal: 0,
  playing: false,
  view: { camX: 0, camY: 0, zoom: 1 },
  selectedCell: null,
  catalog: [],
  catalogIndex: null,
  historyMap: [],
  cssW: 1,
  cssH: 1,
}

const ctx = canvas.getContext("2d")
const ghost = document.createElement("div")
ghost.className = "ghost hidden"
document.body.append(ghost)

function setMessage(text, kind = "") {
  message.textContent = text
  message.className = `message${kind ? ` ${kind}` : ""}`
}

function channels() {
  return state.level === 1 ? CHANNELS[1] : state.map.channels
}

function readSide() {
  const current = params[state.level]
  for (const key of Object.keys(current)) {
    const input = side.querySelector(`#p-${key}`)
    if (!input) continue
    if (input.type === "checkbox") current[key] = input.checked
    else current[key] = Number(input.value)
  }
}

function field(id, label, value, min, max) {
  return `<label class="field">${label}<input id="p-${id}" type="number" min="${min}" max="${max}" value="${value}"></label>`
}

function renderSide() {
  const level = state.level
  const current = params[level]
  if (level === 1) {
    side.innerHTML = `<h2>Раздача</h2>
      ${field("seed", "Сид", current.seed, 1, 999999)}
      ${field("tiles", "Плиток", current.tiles, 4, 16)}
      ${field("colors", "Цветов", current.colors, 2, 8)}
      ${field("width", "Ширина поля", current.width, 3, 6)}
      ${field("height", "Высота поля", current.height, 3, 6)}
      <label class="check"><input id="p-hints" type="checkbox" ${current.hints ? "checked" : ""}> Подсказка клеток</label>
      <div class="row">
        <button type="button" data-action="random">Случайный сид</button>
        <button type="button" data-action="redeal">Новая раздача</button>
        <button type="button" data-action="undo">Отмена</button>
      </div>`
    return
  }
  const extra = level === 4
    ? `${field("width", "Ширина", current.width, 4, 16)}
       ${field("height", "Высота", current.height, 4, 16)}
       ${field("roads", "Дорожных путей", current.roads, 0, 12)}
       ${field("waters", "Водных путей", current.waters, 0, 8)}
       ${field("colorMax", "Верх цвета", current.colorMax, 0, 10)}
       ${field("heightMax", "Верх высоты", current.heightMax, 0, 5)}
       ${field("objects", "Объекты, %", current.objects, 0, 40)}`
    : ""
  side.innerHTML = `<h2>Генерация</h2>
    ${field("seed", "Сид", current.seed, 1, 999999)}
    ${extra}
    <label class="check"><input id="p-labels" type="checkbox" ${current.labels ? "checked" : ""}> Подписи</label>
    <div class="row">
      <button type="button" data-action="random">Случайный сид</button>
      <button type="button" data-action="undo">Отмена</button>
    </div>
    <p class="explain">Один палец двигает карту, щипок меняет масштаб. Нажмите клетку: она останется яркой, остальные уйдут в тень. Повторное нажатие возвращает всю карту.</p>`
}

function renderBoard() {
  const current = params[1]
  boardEl.style.setProperty("--cols", String(state.board[0].length))
  boardEl.style.setProperty("--rows", String(state.board.length))
  boardEl.replaceChildren()
  const selectedTile = state.selected === null ? null : state.tray[state.selected]
  const spots = candidateCells(state.board)
  for (let y = 0; y < state.board.length; y += 1) {
    for (let x = 0; x < state.board[0].length; x += 1) {
      const button = document.createElement("button")
      button.type = "button"
      button.className = "cell"
      button.dataset.x = String(x)
      button.dataset.y = String(y)
      const tile = state.board[y][x]
      if (tile) {
        button.classList.add("filled")
        button.innerHTML = tileSvg(tile)
        button.setAttribute("aria-label", `Плитка ${tile.id}`)
      } else if (current.hints && selectedTile) {
        const spot = spots.some(([sx, sy]) => sx === x && sy === y)
        if (spot) {
          const ok = placementCheck(selectedTile, neighborsOf(state.board, x, y), CHANNELS[1]).ok
          button.classList.add(ok ? "fit" : "bad")
        }
      } else if (current.hints && !anyPlaced(state.board)) {
        const [cx, cy] = centerCell(state.board[0].length, state.board.length)
        if (x === cx && y === cy) button.classList.add("fit")
      }
      button.addEventListener("click", () => onCell(x, y))
      boardEl.append(button)
    }
  }
}

function renderTray() {
  tray.replaceChildren()
  if (state.level === 1) {
    state.tray.forEach((tile, index) => {
      const button = document.createElement("button")
      button.type = "button"
      button.innerHTML = tileSvg(tile)
      button.setAttribute("aria-label", `Плитка ${index + 1}`)
      button.setAttribute("aria-pressed", state.selected === index ? "true" : "false")
      button.addEventListener("click", () => onTray(index))
      button.addEventListener("pointerdown", (event) => startDrag(event, index))
      tray.append(button)
    })
    return
  }
  if (state.level !== 4 || !state.map) return
  state.catalog.forEach((tile, index) => {
    const button = document.createElement("button")
    button.type = "button"
    const thumb = document.createElement("canvas")
    thumb.width = 76
    thumb.height = 76
    drawThumb(thumb, tile, 4)
    button.append(thumb)
    button.setAttribute("aria-pressed", state.catalogIndex === index ? "true" : "false")
    button.setAttribute("aria-label", `Плитка набора ${index + 1}`)
    button.addEventListener("click", () => selectCatalog(index))
    tray.append(button)
  })
}

function renderDetail() {
  if (state.level === 1 || !state.map || !state.selectedCell) {
    detail.textContent = state.level === 1 ? "" : "Нажмите клетку: она останется яркой, и будут видны все четыре подписи."
    return
  }
  const [x, y] = state.selectedCell
  if (y < 0 || x < 0 || y >= state.map.height || x >= state.map.width) return
  if (!revealedHas(x, y)) {
    detail.textContent = "Эта клетка ещё не появилась."
    return
  }
  const tile = state.map.cells[y][x]
  const lines = describeTile(tile, state.map.channels).split("\n")
  detail.replaceChildren()
  const text = document.createElement("span")
  text.textContent = lines.join(" · ")
  detail.append(text)
  if (state.level === 4) {
    const wrap = document.createElement("span")
    wrap.className = "row object-buttons"
    const options = objectOptions(tile, neighborsOf(state.map.cells, x, y))
    for (const option of ["none", "rock", "tree", "reed"]) {
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = OBJECT_NAME[option]
      button.disabled = !options.includes(option)
      button.setAttribute("aria-pressed", tile.object === option ? "true" : "false")
      button.addEventListener("click", () => changeObject(option))
      wrap.append(button)
    }
    detail.append(document.createElement("br"), wrap)
  }
}

function revealedHas(x, y) {
  return state.map.revealOrder.slice(0, state.reveal).some(([cx, cy]) => cx === x && cy === y)
}

function renderDynamic() {
  if (state.level === 1) renderBoard()
  renderTray()
  renderDetail()
  playButton.textContent = state.playing ? "Пауза" : "Пуск"
}

function rebuild() {
  state.history = []
  state.historyMap = []
  state.selected = null
  state.catalogIndex = null
  state.selectedCell = null
  if (state.level === 1) {
    const current = params[1]
    const deal = dealLevel1({
      width: current.width,
      height: current.height,
      tileCount: current.tiles,
      colorCount: current.colors,
      seed: current.seed >>> 0,
    })
    state.board = emptyBoard(deal.width, deal.height)
    state.tray = deal.tray
    setMessage(
      deal.clamped
        ? `На поле помещается ${deal.tileCount} плиток, лишние убраны. Выберите плитку внизу.`
        : "Выберите плитку внизу. Первая встанет в центр.",
    )
  } else {
    const preset = LEVEL_PRESETS[state.level]
    const current = params[state.level]
    const options = {
      ...preset,
      seed: current.seed >>> 0,
      channels: preset.channels.slice(),
    }
    if (state.level === 4) {
      options.width = current.width
      options.height = current.height
      options.roadPaths = current.roads
      options.waterPaths = current.waters
      options.colorMax = current.colorMax
      options.heightMax = current.heightMax
      options.objectDensity = current.objects / 100
    }
    state.map = generateMap(options)
    state.catalog = catalog(state.map.cells, state.map.channels)
    state.reveal = 0
    state.playing = !reduced
    frame.bank = 0
    const rect = canvas.getBoundingClientRect()
    Object.assign(state.view, fitMap(state.map, rect.width || 640, rect.height || 360, preset.extrude))
    setMessage("Карта собирается по клеткам. На шве написано значение стороны.")
  }
  renderDynamic()
}

function setLevel(level) {
  state.level = level
  document.querySelectorAll("[data-level]").forEach((button) => {
    button.setAttribute("aria-selected", button.dataset.level === String(level) ? "true" : "false")
  })
  explain.textContent = EXPLAIN[level]
  const iso = level > 1
  flat.classList.toggle("hidden", iso)
  canvas.classList.toggle("hidden", !iso)
  zoomControls.classList.toggle("hidden", !iso)
  transport.classList.toggle("hidden", !iso)
  tray.classList.toggle("hidden", level === 2 || level === 3)
  stage.classList.toggle("flat-mode", !iso)
  stage.classList.toggle("iso-mode", iso)
  renderSide()
  rebuild()
  resize()
  if (state.map) {
    Object.assign(state.view, fitMap(state.map, state.cssW, state.cssH, LEVEL_PRESETS[state.level].extrude))
  }
}

function onTray(index) {
  if (!anyPlaced(state.board)) {
    const [x, y] = centerCell(state.board[0].length, state.board.length)
    commitPlace(index, x, y)
    return
  }
  state.selected = state.selected === index ? null : index
  setMessage(state.selected === null ? "Выбор снят." : "Нажмите соседнюю клетку или перетащите плитку.")
  renderDynamic()
}

function onCell(x, y) {
  if (state.selected === null) {
    setMessage("Сначала выберите плитку внизу.")
    return
  }
  commitPlace(state.selected, x, y)
}

function commitPlace(index, x, y) {
  const tile = state.tray[index]
  const [centerX, centerY] = centerCell(state.board[0].length, state.board.length)
  if (!anyPlaced(state.board) && (x !== centerX || y !== centerY)) {
    setMessage("Первая плитка встаёт в центр поля.", "warn")
    return
  }
  const spots = candidateCells(state.board)
  if (!spots.some(([sx, sy]) => sx === x && sy === y)) {
    setMessage(state.board[y][x] ? "Эта клетка уже занята." : "Плитку можно поставить только рядом с уже стоящей.", "warn")
    return
  }
  const check = placementCheck(tile, neighborsOf(state.board, x, y), CHANNELS[1])
  if (!check.ok) {
    setMessage(check.text, "warn")
    return
  }
  state.history.push(structuredClone({ board: state.board, tray: state.tray }))
  state.board[y][x] = tile
  state.tray.splice(index, 1)
  state.selected = null
  if (state.tray.length === 0) setMessage("Все плитки встали по правилам Вана.", "good")
  else if (deadEnd(state.board, state.tray, CHANNELS[1])) {
    setMessage("Тупик: ни одна оставшаяся плитка не подходит ни к одной свободной клетке. Отмените ход или возьмите новую раздачу.", "warn")
  } else setMessage("Плитка встала.", "good")
  renderDynamic()
}

function startDrag(event, index) {
  if (event.button !== undefined && event.button !== 0) return
  const startX = event.clientX
  const startY = event.clientY
  let dragging = false
  const move = (ev) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (!dragging) {
      if (Math.hypot(dx, dy) < 10) return
      if (Math.abs(dx) > Math.abs(dy)) {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
        return
      }
      dragging = true
      ghost.innerHTML = tileSvg(state.tray[index])
      ghost.classList.remove("hidden")
      const stopClick = (clickEvent) => {
        clickEvent.preventDefault()
        clickEvent.stopPropagation()
        document.removeEventListener("click", stopClick, true)
      }
      document.addEventListener("click", stopClick, true)
    }
    ghost.style.left = `${ev.clientX}px`
    ghost.style.top = `${ev.clientY}px`
  }
  const up = (ev) => {
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
    ghost.classList.add("hidden")
    if (!dragging) return
    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.(".cell")
    if (!target) {
      setMessage("Плитка вернулась в панель.", "warn")
      return
    }
    commitPlace(index, Number(target.dataset.x), Number(target.dataset.y))
  }
  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", up)
}

function selectCatalog(index) {
  state.catalogIndex = state.catalogIndex === index ? null : index
  if (state.catalogIndex === null) {
    setMessage("Выбор плитки снят.")
    renderDynamic()
    return
  }
  const spots = acceptsAnywhere(state.map.cells, state.catalog[index], state.map.channels)
  setMessage(
    spots.length === 0
      ? "Эту плитку сейчас некуда поставить."
      : `Эту плитку можно поставить в клеток: ${spots.length}. Нажмите подсвеченную клетку.`,
    spots.length === 0 ? "warn" : "",
  )
  renderDynamic()
}

function acceptSet() {
  if (state.level !== 4 || state.catalogIndex === null || !state.map) return new Set()
  return new Set(
    acceptsAnywhere(state.map.cells, state.catalog[state.catalogIndex], state.map.channels).map(([x, y]) => `${x},${y}`),
  )
}

function onMapTap(sx, sy) {
  if (!state.map) return
  const hit = cellAt(state.map, sx, sy, state.view, state.cssW, state.cssH, state.reveal, LEVEL_PRESETS[state.level].extrude)
  if (!hit) {
    state.selectedCell = null
    renderDetail()
    return
  }
  const [x, y] = hit
  const same = state.selectedCell && state.selectedCell[0] === x && state.selectedCell[1] === y
  const placing = state.level === 4 && state.catalogIndex !== null
  if (same && !placing) {
    state.selectedCell = null
    renderDetail()
    return
  }
  if (placing) {
    const incoming = state.catalog[state.catalogIndex]
    const spots = acceptsAnywhere(state.map.cells, incoming, state.map.channels)
    if (spots.length === 0) {
      setMessage("Эту плитку сейчас некуда поставить.", "warn")
      return
    }
    const before = structuredClone(state.map.cells)
    const result = tryReplace(state.map.cells, x, y, incoming, state.map.channels)
    if (!result.ok) {
      setMessage(result.text, "warn")
    } else {
      state.historyMap.push(before)
      const mark = signature(incoming, state.map.channels)
      state.catalog = catalog(state.map.cells, state.map.channels)
      state.catalogIndex = state.catalog.findIndex((item) => signature(item, state.map.channels) === mark)
      setMessage(result.text, "good")
      renderTray()
    }
  }
  state.selectedCell = [x, y]
  renderDetail()
}

function changeObject(option) {
  if (!state.selectedCell) return
  const [x, y] = state.selectedCell
  state.historyMap.push(structuredClone(state.map.cells))
  const result = applyObject(state.map.cells, x, y, option)
  if (!result.ok) state.historyMap.pop()
  setMessage(result.text, result.ok ? "good" : "warn")
  renderDetail()
}

function undo() {
  if (state.level === 1) {
    const snap = state.history.pop()
    if (!snap) {
      setMessage("Отменять пока нечего.")
      return
    }
    state.board = snap.board
    state.tray = snap.tray
    state.selected = null
    setMessage("Ход отменён.")
    renderDynamic()
    return
  }
  const snap = state.historyMap.pop()
  if (!snap) {
    setMessage("Отменять пока нечего.")
    return
  }
  state.map.cells = snap
  state.catalog = catalog(state.map.cells, state.map.channels)
  setMessage("Правка отменена.")
  renderDynamic()
}

function resize() {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  state.cssW = Math.max(1, rect.width)
  state.cssH = Math.max(1, rect.height)
  canvas.width = Math.max(1, Math.floor(state.cssW * dpr))
  canvas.height = Math.max(1, Math.floor(state.cssH * dpr))
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function frame(now) {
  if (state.level > 1 && state.map) {
    if (state.playing) {
      const delta = now - (frame.last || now)
      frame.bank = (frame.bank || 0) + delta
      const step = 1000 / Number(speedInput.value || 14)
      while (frame.bank > step && state.reveal < state.map.revealOrder.length) {
        frame.bank -= step
        state.reveal += 1
      }
      if (state.reveal >= state.map.revealOrder.length) state.playing = false
    }
    frame.last = now
    drawMap(ctx, state.cssW, state.cssH, {
      map: state.map,
      view: state.view,
      reveal: state.reveal,
      showLabels: params[state.level].labels,
      level: state.level,
      selected: state.selectedCell,
      accepts: acceptSet(),
      channels: state.map.channels,
      extrude: LEVEL_PRESETS[state.level].extrude,
    })
    playButton.textContent = state.playing ? "Пауза" : "Пуск"
  }
  requestAnimationFrame(frame)
}

document.querySelectorAll("[data-level]").forEach((button) => {
  button.addEventListener("click", () => setLevel(Number(button.dataset.level)))
})

side.addEventListener("change", (event) => {
  readSide()
  if (event.target.id === "p-hints" || event.target.id === "p-labels") {
    renderDynamic()
    return
  }
  rebuild()
})

side.addEventListener("click", (event) => {
  const action = event.target.dataset?.action
  if (!action) return
  if (action === "undo") undo()
  if (action === "random" || action === "redeal") {
    params[state.level].seed = action === "random"
      ? Math.floor(Math.random() * 999983) + 1
      : (Number(params[state.level].seed) + 1) >>> 0
    renderSide()
    rebuild()
  }
})

document.querySelector("#to-start").addEventListener("click", () => {
  state.reveal = 0
  state.playing = false
})
document.querySelector("#step-back").addEventListener("click", () => {
  state.playing = false
  state.reveal = Math.max(0, state.reveal - 1)
})
document.querySelector("#step-forward").addEventListener("click", () => {
  state.playing = false
  if (state.map) state.reveal = Math.min(state.map.revealOrder.length, state.reveal + 1)
})
document.querySelector("#to-end").addEventListener("click", () => {
  state.playing = false
  if (state.map) state.reveal = state.map.revealOrder.length
})
playButton.addEventListener("click", () => {
  state.playing = !state.playing
  if (state.map && state.reveal >= state.map.revealOrder.length) state.reveal = 0
})
document.querySelector("#zoom-in").addEventListener("click", () => {
  state.view.zoom = Math.min(5, state.view.zoom * 1.2)
})
document.querySelector("#zoom-out").addEventListener("click", () => {
  state.view.zoom = Math.max(0.25, state.view.zoom / 1.2)
})

bindPointer(canvas, state.view, { onTap: onMapTap })
window.addEventListener("resize", resize)
window.addEventListener("keydown", (event) => {
  if (event.target.matches("input, select, textarea")) return
  if (state.level === 1) return
  if (event.code === "Space") {
    event.preventDefault()
    playButton.click()
  } else if (event.code === "ArrowRight") {
    event.preventDefault()
    document.querySelector("#step-forward").click()
  } else if (event.code === "ArrowLeft") {
    event.preventDefault()
    document.querySelector("#step-back").click()
  }
})

setLevel(1)
requestAnimationFrame(frame)
