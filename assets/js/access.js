import { zonedToUtc } from "./schedule-data.js"

const DEFAULT_ZONE = "Asia/Tomsk"
const ACCESS_URL = new URL("../../data/access.json", import.meta.url)

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
    const response = await fetch(ACCESS_URL, { cache: "no-cache" })
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

function targetForNode(node) {
  if (node.dataset.gate) return String(node.dataset.gate).trim()
  if (!node.matches?.("a.card[href]")) return ""
  return String(node.getAttribute("href") || "").split("#")[0].trim()
}

function ensureGateNote(node) {
  let note = node.querySelector(".gate-note")
  if (!note) {
    note = document.createElement("p")
    note.className = "gate-note"
    node.append(note)
  }
  note.hidden = false
  return note
}

export async function applyGates(selector = "[data-gate], a.card[href]") {
  const gates = await loadGates()
  for (const node of document.querySelectorAll(selector)) {
    if (node.dataset.gateApplied === "true") continue
    const target = targetForNode(node)
    if (!target) continue
    const gate = gates.find((item) => item.target === target)
    if (!gate) continue
    if (gateState(gate).open) continue
    node.dataset.gateApplied = "true"
    node.classList.add("locked")
    node.setAttribute("aria-disabled", "true")

    const note = ensureGateNote(node)
    note.textContent = `Откроется ${gateLabel(gate)}`
    const showLock = (event) => {
      event.preventDefault()
      event.stopPropagation()
      note.textContent = `Откроется ${gateLabel(gate)}`
    }

    node.addEventListener("click", showLock)
    for (const link of node.querySelectorAll("a")) {
      link.setAttribute("aria-disabled", "true")
      link.addEventListener("click", showLock)
    }

    const tag = node.querySelector(".tag")
    if (tag) {
      tag.textContent = `Откроется ${gateLabel(gate)}`
      tag.classList.add("locked-tag")
    }
  }
}
