import {
  GENRES,
  LENGTHS,
  NODE_LABELS,
  RELATIONSHIPS,
  TONES,
  castOptions,
  generateStory,
  listEvents,
  replaceNode,
} from "./engine.js"

const SAMPLE = generateStory({
  seed: 37,
  genre: "fantasy",
  tone: "heroic",
  length: "medium",
  relationship: "friend",
})

const STEP_FORMULAS = [
  "квест → завязка",
  "квест → завязка + цель",
  "квест → завязка + цель + препятствие",
  "квест → завязка + цель + препятствие + помощник",
  "квест → завязка + цель + препятствие + помощник + ложный след",
  "квест → завязка + препятствие + развязка",
  "квест → завязка + препятствие + развязка + итог",
]

const NODE_POSITIONS = {
  call: [0.16, 0.13],
  goal: [0.48, 0.13],
  twist: [0.82, 0.13],
  helper: [0.16, 0.46],
  obstacle: [0.48, 0.46],
  falseLead: [0.82, 0.46],
  climax: [0.48, 0.79],
  resolution: [0.82, 0.79],
}

const NODE_COLORS = {
  call: "#3b82f6",
  goal: "#1f9d68",
  obstacle: "#d9743d",
  helper: "#7c5cff",
  falseLead: "#c2417a",
  twist: "#8b5cf6",
  climax: "#d64545",
  resolution: "#0e8a6a",
}

const EDGES = [
  ["call", "goal"],
  ["goal", "obstacle"],
  ["helper", "obstacle"],
  ["falseLead", "obstacle"],
  ["obstacle", "twist"],
  ["obstacle", "climax"],
  ["twist", "climax"],
  ["climax", "resolution"],
]

const els = {
  tabs: [...document.querySelectorAll("[data-level]")],
  level1: document.querySelector("#level-1"),
  level2: document.querySelector("#level-2"),
  stageLabel: document.querySelector("#stage-label"),
  stepKicker: document.querySelector("#step-kicker"),
  stepTitle: document.querySelector("#step-title"),
  stepText: document.querySelector("#step-text"),
  stepFormula: document.querySelector("#step-formula"),
  stepTrace: document.querySelector("#step-trace"),
  stepSeed: document.querySelector("#step-seed"),
  stepPrev: document.querySelector("#step-prev"),
  stepNext: document.querySelector("#step-next"),
  storyCanvas: document.querySelector("#story-canvas"),
  genre: document.querySelector("#lab-genre"),
  tone: document.querySelector("#lab-tone"),
  length: document.querySelector("#lab-length"),
  hero: document.querySelector("#lab-hero"),
  ally: document.querySelector("#lab-ally"),
  villain: document.querySelector("#lab-villain"),
  relationship: document.querySelector("#lab-relationship"),
  required: document.querySelector("#lab-required"),
  forbidden: document.querySelector("#lab-forbidden"),
  labRegen: document.querySelector("#lab-regen"),
  labReset: document.querySelector("#lab-reset"),
  labSeed: document.querySelector("#lab-seed"),
  labCanvas: document.querySelector("#lab-canvas"),
  labText: document.querySelector("#lab-text"),
  labTrace: document.querySelector("#lab-trace"),
  nodeBar: document.querySelector("#node-bar"),
  selectedLabel: document.querySelector("#selected-label"),
  selectedText: document.querySelector("#selected-text"),
  nodeReplace: document.querySelector("#node-replace"),
  nodeLock: document.querySelector("#node-lock"),
}

const state = {
  level: 1,
  step: 0,
  seed: 37,
  variant: 0,
  story: null,
  selected: null,
  locked: {},
  layouts: { story: [], lab: [] },
}

function fillSelect(select, options, value) {
  select.innerHTML = Object.entries(options)
    .map(([key, item]) => `<option value="${key}">${item.label}</option>`)
    .join("")
  if (value) select.value = value
}

function fillEntitySelect(select, list, value) {
  select.innerHTML = list
    .map((item) => `<option value="${item.name}">${item.role} ${item.name}</option>`)
    .join("")
  if (value && list.some((item) => item.name === value)) select.value = value
}

function refreshCast() {
  const options = castOptions(els.genre.value)
  fillEntitySelect(els.hero, options.heroes, els.hero.value)
  fillEntitySelect(els.ally, options.allies, els.ally.value)
  fillEntitySelect(els.villain, options.villains, els.villain.value)
}

