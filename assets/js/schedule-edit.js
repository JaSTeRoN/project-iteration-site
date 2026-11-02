import {
  KINDS,
  addDays,
  dayTitle,
  formatDate,
  formatTime,
  instantOf,
  mondayOf,
  shortDayTitle,
  sortEvents,
  todayIn,
  weekDays,
  weekRangeTitle,
} from "./schedule-data.js"

const REPO = "JaSTeRoN/project-iteration-site"
const FILE = "data/schedule.json"
const BRANCH = "main"
const TOKEN_KEY = "iteration-schedule-token"

const statusNode = document.querySelector("#edit-status")
const tokenInput = document.querySelector("#token")
const weekLabel = document.querySelector("#week-label")
const weekDate = document.querySelector("#week-date")
const host = document.querySelector("#week-body")

let data = null
let baseline = ""
let fileSha = ""
let primary = null
let weekStart = ""

function setStatus(text, kind) {
  statusNode.textContent = text
  statusNode.className = `status ${kind || ""}`
}

function zoneHint(event) {
  const instant = instantOf(event, primary.timeZone)
  return data.zones
    .filter((zone) => zone.id !== primary.id)
    .map((zone) => {
      const name = zone.short || zone.title
      const time = formatTime(instant, zone.timeZone)
      const date = formatDate(instant, zone.timeZone)
      return date === event.date ? `${name} ${time}` : `${name} ${time}, ${shortDayTitle(date)}`
    })
    .join(" · ")
}

function eventRow(event) {
  const row = document.createElement("div")
  row.className = "event-edit"

  const head = document.createElement("div")
  head.className = "event-edit-row"
  const time = document.createElement("input")
  time.type = "time"
  time.value = event.time || ""
  time.required = true
  time.setAttribute("aria-label", "Время занятия")
  const kind = document.createElement("select")
  kind.setAttribute("aria-label", "Формат занятия")
  for (const [value, label] of Object.entries(KINDS)) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = label
    option.selected = event.kind === value
    kind.append(option)
  }
  head.append(time, kind)

  const extra = document.createElement("div")
  extra.className = "event-edit-row"
  const place = document.createElement("input")
  place.type = "text"
  place.placeholder = "Аудитория"
  place.value = event.place || ""
  place.setAttribute("aria-label", "Аудитория")
  const link = document.createElement("input")
  link.type = "url"
  link.placeholder = "Ссылка https://…"
  link.value = event.link || ""
  link.setAttribute("aria-label", "Ссылка на конференцию")
  const remove = document.createElement("button")
  remove.type = "button"
  remove.className = "quiet"
  remove.textContent = "Удалить"
  remove.addEventListener("click", () => {
    data.events.splice(data.events.indexOf(event), 1)
    renderWeek()
  })
  extra.append(place, link, remove)

  const hint = document.createElement("p")
  hint.className = "event-hint"
  hint.textContent = zoneHint(event)

  time.addEventListener("input", () => {
    event.time = time.value
    hint.textContent = zoneHint(event)
  })
  kind.addEventListener("change", () => {
    event.kind = kind.value
  })
  place.addEventListener("input", () => {
    event.place = place.value
  })
  link.addEventListener("input", () => {
    event.link = link.value
  })

  row.append(head, extra, hint)
  return row
}

function renderWeek() {
  weekLabel.textContent = weekRangeTitle(weekStart)
  weekDate.value = weekStart
  host.replaceChildren()
  const grid = document.createElement("div")
  grid.className = "days-edit"
  for (const date of weekDays(weekStart)) {
    const column = document.createElement("section")
    column.className = "day-edit"
    column.dataset.date = date
    const heading = document.createElement("h3")
    heading.textContent = dayTitle(date)
    const list = document.createElement("div")
    const events = sortEvents(data.events.filter((event) => event.date === date), primary.timeZone)
    for (const event of events) list.append(eventRow(event))
    const add = document.createElement("button")
    add.type = "button"
    add.className = "quiet"
    add.textContent = "Добавить занятие"
    add.addEventListener("click", () => {
      data.events.push({ date, time: "12:00", kind: "remote", place: "", link: "" })
      renderWeek()
    })
    column.append(heading, list, add)
    grid.append(column)
  }
  const card = document.createElement("section")
  card.className = "editor-card"
  card.append(grid)
  host.append(card)
}

function normalized() {
  const events = sortEvents(
    data.events.map((event) => {
      const copy = {
        date: event.date,
        time: event.time,
        kind: event.kind,
        place: String(event.place || "").trim(),
        link: String(event.link || "").trim(),
      }
      if (event.zones) copy.zones = event.zones
      return copy
    }),
    primary.timeZone,
  )
  return { primary: data.primary, zones: data.zones, events }
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
  const text = new TextDecoder().decode(
    Uint8Array.from(atob(payload.content.replace(/\n/g, "")), (char) => char.charCodeAt(0)),
  )
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
  data = remote.data
  data.events = data.events || []
  baseline = JSON.stringify(data)
  primary = data.zones.find((zone) => zone.id === data.primary) || data.zones[0]
  fileSha = remote.sha
  weekStart = mondayOf(todayIn(primary.timeZone))
  renderWeek()
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
  const next = normalized()
  await ensureFileSha()
  const content = btoa(String.fromCharCode(...new TextEncoder().encode(`${JSON.stringify(next, null, 2)}\n`)))
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
  data = next
  baseline = JSON.stringify(next)
  renderWeek()
  setStatus("Сохранено. На сайте появится через минуту, когда GitHub Pages обновит страницу.", "good")
}

function downloadJson() {
  if (!data) {
    setStatus("Сначала загрузите расписание.", "bad")
    return
  }
  const blob = new Blob([`${JSON.stringify(normalized(), null, 2)}\n`], { type: "application/json" })
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
  data.events = data.events || []
  baseline = JSON.stringify(data)
  primary = data.zones.find((zone) => zone.id === data.primary) || data.zones[0]
  weekStart = mondayOf(todayIn(primary.timeZone))
  renderWeek()
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
  document.querySelector("#prev-week").addEventListener("click", () => {
    weekStart = addDays(weekStart, -7)
    renderWeek()
  })
  document.querySelector("#next-week").addEventListener("click", () => {
    weekStart = addDays(weekStart, 7)
    renderWeek()
  })
  document.querySelector("#go-week").addEventListener("click", () => {
    if (!weekDate.value) return
    weekStart = mondayOf(weekDate.value)
    renderWeek()
  })
}

main().catch((error) => setStatus(error.message, "bad"))
