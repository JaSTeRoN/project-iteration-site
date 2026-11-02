import { clearSession, createApi, readSession, signIn, writeSession } from "./admin-api.js"
import { mountSchedule } from "./editors/schedule.js"
import { mountProjects } from "./editors/projects.js"
import { mountMaterials } from "./editors/materials.js"
import { mountAccess } from "./editors/access.js"

const editors = {
  schedule: mountSchedule,
  projects: mountProjects,
  materials: mountMaterials,
  access: mountAccess,
}

const loginPanel = document.querySelector("#login")
const loginStatus = document.querySelector("#login-status")
const tokenInput = document.querySelector("#token")
const signinButton = document.querySelector("#signin")
const bar = document.querySelector("#bar")
const tabs = document.querySelector("#tabs")
const sessionNode = document.querySelector("#session")
const panel = document.querySelector("#panel")

let api = null

function setStatus(node, text, kind) {
  node.textContent = text
  node.className = `status ${kind || ""}`
}

function renderSession(session) {
  sessionNode.replaceChildren()
  const who = document.createElement("span")
  who.textContent = session.login
  const rights = document.createElement("span")
  rights.className = "badge"
  rights.textContent =
    session.permission === "read" ? "только чтение" : `права: ${session.permission}`
  const out = document.createElement("button")
  out.type = "button"
  out.className = "quiet"
  out.textContent = "Выйти"
  out.addEventListener("click", () => {
    clearSession()
    location.reload()
  })
  sessionNode.append(who, rights, out)
}

function currentTab() {
  const name = location.hash.replace("#", "")
  return editors[name] ? name : "schedule"
}

async function openTab() {
  const name = currentTab()
  for (const link of tabs.querySelectorAll("a")) {
    if (link.dataset.tab === name) link.setAttribute("aria-current", "page")
    else link.removeAttribute("aria-current")
  }
  panel.replaceChildren()
  try {
    await editors[name](panel, api)
  } catch (error) {
    panel.textContent = error.message
  }
}

async function start(session) {
  api = createApi(session)
  loginPanel.hidden = true
  bar.hidden = false
  document.querySelector("#bar-note").hidden = false
  renderSession(session)
  await openTab()
}

function showLogin(message) {
  loginPanel.hidden = false
  bar.hidden = true
  document.querySelector("#bar-note").hidden = true
  panel.replaceChildren()
  if (message) setStatus(loginStatus, message, "bad")
  tokenInput.focus()
}

signinButton.addEventListener("click", async () => {
  const token = tokenInput.value.trim()
  if (!token) {
    setStatus(loginStatus, "Вставьте токен GitHub.", "bad")
    return
  }
  signinButton.disabled = true
  setStatus(loginStatus, "Проверяем токен…")
  try {
    const session = await signIn(token)
    writeSession(session)
    await start(readSession())
  } catch (error) {
    setStatus(loginStatus, error.message, "bad")
  } finally {
    signinButton.disabled = false
  }
})

window.addEventListener("hashchange", () => {
  if (api) openTab()
})

async function boot() {
  const session = readSession()
  if (!session) {
    showLogin()
    return
  }
  try {
    const fresh = await signIn(session.token)
    writeSession(fresh)
    await start(readSession())
  } catch {
    clearSession()
    showLogin("Сессия истекла — войдите заново.")
  }
}

boot()
