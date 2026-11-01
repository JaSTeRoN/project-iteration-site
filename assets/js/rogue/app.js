import { bindPointer } from "../camera.js"
import { findStairs, generateDungeon, isPassable, playback } from "./generate.js"
import { cellAt, drawDungeon, fitDungeon } from "./render.js"

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
const caption = document.querySelector("#caption")
const message = document.querySelector("#message")
const canvas = document.querySelector("#map")
const side = document.querySelector("#side")
const playButton = document.querySelector("#play")
const speedInput = document.querySelector("#speed")
const ctx = canvas.getContext("2d")

const params = {
  seed: 1,
  cols: 3,
  rows: 3,
  roomChance: 78,
  minRoomW: 4,
  minRoomH: 3,
  maxRoomW: 8,
  maxRoomH: 6,
  extraChance: 18,
  loot: true,
  style: "scheme",
  sectors: true,
}

const state = {
  dungeon: null,
  index: 0,
  frame: null,
  playing: false,
  view: { camX: 0, camY: 0, zoom: 1, cell: 18 },
  player: null,
  cssW: 1,
  cssH: 1,
}

const READY = "Уровень готов. Можно ходить стрелками, WASD или крестом."

function setMessage(text) {
  message.textContent = text
}

function field(id, label, value, min, max) {
  return `<label class="field">${label}<input id="p-${id}" type="number" min="${min}" max="${max}" value="${value}"></label>`
}

function renderSide() {
  side.innerHTML = `<h2>Параметры</h2>
    ${field("seed", "Сид", params.seed, 1, 999999)}
    ${field("cols", "Столбцов секторов", params.cols, 2, 5)}
    ${field("rows", "Рядов секторов", params.rows, 2, 4)}
    ${field("roomChance", "Вероятность комнаты, %", params.roomChance, 0, 100)}
    ${field("minRoomW", "Мин. ширина комнаты", params.minRoomW, 3, 10)}
    ${field("minRoomH", "Мин. высота комнаты", params.minRoomH, 3, 8)}
    ${field("maxRoomW", "Макс. ширина комнаты", params.maxRoomW, 4, 12)}
    ${field("maxRoomH", "Макс. высота комнаты", params.maxRoomH, 3, 10)}
    ${field("extraChance", "Лишний коридор, %", params.extraChance, 0, 100)}
    <label class="check"><input id="p-loot" type="checkbox" ${params.loot ? "checked" : ""}> Добыча после геометрии</label>
    <label class="check"><input id="p-sectors" type="checkbox" ${params.sectors ? "checked" : ""}> Сетка секторов</label>
    <label class="field">Вид
      <select id="p-style">
        <option value="scheme" ${params.style === "scheme" ? "selected" : ""}>Схема</option>
        <option value="terminal" ${params.style === "terminal" ? "selected" : ""}>Терминал</option>
      </select>
    </label>
    <div class="row"><button type="button" id="random">Случайный сид</button></div>
    <p class="explain">В оригинале секторов 3×3. Пустая клетка сетки всё равно участвует в проходах. Коридор копается уголком.</p>`
}

function readSide() {
  for (const key of Object.keys(params)) {
    const input = side.querySelector(`#p-${key}`)
    if (!input) continue
    if (input.type === "checkbox") params[key] = input.checked
    else if (input.tagName === "SELECT") params[key] = input.value
    else params[key] = Number(input.value)
  }
  if (params.minRoomW > params.maxRoomW) params.maxRoomW = params.minRoomW
  if (params.minRoomH > params.maxRoomH) params.maxRoomH = params.minRoomH
}

function rebuild() {
  state.dungeon = generateDungeon({
    seed: params.seed >>> 0,
    cols: params.cols,
    rows: params.rows,
    roomChance: params.roomChance / 100,
    minRoomW: params.minRoomW,
    minRoomH: params.minRoomH,
    maxRoomW: params.maxRoomW,
    maxRoomH: params.maxRoomH,
    extraChance: params.extraChance / 100,
    loot: params.loot,
  })
  state.index = 0
  state.player = null
  state.playing = !reduced
  frame.bank = 0
  state.frame = playback(state.dungeon, 0)
  const rect = canvas.getBoundingClientRect()
  Object.assign(state.view, fitDungeon(state.dungeon, rect.width || 640, rect.height || 360))
  setMessage(reduced ? "Шаги ждут кнопки «пуск» или «шаг вперёд»." : "Генерация идёт. Её можно остановить и листать по шагам.")
}

function syncPlayer() {
  state.frame = playback(state.dungeon, state.index)
  caption.textContent = state.frame.caption
  if (!state.frame.done) {
    state.player = null
    return
  }
  if (!state.player) {
    const up = findStairs(state.frame.grid, "up")
    if (up) state.player = { x: up.x, y: up.y }
  }
}