function refreshEvents() {
  const events = listEvents(els.genre.value)
  const required = els.required.value
  const forbidden = els.forbidden.value
  const html = `<option value="">— не задано —</option>${events.map((event) => `<option value="${event}">${event}</option>`).join("")}`
  els.required.innerHTML = html
  els.forbidden.innerHTML = html
  if (events.includes(required)) els.required.value = required
  if (events.includes(forbidden)) els.forbidden.value = forbidden
}

function initControls() {
  fillSelect(els.genre, GENRES, "fantasy")
  fillSelect(els.tone, TONES, "heroic")
  fillSelect(els.length, LENGTHS, "medium")
  fillSelect(els.relationship, RELATIONSHIPS, "friend")
  refreshCast()
  refreshEvents()
}

function readOptions() {
  return {
    genre: els.genre.value,
    tone: els.tone.value,
    length: els.length.value,
    relationship: els.relationship.value,
    cast: {
      hero: els.hero.value,
      ally: els.ally.value,
      villain: els.villain.value,
    },
    requiredEvent: els.required.value,
    forbiddenEvent: els.forbidden.value,
  }
}

function syncLockedFromStory() {
  state.locked = {}
  for (const node of state.story.nodes) {
    if (node.locked) state.locked[node.type] = { ...node }
  }
}

function regenerate({ newSeed = true, preserveLocks = true } = {}) {
  if (newSeed) state.seed += 1
  state.story = generateStory({
    ...readOptions(),
    seed: state.seed,
    locked: preserveLocks ? state.locked : {},
  })
  if (!preserveLocks) state.locked = {}
  syncLockedFromStory()
  if (state.selected && !state.story.nodes.some((node) => node.type === state.selected)) {
    state.selected = null
  }
  renderLab()
}

function ensureStory() {
  if (!state.story) regenerate({ newSeed: false, preserveLocks: false })
}

function selectNode(type) {
  state.selected = type
  renderLab()
}

function renderTraceItems(entries) {
  return entries
    .map((entry) => `<div class="narrative-trace-item"><strong>${entry.rule}</strong>${entry.detail}</div>`)
    .join("")
}

function updateStep() {
  const node = SAMPLE.nodes[state.step]
  if (!node) return
  els.stepKicker.textContent = `Шаг ${state.step + 1} из ${SAMPLE.nodes.length}`
  els.stepTitle.textContent = node.label
  els.stepText.textContent = node.text
  els.stepFormula.textContent = STEP_FORMULAS[state.step] || STEP_FORMULAS[STEP_FORMULAS.length - 1]
  const trace = SAMPLE.trace.slice(0, state.step + 1)
  els.stepTrace.innerHTML = renderTraceItems(trace)
  els.stepSeed.textContent = `Сид ${SAMPLE.seed} · фэнтези · героический`
  els.stageLabel.textContent = `Пример: «${SAMPLE.title}»`
  els.stepPrev.disabled = state.step === 0
  els.stepNext.textContent = state.step === SAMPLE.nodes.length - 1 ? "В песочницу" : "Дальше"
  drawGraph(els.storyCanvas, SAMPLE.nodes, "story", state.step)
}

function renderLab() {
  ensureStory()
  const story = state.story
  els.labSeed.textContent = `сид ${story.seed}`
  els.labText.innerHTML = ""
  const title = document.createElement("h3")
  title.textContent = story.title
  els.labText.append(title)
  for (const node of story.nodes) {
    const paragraph = document.createElement("p")
    paragraph.dataset.type = node.type
    paragraph.className = state.selected === node.type ? "selected" : ""
    paragraph.innerHTML = `<strong>${node.label}</strong>${node.text}`
    paragraph.addEventListener("click", () => selectNode(node.type))
    els.labText.append(paragraph)
  }
  els.labTrace.innerHTML = ""
  for (const entry of story.trace) {
    const item = document.createElement("div")
    item.className = `narrative-rule-item${story.nodes.find((node) => node.type === entry.node)?.locked ? " locked" : ""}`
    item.dataset.type = entry.node
    item.innerHTML = `<strong>${entry.rule}</strong>${entry.detail}`
    item.addEventListener("click", () => selectNode(entry.node))
    els.labTrace.append(item)
  }
  const selected = story.nodes.find((node) => node.type === state.selected)
  if (!selected) {
    state.selected = null
    els.nodeBar.hidden = true
  } else {
    els.nodeBar.hidden = false
    els.selectedLabel.textContent = `${selected.label}${selected.locked ? " · закреплён" : ""}`
    els.selectedText.textContent = selected.text
    els.nodeLock.textContent = selected.locked ? "Освободить" : "Закрепить"
    els.nodeReplace.disabled = Boolean(selected.locked)
  }
  drawGraph(els.labCanvas, story.nodes, "lab")
}

