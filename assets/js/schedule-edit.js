import { KINDS, blankWeek, dayTitle, mondayOf, pickWeek, todayIn } from "./schedule-data.js"

const REPO = "JaSTeRoN/project-iteration-site"
const FILE = "data/schedule.json"
const BRANCH = "main"
const TOKEN_KEY = "iteration-schedule-token"

const form = document.querySelector("#editor")
const statusNode = document.querySelector("#edit-status")
const tokenInput = document.querySelector("#token")
const weekSelect = document.querySelector("#week")
const weekDate = document.querySelector("#week-date")

let data = null
let fileSha = ""
let baseline = ""
let weekIndex = 0

function setStatus(text, kind) {
  statusNode.textContent = text
  statusNode.className = `status ${kind || ""}`
}

function eventRow(event) {
  const row = document.createElement("div")
  row.className = "event-edit"
  const time = document.createElement("input")
  time.type = "time"
  time.value = event.time || ""
  time.required = true
  const kind = document.createElement("select")
  for (const [value, label] of Object.entries(KINDS)) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = label
    option.selected = event.kind === value
    kind.append(option)
  }
  const place = document.createElement("input")
  place.type = "text"
  place.placeholder = "Аудитория"
  place.value = event.place || ""
  const link = document.createElement("input")
  link.type = "url"
  link.placeholder = "Ссылка https://…"
  link.value = event.link || ""
  const remove = document.createElement("button")
  remove.type = "button"
  remove.className = "quiet"
  remove.textContent = "Удалить"
  remove.addEventListener("click", () => row.remove())
  const main = document.createElement("div")
  main.className = "event-edit-row"
  main.append(time, kind)
  const extra = document.createElement("div")
  extra.className = "event-edit-row"
  extra.append(place, link, remove)
  row.append(main, extra)
  return row
}

function readEvents(box) {
  return [...box.querySelectorAll(".event-edit")].map((row) => {
    const [time, kind, place, link] = row.querySelectorAll("input, select")
    return {
      time: time.value,
      kind: kind.value,
      place: place.value.trim(),
      link: link.value.trim(),
    }
  }).filter((event) => event.time)
}

function captureForm() {
  if (!data) return
  const week = data.weeks[weekIndex]
  if (!week) return
  for (const day of week.days) {
    for (const zone of data.zones) {
      const box = form.querySelector(`[data-date="${day.date}"][data-zone="${zone.id}"]`)
      if (box) day[zone.id] = readEvents(box)
    }
  }
}

function renderEditor() {
  const week = data.weeks[weekIndex]
  weekSelect.replaceChildren()
  data.weeks.forEach((item, index) => {
    const option = document.createElement("option")
    option.value = String(index)
    option.textContent = `${item.start} — ${item.days.at(-1)?.date || ""}`
    option.selected = index === weekIndex
    weekSelect.append(option)
  })
  const host = document.querySelector("#week-body")
  host.replaceChildren()
  if (!week) {
    const empty = document.createElement("p")
    empty.className = "editor-card day-empty"
    empty.textContent = "Недель пока нет. Выберите дату и нажмите «Добавить неделю»."
    host.append(empty)
    return
  }
  for (const zone of data.zones) {
    const card = document.createElement("section")
    card.className = "editor-card"
    const title = document.createElement("h2")
    title.textContent = zone.title
    const grid = document.createElement("div")
    grid.className = "days-edit"
    for (const day of week.days) {
      const column = document.createElement("section")
      column.className = "day-edit"
      column.dataset.date = day.date
      column.dataset.zone = zone.id
      const heading = document.createElement("h3")
      heading.textContent = dayTitle(day.date)
      const list = document.createElement("div")
      for (const event of day[zone.id] || []) list.append(eventRow(event))
      const add = document.createElement("button")
      add.type = "button"
      add.className = "quiet"
      add.textContent = "Добавить занятие"
      add.addEventListener("click", () => {
        list.append(eventRow({ time: "12:00", kind: "remote", place: "", link: "" }))
      })
      column.append(heading, list, add)
      grid.append(column)
    }
    card.append(title, grid)
    host.append(card)
  }
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${tokenInput.value.trim()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  }
}

function githubError(status) {
  if (status === 401) return "GitHub ответил 401: токен не подошёл или истёк."
  if (status === 403) return "GitHub ответил 403: токену не хватает права Contents: Read and write."
  if (status === 404) return "GitHub ответил 404: нет доступа к файлу или его нет в репозитории."
  if (status === 409) return "Файл на GitHub успели изменить. Нажмите «Загрузить с GitHub» и повторите правку."
  if (status === 422) return "GitHub ответил 422: проверьте права токена на содержимое репозитория."
  return `GitHub ответил ${status}.`
}

