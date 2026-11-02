import { KINDS, dayTitle, pickWeek, safeLink, sortEvents, todayIn } from "./schedule-data.js"

const board = document.querySelector("#schedule-board")
const clocks = new Map()

function zoneNow(timeZone) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date())
}

function eventCard(event) {
  const card = document.createElement("article")
  card.className = `lesson lesson-${event.kind || "remote"}`
  const time = document.createElement("p")
  time.className = "lesson-time"
  time.textContent = event.time || "без времени"
  const kind = document.createElement("p")
  kind.className = "lesson-kind"
  kind.textContent = KINDS[event.kind] || "Занятие"
  card.append(time, kind)
  if (event.place) {
    const place = document.createElement("p")
    place.className = "lesson-place"
    place.textContent = event.place
    card.append(place)
  }
  const href = safeLink(event.link)
  if (href) {
    const link = document.createElement("a")
    link.href = href
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    link.textContent = "Ссылка на конференцию"
    card.append(link)
  }
  return card
}

function renderZone(zone, week) {
  const section = document.createElement("section")
  section.className = `zone zone-${zone.id}`
  const head = document.createElement("header")
  head.className = "zone-head"
  const title = document.createElement("h2")
  title.textContent = zone.title
  const clock = document.createElement("p")
  clock.className = "zone-clock"
  clock.dataset.zone = zone.timeZone
  const today = todayIn(zone.timeZone)
  const date = document.createElement("p")
  date.className = "zone-date"
  date.textContent = new Intl.DateTimeFormat("ru-RU", {
    timeZone: zone.timeZone,
    day: "numeric",
    month: "long",
  }).format(new Date())
  head.append(title, date, clock)
  clocks.set(clock, zone.timeZone)

  const days = document.createElement("div")
  days.className = "days"
  for (const day of week.days) {
    const column = document.createElement("section")
    column.className = "day"
    if (day.date === today) column.classList.add("today")
    const heading = document.createElement("h3")
    heading.textContent = dayTitle(day.date)
    column.append(heading)
    const events = sortEvents(day[zone.id] || [])
    if (events.length === 0) {
      const empty = document.createElement("p")
      empty.className = "day-empty"
      empty.textContent = "Нет занятий"
      column.append(empty)
    } else {
      for (const event of events) column.append(eventCard(event))
    }
    days.append(column)
  }
  section.append(head, days)
  return section
}

function tick() {
  for (const [node, timeZone] of clocks) node.textContent = zoneNow(timeZone)
}

function showWeek(data, week) {
  board.replaceChildren()
  const range = document.createElement("p")
  range.className = "week-range"
  const first = week.days[0]?.date
  const last = week.days.at(-1)?.date
  range.textContent = first && last ? `${dayTitle(first)} — ${dayTitle(last)}` : ""
  const zones = document.createElement("div")
  zones.className = "zones"
  for (const zone of data.zones) zones.append(renderZone(zone, week))
  board.append(range, zones)
  tick()
}

async function main() {
  try {
    const response = await fetch("data/schedule.json", { cache: "no-cache" })
    if (!response.ok) throw new Error(String(response.status))
    const data = await response.json()
    const week = pickWeek(data.weeks || [], todayIn("Asia/Tomsk"))
    if (!week) {
      board.textContent = "Расписание пока пустое."
      return
    }
    showWeek(data, week)
    window.setInterval(tick, 1000)
  } catch {
    board.textContent = "Не удалось загрузить расписание."
  }
}

main()
