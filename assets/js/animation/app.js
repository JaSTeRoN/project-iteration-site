import { clamp, gaitPose, jumpStep, lerp } from "./motion.js"

const SVG_URL = new URL("../../brand/mascot_puppet.svg", import.meta.url)

const els = {
  stage: document.querySelector("#animation-stage"),
  host: document.querySelector("#puppet-host"),
  loading: document.querySelector("#animation-loading"),
  target: document.querySelector("#animation-target"),
  hint: document.querySelector("#animation-hint"),
  tabs: [...document.querySelectorAll("[role=tab]")],
  panels: [...document.querySelectorAll("[role=tabpanel]")],
  stepKicker: document.querySelector("#step-kicker"),
  stepTitle: document.querySelector("#step-title"),
  stepText: document.querySelector("#step-text"),
  stepFormula: document.querySelector("#step-formula"),
  stepNote: document.querySelector("#step-note"),
  stepOutput: document.querySelector("#step-output"),
  stepButtons: [...document.querySelectorAll("[data-step]")],
  stepPrev: document.querySelector("#step-prev"),
  stepNext: document.querySelector("#step-next"),
  stepReset: document.querySelector("#step-reset"),
  labSpeed: document.querySelector("#lab-speed"),
  labSpeedOut: document.querySelector("#lab-speed-output"),
  labStep: document.querySelector("#lab-step"),
  labStepOut: document.querySelector("#lab-step-output"),
  labSway: document.querySelector("#lab-sway"),
  labSwayOut: document.querySelector("#lab-sway-output"),
  labHead: document.querySelector("#lab-head"),
  labHeadOut: document.querySelector("#lab-head-output"),
  labBlink: document.querySelector("#lab-blink"),
  labBlinkOut: document.querySelector("#lab-blink-output"),
  labFollow: document.querySelector("#lab-follow"),
  labRig: document.querySelector("#lab-rig"),
  labPause: document.querySelector("#lab-pause"),
  labStats: document.querySelector("#lab-stats"),
  labJump: document.querySelector("#lab-jump"),
  labReset: document.querySelector("#lab-reset"),
}

const STEP_COPY = [
  {
    title: "Пивоты",
    text: "У каждой части есть точка вращения. Голова крутится вокруг шеи, руки — вокруг плеч, ноги — вокруг бёдер.",
    formula: "rotate(angle, pivotX, pivotY)",
    note: "Красным показаны пивоты и связи скелета.",
  },
  {
    title: "Фаза шага",
    text: "Ноги качаются в противофазе. Одна идёт вперёд, вторая назад; руки подхватывают ритм, корпус слегка подпрыгивает.",
    formula: "phase += speed · dt\nleft = sin(phase)\nright = sin(phase + π)",
    note: "Маскот идёт на месте: фаза крутится, курсор пока не нужен.",
  },
  {
    title: "Наклон и взгляд",
    text: "Корпус реагирует на направление, а голова и глаза тянутся к курсору. Это уже не механическая кукла, а персонаж.",
    formula: "head = lookAt(cursor)\nbody += velocity · lean",
    note: "Двигайте курсором по сцене — маскот следит за ним.",
  },
  {
    title: "Инерция",
    text: "Голова и руки запаздывают за корпусом, при остановке появляется мягкий overshoot. Движение становится живым.",
    formula: "target += (cursor - target) · ease\narm = -leg · 0.5",
    note: "Наведите курсор в другую сторону и отпустите — маскот догонит цель.",
  },
  {
    title: "Прыжок",
    text: "Прыжок — это отдельное состояние: импульс вверх, гравитация, приземление и короткий squash. Получается вес.",
    formula: "velocity += gravity · dt\ny += velocity · dt",
    note: "Кликните по сцене или нажмите «Прыжок».",
  },
]

const PIVOTS = {
  head: [450, 490],
  body: [450, 690],
  leftArm: [350, 525],
  rightArm: [550, 525],
  leftLeg: [397, 700],
  rightLeg: [503, 700],
  leftEye: [402, 293],
  rightEye: [497, 293],
}

let puppet = null
let svg = null
let root = null
let shadow = null
let guides = null
let level = 1
let step = 0
let last = performance.now()
let time = 0
let phase = 0
let mascotX = 0
let targetX = 0
let previousX = 0
let activity = 0
let jumpY = 0
let jumpVelocity = 0
let onGround = true
let landSquash = 0
let blinkTimer = 2.2
let blinkRemaining = 0
let lastStats = 0
let pointer = { x: 450, y: 300, active: false }
let params = {
  speed: 1,
  step: 18,
  sway: 5,
  head: 1,
  blink: 2.2,
  follow: true,
  rig: false,
  paused: false,
}