function setLevel(level) {
  state.level = level
  els.tabs.forEach((tab) => {
    const selected = Number(tab.dataset.level) === level
    tab.setAttribute("aria-selected", String(selected))
  })
  els.level1.hidden = level !== 1
  els.level2.hidden = level !== 2
  if (level === 1) updateStep()
  else renderLab()
}

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr
    canvas.height = height * dpr
  }
  const ctx = canvas.getContext("2d")
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w: width, h: height }
}

function roundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function boundaryPoint(rect, dx, dy) {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  if (!dx && !dy) return { x: cx, y: cy }
  const tx = dx > 0 ? (rect.x + rect.w - cx) / dx : dx < 0 ? (rect.x - cx) / dx : Infinity
  const ty = dy > 0 ? (rect.y + rect.h - cy) / dy : dy < 0 ? (rect.y - cy) / dy : Infinity
  const t = Math.min(tx, ty)
  return { x: cx + dx * t, y: cy + dy * t }
}

function drawArrow(ctx, fromRect, toRect, alpha, color) {
  const fromX = fromRect.x + fromRect.w / 2
  const fromY = fromRect.y + fromRect.h / 2
  const toX = toRect.x + toRect.w / 2
  const toY = toRect.y + toRect.h / 2
  const distance = Math.hypot(toX - fromX, toY - fromY)
  if (distance < 1) return
  const dx = (toX - fromX) / distance
  const dy = (toY - fromY) / distance
  const start = boundaryPoint(fromRect, dx, dy)
  const end = boundaryPoint(toRect, -dx, -dy)
  const angle = Math.atan2(dy, dx)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(end.x, end.y)
  ctx.lineTo(end.x - Math.cos(angle - 0.45) * 9, end.y - Math.sin(angle - 0.45) * 9)
  ctx.lineTo(end.x - Math.cos(angle + 0.45) * 9, end.y - Math.sin(angle + 0.45) * 9)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function nodeRectFor(pos, w, h) {
  const nodeW = Math.max(104, Math.min(150, w * 0.3))
  const nodeH = 60
  return {
    x: w * pos[0] - nodeW / 2,
    y: h * pos[1] - nodeH / 2,
    w: nodeW,
    h: nodeH,
  }
}

function nodePosition(type, w, h) {
  const pos = NODE_POSITIONS[type] || [0.5, 0.5]
  const shift = h < 430 ? 0.07 : 0
  return { x: w * pos[0], y: h * (pos[1] + shift) }
}

function drawGraph(canvas, nodes, mode, step = 0) {
  const { ctx, w, h } = fitCanvas(canvas)
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = "#eaf1f9"
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = "rgba(20, 45, 75, 0.08)"
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 28) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = 0; y < h; y += 28) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  const positions = {}
  const rects = []
  const rectMap = {}
  for (const [index, node] of nodes.entries()) {
    const center = nodePosition(node.type, w, h)
    const rect = nodeRectFor([center.x / w, center.y / h], w, h)
    positions[node.type] = center
    rectMap[node.type] = { ...rect, type: node.type, index }
    rects.push(rectMap[node.type])
  }
  for (const [from, to] of EDGES) {
    if (!positions[from] || !positions[to]) continue
    const fromIndex = nodes.findIndex((node) => node.type === from)
    const toIndex = nodes.findIndex((node) => node.type === to)
    if (mode === "story" && (fromIndex > step || toIndex > step)) continue
    drawArrow(ctx, rectMap[from], rectMap[to], 0.55, "#55718d")
  }

  for (const [index, node] of nodes.entries()) {
    const rect = rectMap[node.type]
    const dimmed = mode === "story" && index > step
    const current = mode === "story" && index === step
    const selected = mode === "lab" && state.selected === node.type
    const color = NODE_COLORS[node.type] || "#55718d"
    ctx.save()
    ctx.globalAlpha = dimmed ? 0.25 : 1
    if (selected || current) {
      ctx.shadowColor = "rgba(20, 80, 50, 0.28)"
      ctx.shadowBlur = 16
    }
    roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10)
    ctx.fillStyle = "#fbfdff"
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = selected || current ? "#146b3a" : color
    ctx.lineWidth = selected || current ? 3 : 1.5
    ctx.stroke()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(rect.x + 15, rect.y + 17, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#1d344c"
    ctx.font = `800 ${w < 420 ? 11 : 12}px Manrope, system-ui, sans-serif`
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillText(node.label, rect.x + 23, rect.y + 18)
    ctx.fillStyle = "#6a8096"
    ctx.font = "600 9px Manrope, system-ui, sans-serif"
    ctx.fillText(node.type, rect.x + 13, rect.y + 38)
    if (node.locked) {
      ctx.fillStyle = "#a0611d"
      ctx.font = "700 10px Manrope, system-ui, sans-serif"
      ctx.fillText("закреплён", rect.x + 13, rect.y + 51)
    }
    ctx.restore()
  }
  state.layouts[mode] = rects
}