async function readRemoteFile() {
  const response = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`, {
    headers: githubHeaders(),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(githubError(response.status))
  const payload = await response.json()
  const text = new TextDecoder().decode(Uint8Array.from(atob(payload.content.replace(/\n/g, "")), (char) => char.charCodeAt(0)))
  return { sha: payload.sha, data: JSON.parse(text) }
}

async function ensureFileSha() {
  if (fileSha) return
  const remote = await readRemoteFile()
  if (!remote) return
  if (baseline && JSON.stringify(remote.data) !== baseline) {
    throw new Error("На GitHub уже другая версия расписания. Нажмите «Загрузить с GitHub», чтобы не затереть чужие правки.")
  }
  fileSha = remote.sha
}

async function loadFromGithub() {
  const token = tokenInput.value.trim()
  if (!token) {
    setStatus("Вставьте токен GitHub, чтобы загрузить последнюю версию.", "bad")
    return
  }
  const remote = await readRemoteFile()
  if (!remote) {
    setStatus("В репозитории нет файла data/schedule.json.", "bad")
    return
  }
  fileSha = remote.sha
  data = remote.data
  baseline = JSON.stringify(data)
  const current = pickWeek(data.weeks || [], todayIn("Asia/Tomsk"))
  weekIndex = current ? Math.max(0, data.weeks.indexOf(current)) : 0
  renderEditor()
  setStatus("Загружено из репозитория.", "good")
}

async function saveToGithub() {
  const token = tokenInput.value.trim()
  if (!token) {
    setStatus("Без токена сохранить на сайт нельзя. Можно скачать JSON и заменить файл вручную.", "bad")
    return
  }
  if (!data) {
    setStatus("Сначала загрузите расписание.", "bad")
    return
  }
  captureForm()
  await ensureFileSha()
  const content = btoa(String.fromCharCode(...new TextEncoder().encode(`${JSON.stringify(data, null, 2)}\n`)))
  const response = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, {
    method: "PUT",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Update schedule",
      content,
      sha: fileSha || undefined,
      branch: BRANCH,
    }),
  })
  if (!response.ok) throw new Error(githubError(response.status))
  const payload = await response.json()
  fileSha = payload.content.sha
  baseline = JSON.stringify(data)
  setStatus("Сохранено. На сайте появится через минуту, когда GitHub Pages обновит страницу.", "good")
}

function downloadJson() {
  if (!data) {
    setStatus("Сначала загрузите расписание.", "bad")
    return
  }
  captureForm()
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = "schedule.json"
  link.click()
  URL.revokeObjectURL(link.href)
}

async function main() {
  tokenInput.value = sessionStorage.getItem(TOKEN_KEY) || ""
  const response = await fetch("data/schedule.json", { cache: "no-cache" })
  data = await response.json()
  baseline = JSON.stringify(data)
  const current = pickWeek(data.weeks || [], todayIn("Asia/Tomsk"))
  weekIndex = current ? Math.max(0, data.weeks.indexOf(current)) : Math.max(0, data.weeks.length - 1)
  renderEditor()
  document.querySelector("#remember").addEventListener("click", () => {
    sessionStorage.setItem(TOKEN_KEY, tokenInput.value.trim())
    setStatus("Токен запомнен только в этом браузере и пропадёт, когда закроете вкладку.", "good")
  })
  document.querySelector("#load").addEventListener("click", () => {
    loadFromGithub().catch((error) => setStatus(error.message, "bad"))
  })
  document.querySelector("#save").addEventListener("click", () => {
    saveToGithub().catch((error) => setStatus(error.message, "bad"))
  })
  document.querySelector("#download").addEventListener("click", downloadJson)
  weekSelect.addEventListener("change", () => {
    captureForm()
    weekIndex = Number(weekSelect.value)
    renderEditor()
  })
  document.querySelector("#add-week").addEventListener("click", () => {
    if (!weekDate.value) return
    captureForm()
    const start = mondayOf(weekDate.value)
    if (data.weeks.some((week) => week.start === start)) {
      weekIndex = data.weeks.findIndex((week) => week.start === start)
    } else {
      data.weeks.push(blankWeek(start))
      data.weeks.sort((a, b) => a.start.localeCompare(b.start))
      weekIndex = data.weeks.findIndex((week) => week.start === start)
    }
    renderEditor()
  })
  document.querySelector("#delete-week").addEventListener("click", () => {
    const week = data.weeks[weekIndex]
    if (!week) return
    const label = `${week.start} — ${week.days.at(-1)?.date || ""}`
    if (!window.confirm(`Удалить неделю ${label}?`)) return
    captureForm()
    data.weeks.splice(weekIndex, 1)
    weekIndex = Math.max(0, Math.min(weekIndex, data.weeks.length - 1))
    renderEditor()
    setStatus("Неделя удалена в этой вкладке. Нажмите «Сохранить на сайт», чтобы применить.", "")
  })
}

main().catch((error) => setStatus(error.message, "bad"))