function setPart(element, rotation = 0, options = {}) {
  if (!element) return
  const [px, py] = options.pivot || [450, 450]
  const x = options.x || 0
  const y = options.y || 0
  const sx = options.sx ?? 1
  const sy = options.sy ?? 1
  element.setAttribute(
    "transform",
    `translate(${x} ${y}) translate(${px} ${py}) rotate(${rotation}) scale(${sx} ${sy}) translate(${-px} ${-py})`,
  )
}

function resetPose() {
  if (!puppet) return
  for (const element of Object.values(puppet)) element?.removeAttribute("transform")
  root?.removeAttribute("transform")
  shadow?.removeAttribute("transform")
  if (shadow) shadow.setAttribute("opacity", "0.35")
}

function resetMotion() {
  phase = 0
  mascotX = 0
  previousX = 0
  targetX = 0
  activity = 0
  jumpY = 0
  jumpVelocity = 0
  onGround = true
  landSquash = 0
  blinkTimer = params.blink
  blinkRemaining = 0
  resetPose()
}

function currentConfig() {
  if (level === 2) {
    return {
      follow: els.labFollow.checked,
      forceWalk: false,
      headFollow: Number(els.labHead.value),
      rig: els.labRig.checked,
      jump: true,
    }
  }
  return [
    { follow: false, forceWalk: false, headFollow: 0, rig: true, jump: false },
    { follow: false, forceWalk: true, headFollow: 0, rig: true, jump: false },
    { follow: false, forceWalk: false, headFollow: 1, rig: false, jump: false },
    { follow: true, forceWalk: false, headFollow: 1, rig: false, jump: false },
    { follow: true, forceWalk: false, headFollow: 1, rig: false, jump: true },
  ][step]
}

function pointerToSvg(event) {
  if (!svg) return { x: 450, y: 300 }
  const rect = svg.getBoundingClientRect()
  const size = Math.min(rect.width, rect.height)
  const left = rect.left + (rect.width - size) / 2
  const top = rect.top + (rect.height - size) / 2
  return {
    x: clamp(((event.clientX - left) / size) * 900, 0, 900),
    y: clamp(((event.clientY - top) / size) * 900, 0, 900),
  }
}

function updateTargetMarker(event) {
  const stageRect = els.stage.getBoundingClientRect()
  els.target.style.left = `${event.clientX - stageRect.left}px`
  els.target.style.top = `${event.clientY - stageRect.top}px`
  els.target.classList.add("visible")
}

function onPointerMove(event) {
  pointer = { ...pointerToSvg(event), active: true }
  updateTargetMarker(event)
  if (currentConfig().follow) {
    targetX = clamp((pointer.x - 450) * 0.75, -175, 175)
  }
}

function onPointerLeave() {
  pointer.active = false
  els.target.classList.remove("visible")
  if (currentConfig().follow) targetX = 0
}

function triggerJump() {
  if (!currentConfig().jump || !onGround) return
  jumpVelocity = -540
  onGround = false
}

function updateJump(dt) {
  if (onGround) return
  const result = jumpStep(jumpY, jumpVelocity, dt)
  jumpY = result.y
  jumpVelocity = result.velocity
  if (result.landed) {
    onGround = true
    landSquash = 0.22
  }
}