function tryMove(direction) {
  if (!state.frame?.done || !state.player) {
    setMessage("Сначала досмотрите генерацию или нажмите «в конец».")
    return
  }
  const delta = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[direction]
  const x = state.player.x + delta[0]
  const y = state.player.y + delta[1]
  const grid = state.frame.grid
  if (y < 0 || x < 0 || y >= grid.length || x >= grid[0].length || !isPassable(grid[y][x])) {
    setMessage("Стена. Ходить можно по полу комнаты, коридору и дверям.")
    return
  }
  state.player.x = x
  state.player.y = y
  const cell = grid[y][x]
  if (cell.stairs === "up") setMessage("Лестница вверх.")
  else if (cell.stairs === "down") setMessage("Лестница вниз.")
  else if (cell.gold) setMessage("Добыча. На форму коридоров она не влияет.")
  else if (cell.kind === "door") setMessage("Дверь: сюда коридор вошёл в комнату.")
  else setMessage("")
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
  let finished = false
  if (state.dungeon && state.playing) {
    const delta = now - (frame.last || now)
    frame.bank = (frame.bank || 0) + delta
    const step = 1000 / Number(speedInput.value || 28)
    while (frame.bank > step && state.index < state.dungeon.events.length) {
      frame.bank -= step
      state.index += 1
    }
    if (state.index >= state.dungeon.events.length) {
      state.playing = false
      finished = true
    }
  }
  frame.last = now
  if (state.dungeon) {
    syncPlayer()
    drawDungeon(ctx, state.cssW, state.cssH, {
      dungeon: state.dungeon,
      view: state.view,
      frame: state.frame,
      style: params.style,
      showSectors: params.sectors,
      player: state.player,
    })
  }
  if (finished) setMessage(READY)
  playButton.textContent = state.playing ? "Пауза" : "Пуск"
  requestAnimationFrame(frame)
}

side.addEventListener("change", () => {
  readSide()
  renderSide()
  rebuild()
})
side.addEventListener("click", (event) => {
  if (event.target.id !== "random") return
  params.seed = Math.floor(Math.random() * 999983) + 1
  renderSide()
  rebuild()
})

function showFrame() {
  syncPlayer()
  caption.textContent = state.frame.caption
}

document.querySelector("#to-start").addEventListener("click", () => {
  state.index = 0
  state.playing = false
  state.player = null
  showFrame()
  setMessage("")
})
document.querySelector("#step-back").addEventListener("click", () => {
  state.playing = false
  state.player = null
  state.index = Math.max(0, state.index - 1)
  showFrame()
  setMessage("")
})
document.querySelector("#step-forward").addEventListener("click", () => {
  state.playing = false
  const before = state.index
  state.index = Math.min(state.dungeon.events.length, state.index + 1)
  showFrame()
  if (state.frame.done && before < state.dungeon.events.length) setMessage(READY)
  else setMessage("")
})
document.querySelector("#to-end").addEventListener("click", () => {
  state.playing = false
  state.index = state.dungeon.events.length
  showFrame()
  setMessage(READY)
})
playButton.addEventListener("click", () => {
  if (state.index >= state.dungeon.events.length) {
    state.index = 0
    state.player = null
  }
  state.playing = !state.playing
  if (state.playing) setMessage("Генерация идёт. Её можно остановить и листать по шагам.")
  else if (!state.frame?.done) setMessage("")
})
document.querySelector("#zoom-in").addEventListener("click", () => {
  state.view.zoom = Math.min(5, state.view.zoom * 1.2)
})
document.querySelector("#zoom-out").addEventListener("click", () => {
  state.view.zoom = Math.max(0.15, state.view.zoom / 1.2)
})
document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("click", () => tryMove(button.dataset.dir))
})

bindPointer(canvas, state.view, {
  onSwipe: tryMove,
  onTap: (sx, sy) => {
    const hit = cellAt(state.view, sx, sy, state.cssW, state.cssH, state.dungeon)
    if (!hit || !state.frame) return
    const cell = state.frame.grid[hit[1]][hit[0]]
    const kind = { wall: "порода", room: "пол комнаты", corridor: "коридор", door: "дверь" }[cell.kind]
    setMessage(`${kind}. ${cell.stairs === "up" ? "Лестница вверх." : cell.stairs === "down" ? "Лестница вниз." : cell.gold ? "Здесь добыча." : ""}`.trim())
  },
})

window.addEventListener("resize", resize)
window.addEventListener("keydown", (event) => {
  if (event.target.matches("input, select, textarea")) return
  const move = { ArrowUp: "n", ArrowDown: "s", ArrowLeft: "w", ArrowRight: "e", KeyW: "n", KeyA: "w", KeyS: "s", KeyD: "e" }
  if (move[event.code]) {
    event.preventDefault()
    tryMove(move[event.code])
    return
  }
  if (event.code === "Space") {
    event.preventDefault()
    playButton.click()
  }
})

renderSide()
rebuild()
resize()
Object.assign(state.view, fitDungeon(state.dungeon, state.cssW, state.cssH))
requestAnimationFrame(frame)
