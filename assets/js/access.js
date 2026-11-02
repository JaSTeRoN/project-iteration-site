import { zonedToUtc } from "./schedule-data.js"

const DEFAULT_ZONE = "Asia/Tomsk"

export function gateInstant(gate) {
  const [date, time = "00:00"] = String(gate.open || "").split("T")
  if (!date) return null
  return zonedToUtc(date, time.slice(0, 5), gate.zone || DEFAULT_ZONE)
}

export function gateState(gate, now = new Date()) {
  const at = gateInstant(gate)
  if (!at) return { open: true, at: null }
  return { open: now.getTime() >= at.getTime(), at }
}

export function gateLabel(gate) {
  const at = gateInstant(gate)
  if (!at) return ""
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: gate.zone || DEFAULT_ZONE,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at)
}

export async function loadGates() {
  try {
    const response = await fetch("data/access.json", { cache: "no-cache" })
    if (!response.ok) return []
    const payload = await response.json()
    return Array.isArray(payload.gates) ? payload.gates : []
  } catch {
    return []
  }
}

function renderLock(root, gate) {
  root.replaceChildren()
  const card = document.createElement("article")
  card.className = "panel-card lock-card"
  const title = document.createElement("h1")
  title.textContent = "Откроется позже"
  const text = document.createElement("p")
  text.textContent = `Этот раздел станет доступен ${gateLabel(gate)} по томскому времени.`
  const back = document.createElement("a")
  back.href = "apps.html"
  back.className = "edit-link"
  back.textContent = "К приложениям"
  card.append(title, text, back)
  root.append(card)
}

export async function guardPage(target, root = document.querySelector("main")) {
  const gates = await loadGates()
  const gate = gates.find((item) => item.target === target)
  if (!gate) return true
  if (gateState(gate).open) return true
  if (root) renderLock(root, gate)
  return false
}

export async function applyGates(selector = "[data-gate]") {
  const gates = await loadGates()
  for (const node of document.querySelectorAll(selector)) {
    const gate = gates.find((item) => item.target === node.dataset.gate)
    if (!gate) continue
    if (gateState(gate).open) continue
    node.classList.add("locked")
    node.setAttribute("aria-disabled", "true")
    node.addEventListener("click", (event) => {
      event.preventDefault()
      const note = node.querySelector(".gate-note")
      if (note) note.textContent = `Откроется ${gateLabel(gate)}`
    })
    const tag = node.querySelector(".tag")
    if (tag) {
      tag.textContent = `Откроется ${gateLabel(gate)}`
      tag.classList.add("locked-tag")
    }
  }
}
