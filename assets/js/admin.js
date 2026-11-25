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
const barNote = document.querySelector("#bar-note")
const tabs = document.querySelector("#tabs")
const sessionNode = document.querySelector("#session")
const panel = document.querySelector("#panel")
const batchBar = document.querySelector("#batch")
const batchStatus = document.querySelector("#batch-status")
const saveAllButton = document.querySelector("#save-all")

let api = null
const panes = new Map()
let batchBusy = false

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

function setBatchStatus(text, kind) {
  batchStatus.textContent = text
  batchStatus.className = `status ${kind || ""}`
}

async function ensurePane(name) {
  if (panes.has(name)) return panes.get(name)
  const host = document.createElement("div")
  host.className = "editor-pane"
  host.dataset.editor = name
  host.hidden = true
  panel.append(host)
  const entry = { host, instance: null, error: null, promise: null }
  panes.set(name, entry)
  entry.promise = (async () => {
    try {
      entry.instance = await editors[name](host, api)
    } catch (error) {
      entry.error = error
      host.textContent = error.message
    }
  })()
  return entry
}

async function openTab() {
  const name = currentTab()
  for (const link of tabs.querySelectorAll("a")) {
    if (link.dataset.tab === name) link.setAttribute("aria-current", "page")
    else link.removeAttribute("aria-current")
  }
  for (const entry of panes.values()) entry.host.hidden = true
  const entry = await ensurePane(name)
  await entry.promise
  entry.host.hidden = false
}

function fileLabel(path) {
  if (path === "data/schedule.json") return "schedule"
  if (path === "data/projects.json") return "projects"
  if (path === "data/materials.json") return "materials"
  if (path === "data/access.json") return "access"
  if (path.startsWith("materials/")) return "materials"
  return path
}

function fileLabelRu(path) {
  const labels = {
    schedule: "расписание",
    projects: "проекты",
    materials: "материалы",
    access: "доступ",
  }
  return labels[fileLabel(path)] || path
}

async function saveAll() {
  if (!api?.canWrite) {
    setBatchStatus("У этой учётной записи только чтение.", "bad")
    return
  }
  if (batchBusy) return
  batchBusy = true
  saveAllButton.disabled = true
  setBatchStatus("Собираем изменения…")
  try {
    const mounted = [...panes.values()].filter((entry) => entry.instance?.collectChanges)
    const bundles = []
    const files = new Map()
    for (const entry of mounted) {
      const bundle = await entry.instance.collectChanges()
      if (!bundle?.files?.length) continue
      bundles.push(bundle)
      for (const file of bundle.files) files.set(file.path, file)
    }
    if (files.size === 0) {
      setBatchStatus("Изменений нет — сохранять нечего.", "")
      return
    }
    const labels = [...new Set([...files.keys()].map(fileLabel))]
    const labelsRu = [...new Set([...files.keys()].map(fileLabelRu))]
    const result = await api.saveMany([...files.values()], `Update ${labels.join(", ")}`)
    for (const bundle of bundles) bundle.commit(result.files)
    setBatchStatus(`Сохранено одним коммитом: ${labelsRu.join(", ")}.`, "good")
  } catch (error) {
    setBatchStatus(error.message, "bad")
  } finally {
    batchBusy = false
    saveAllButton.disabled = false
  }
}

async function start(session) {
  api = createApi(session)
  loginPanel.hidden = true
  bar.hidden = false
  barNote.hidden = false
  batchBar.hidden = false
  panes.clear()
  panel.replaceChildren()
  saveAllButton.disabled = !api.canWrite
  setBatchStatus(api.canWrite ? "Можно сохранить несколько разделов одним коммитом." : "Только чтение: сохранение недоступно.", api.canWrite ? "" : "bad")
  renderSession(session)
  await openTab()
}

function showLogin(message) {
  loginPanel.hidden = false
  bar.hidden = true
  barNote.hidden = true
  batchBar.hidden = true
  panes.clear()
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

saveAllButton.addEventListener("click", saveAll)

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