function updatePose(dt) {
  const cfg = currentConfig()
  if (guides) guides.style.display = cfg.rig ? "block" : "none"

  const follow = cfg.follow
  if (follow) {
    const smoothing = Math.min(1, dt * (3.2 + params.speed * 1.5))
    mascotX = lerp(mascotX, targetX, smoothing)
  } else {
    mascotX = lerp(mascotX, 0, Math.min(1, dt * 5))
  }

  const distance = Math.abs(targetX - mascotX)
  const moving = cfg.forceWalk || (follow && distance > 3)
  const desiredActivity = cfg.forceWalk ? 1 : moving ? clamp(0.25 + distance / 80, 0, 1) : 0
  activity = lerp(activity, desiredActivity, Math.min(1, dt * 9))

  const phaseSpeed = 2.2 + params.speed * 4.6
  phase += dt * phaseSpeed * (moving || cfg.forceWalk ? 1 : 0.28)

  if (onGround) {
    landSquash *= Math.exp(-dt * 9)
  }

  blinkTimer -= dt
  if (blinkTimer <= 0) {
    blinkRemaining = 0.12
    blinkTimer = params.blink * (0.75 + Math.random() * 0.6)
  }
  if (blinkRemaining > 0) blinkRemaining -= dt
  const blinkScale = blinkRemaining > 0 ? 0.08 : 1

  const gait = gaitPose(phase, params.step, params.step * 0.48)
  const gaitActivity = cfg.forceWalk ? 1 : activity
  const bob = gait.bob * params.step * 0.18 * gaitActivity + Math.sin(time * 1.8) * 1.2 * (1 - gaitActivity)
  const lean = clamp((targetX - mascotX) * 0.07 + Math.sin(phase) * params.sway * 0.16 * gaitActivity, -6, 6)
  const lookBase = pointer.active ? (pointer.x - (450 + mascotX)) / 180 : 0
  const lookX = clamp(lookBase, -1, 1) * cfg.headFollow
  const lookY = pointer.active ? clamp((pointer.y - (280 + jumpY)) / 180, -1, 1) * cfg.headFollow : 0

  let leftLeg = gait.leftLeg * gaitActivity
  let rightLeg = gait.rightLeg * gaitActivity
  let leftArm = gait.leftArm * gaitActivity
  let rightArm = gait.rightArm * gaitActivity
  let leftLift = Math.max(0, Math.sin(phase)) * params.step * 0.2 * gaitActivity
  let rightLift = Math.max(0, -Math.sin(phase)) * params.step * 0.2 * gaitActivity

  if (!onGround) {
    leftLeg = 14
    rightLeg = -14
    leftArm = -24
    rightArm = 24
    leftLift = 0
    rightLift = 0
  }

  const squash = landSquash
  const bodyScaleY = 1 - squash * 0.2 + (onGround ? 0 : 0.025)
  const bodyScaleX = 1 + squash * 0.13 - (onGround ? 0 : 0.015)

  previousX = mascotX

  if (root) root.setAttribute("transform", `translate(${mascotX} ${jumpY - bob})`)
  if (shadow) {
    const jumpHeight = Math.max(0, -jumpY)
    const shadowScale = clamp(1 - jumpHeight / 420, 0.58, 1)
    shadow.setAttribute(
      "transform",
      `translate(${mascotX} 0) translate(450 818) scale(${shadowScale} ${shadowScale * 0.8}) translate(-450 -818)`,
    )
    shadow.setAttribute("opacity", String(0.35 * shadowScale))
  }

  setPart(puppet.body, lean, { pivot: PIVOTS.body, sx: bodyScaleX, sy: bodyScaleY })
  setPart(puppet.head, lookX * 8 + Math.sin(time * 0.9) * 1.2, { pivot: PIVOTS.head, x: lookX * 3 })
  setPart(puppet.leftArm, leftArm + lean * 0.5, { pivot: PIVOTS.leftArm })
  setPart(puppet.rightArm, rightArm + lean * 0.5, { pivot: PIVOTS.rightArm })
  setPart(puppet.leftLeg, leftLeg, { pivot: PIVOTS.leftLeg, y: -leftLift })
  setPart(puppet.rightLeg, rightLeg, { pivot: PIVOTS.rightLeg, y: -rightLift })
  setPart(puppet.leftEye, 0, { pivot: PIVOTS.leftEye, x: lookX * 2.2, y: lookY * 1.5, sy: blinkScale })
  setPart(puppet.rightEye, 0, { pivot: PIVOTS.rightEye, x: lookX * 2.2, y: lookY * 1.5, sy: blinkScale })

  renderStats(moving, cfg)
}

function stateLabel(moving) {
  if (!onGround) return "Прыжок"
  if (moving) return params.speed > 1.35 ? "Бег" : "Идёт"
  return "Покой"
}

function renderStats(moving, cfg) {
  const now = performance.now()
  if (now - lastStats < 140) return
  lastStats = now
  const state = stateLabel(moving || cfg.forceWalk)
  if (level === 1) {
    els.stepOutput.textContent = `${state} · фаза ${phase.toFixed(1)} · ${activity > 0.15 ? "есть движение" : "статика"}`
  }
  els.labStats.innerHTML = [
    ["Состояние", state],
    ["Скорость", params.speed.toFixed(2)],
    ["Прыжок", onGround ? "на земле" : "в воздухе"],
  ]
    .map(([label, value]) => `<div class="animation-stat"><span>${label}</span><strong>${value}</strong></div>`)
    .join("")
}

function loop(now) {
  const dt = Math.min(0.04, (now - last) / 1000)
  last = now
  if (!params.paused) {
    time += dt
    updateJump(dt)
    updatePose(dt)
  }
  requestAnimationFrame(loop)
}