function hitNode(mode, event, canvas) {
  const rect = canvas.getBoundingClientRect()
  const x = (event.clientX - rect.left) * (canvas.width / (window.devicePixelRatio || 1) / rect.width)
  const y = (event.clientY - rect.top) * (canvas.height / (window.devicePixelRatio || 1) / rect.height)
  return state.layouts[mode].find((node) => x >= node.x && x <= node.x + node.w && y >= node.y && y <= node.y + node.h)
}

function bindControls() {
  els.stepPrev.addEventListener("click", () => {
    state.step = Math.max(0, state.step - 1)
    updateStep()
  })
  els.stepNext.addEventListener("click", () => {
    if (state.step >= SAMPLE.nodes.length - 1) setLevel(2)
    else {
      state.step += 1
      updateStep()
    }
  })
  els.tabs.forEach((tab) => tab.addEventListener("click", () => setLevel(Number(tab.dataset.level))))

  els.genre.addEventListener("change", () => {
    state.locked = {}
    state.selected = null
    refreshCast()
    refreshEvents()
    regenerate()
  })
  for (const select of [els.tone, els.length, els.hero, els.ally, els.villain, els.relationship, els.required, els.forbidden]) {
    select.addEventListener("change", () => regenerate())
  }
  els.labRegen.addEventListener("click", () => regenerate())
  els.labReset.addEventListener("click", () => {
    els.genre.value = "fantasy"
    els.tone.value = "heroic"
    els.length.value = "medium"
    els.relationship.value = "friend"
    refreshCast()
    refreshEvents()
    els.required.value = ""
    els.forbidden.value = ""
    state.seed = 37
    state.variant = 0
    state.locked = {}
    state.selected = null
    regenerate({ newSeed: false, preserveLocks: false })
  })

  els.nodeLock.addEventListener("click", () => {
    const node = state.story?.nodes.find((item) => item.type === state.selected)
    if (!node) return
    if (node.locked) {
      delete state.locked[node.type]
      node.locked = false
    } else {
      node.locked = true
      state.locked[node.type] = { ...node }
    }
    renderLab()
  })
  els.nodeReplace.addEventListener("click", () => {
    const type = state.selected
    const node = state.story?.nodes.find((item) => item.type === type)
    if (!type || !node || node.locked) return
    state.seed += 1
    state.variant += 1
    const generated = replaceNode(state.story, type, state.seed)
    const replacement = generated.nodes.find((item) => item.type === type)
    if (!replacement) return
    state.story.nodes = state.story.nodes.map((item) =>
      item.type === type ? { ...replacement, locked: false } : item,
    )
    state.story.trace = state.story.trace.map((entry) =>
      entry.node === type
        ? { ...entry, detail: "Узел перегенерирован вручную; остальные узлы сохранены." }
        : entry,
    )
    renderLab()
  })

  els.storyCanvas.addEventListener("click", (event) => {
    const hit = hitNode("story", event, els.storyCanvas)
    if (!hit) return
    state.step = hit.index
    updateStep()
  })
  els.labCanvas.addEventListener("click", (event) => {
    const hit = hitNode("lab", event, els.labCanvas)
    if (hit) selectNode(hit.type)
  })
  window.addEventListener("resize", () => {
    if (state.level === 1) updateStep()
    else renderLab()
  })
}

initControls()
bindControls()
updateStep()