function updateStepUi() {
  const copy = STEP_COPY[step]
  els.stepKicker.textContent = `Шаг ${step + 1} из ${STEP_COPY.length}`
  els.stepTitle.textContent = copy.title
  els.stepText.textContent = copy.text
  els.stepFormula.textContent = copy.formula
  els.stepNote.textContent = copy.note
  els.stepButtons.forEach((button, index) => button.setAttribute("aria-pressed", String(index === step)))
  els.stepPrev.disabled = step === 0
  els.stepNext.textContent = step === STEP_COPY.length - 1 ? "В песочницу" : "Дальше"
  els.hint.textContent = copy.note
}

function setStep(next) {
  step = clamp(next, 0, STEP_COPY.length - 1)
  resetMotion()
  updateStepUi()
  if (level === 1) renderStats(false, currentConfig())
}

function setLevel(next) {
  level = next
  params.paused = level === 2 ? els.labPause.checked : false
  els.tabs.forEach((tab) => tab.setAttribute("aria-selected", String(Number(tab.dataset.level) === level)))
  els.panels.forEach((panel) => {
    panel.hidden = panel.id !== `panel-${level}`
  })
  if (level === 2) {
    els.hint.textContent = "Двигайте курсором по сцене · клик — прыжок"
    params.paused = els.labPause.checked
    resetMotion()
    updateStatsNow()
  } else {
    resetMotion()
    updateStepUi()
    updateStatsNow()
  }
}

function updateStatsNow() {
  lastStats = 0
  renderStats(activity > 0.1, currentConfig())
}

function syncLabOutputs() {
  els.labSpeedOut.textContent = Number(els.labSpeed.value).toFixed(1)
  els.labStepOut.textContent = els.labStep.value
  els.labSwayOut.textContent = els.labSway.value
  els.labHeadOut.textContent = `${Math.round(Number(els.labHead.value) * 100)}%`
  els.labBlinkOut.textContent = `${Number(els.labBlink.value).toFixed(1)} с`
}

function bindControls() {
  els.labSpeed.addEventListener("input", () => {
    params.speed = Number(els.labSpeed.value)
    syncLabOutputs()
  })
  els.labStep.addEventListener("input", () => {
    params.step = Number(els.labStep.value)
    syncLabOutputs()
  })
  els.labSway.addEventListener("input", () => {
    params.sway = Number(els.labSway.value)
    syncLabOutputs()
  })
  els.labHead.addEventListener("input", () => {
    params.head = Number(els.labHead.value)
    syncLabOutputs()
  })
  els.labBlink.addEventListener("input", () => {
    params.blink = Number(els.labBlink.value)
    syncLabOutputs()
  })
  els.labPause.addEventListener("change", () => {
    params.paused = els.labPause.checked
  })
  els.labJump.addEventListener("click", triggerJump)
  els.labReset.addEventListener("click", () => {
    resetMotion()
    updateStatsNow()
  })
  els.labFollow.addEventListener("change", () => {
    if (!els.labFollow.checked) targetX = 0
  })

  els.stepButtons.forEach((button) => {
    button.addEventListener("click", () => setStep(Number(button.dataset.step)))
  })
  els.stepPrev.addEventListener("click", () => setStep(step - 1))
  els.stepNext.addEventListener("click", () => {
    if (step === STEP_COPY.length - 1) setLevel(2)
    else setStep(step + 1)
  })
  els.stepReset.addEventListener("click", () => setStep(0))
  els.tabs.forEach((tab) => tab.addEventListener("click", () => setLevel(Number(tab.dataset.level))))

  els.stage.addEventListener("pointermove", onPointerMove)
  els.stage.addEventListener("pointerleave", onPointerLeave)
  els.stage.addEventListener("click", () => triggerJump())
}

async function boot() {
  try {
    const response = await fetch(SVG_URL)
    if (!response.ok) throw new Error(`SVG ${response.status}`)
    const markup = await response.text()
    els.host.innerHTML = markup
    els.loading?.remove()
    svg = els.host.querySelector("svg")
    svg.setAttribute("aria-hidden", "true")
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet")
    puppet = {
      head: els.host.querySelector("#head"),
      body: els.host.querySelector("#body"),
      leftArm: els.host.querySelector("#arm-left"),
      rightArm: els.host.querySelector("#arm-right"),
      leftLeg: els.host.querySelector("#leg-left"),
      rightLeg: els.host.querySelector("#leg-right"),
      leftEye: els.host.querySelector("#eye-left"),
      rightEye: els.host.querySelector("#eye-right"),
    }
    root = els.host.querySelector("#puppet-root")
    shadow = els.host.querySelector("#ground-shadow")
    guides = els.host.querySelector("#rig-guides")
    bindControls()
    syncLabOutputs()
    setLevel(1)
    setStep(0)
    requestAnimationFrame(loop)
  } catch (error) {
    if (els.loading) els.loading.textContent = "Не удалось загрузить куклу."
    console.error(error)
  }
}

boot()
