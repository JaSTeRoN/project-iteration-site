import {
  KINDS,
  dayTitle,
  eventLink,
  formatDate,
  formatTime,
  instantOf,
  kindFor,
  pickWeekIndex,
  shortDayTitle,
  sortEvents,
  todayIn,
  weekDays,
  weekRangeTitle,
  weekStarts,
  weekState,
} from "./schedule-data.js"

const board = document.querySelector("#schedule-board")
const clocks = new Map()

let data = null
let weeks = []
let index = 0
let zoneIndex = 0
let primary = null

function zoneNow(timeZone) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date())
}

function eventCard(event, zone, columnDate) {
  const instant = instantOf(event, primary.timeZone)
  const card = document.createElement("article")
  const kindValue = kindFor(event, zone, primary)
  card.className = `lesson lesson-${kindValue}`
  const time = document.createElement("p")
  time.className = "lesson-time"
  time.textContent = formatTime(instant, zone.timeZone)
  const kind = document.createElement("p")
  kind.className = "lesson-kind"
  kind.textContent = KINDS[kindValue] || "Занятие"
  card.append(time, kind)
  const localDate = formatDate(instant, zone.timeZone)
  if (localDate !== columnDate) {
    const note = document.createElement("p")
    note.className = "lesson-note"
    note.textContent = shortDayTitle(localDate)
    card.append(note)
  }
  if (event.place && zone.id === primary.id) {
    const place = document.createElement("p")
    place.className = "lesson-place"
    place.textContent = event.place
    card.append(place)
  }
  const href = eventLink(event, data.defaultLink)
  if (href) {
    const link = document.createElement("a")
    link.href = href
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    link.textContent = "подключиться"
    card.append(link)
  }
  return card
}

function zoneHeader(zone) {
  const head = document.createElement("header")
  head.className = "zone-head"
  const title = document.createElement("h2")
  title.textContent = zone.title
  const date = document.createElement("p")
  date.className = "zone-date"
  date.textContent = new Intl.DateTimeFormat("ru-RU", {
    timeZone: zone.timeZone,
    day: "numeric",
    month: "long",
  }).format(new Date())
  const clock = document.createElement("p")
  clock.className = "zone-clock"
  clocks.set(clock, zone.timeZone)
  head.append(title, date, clock)
  return head
}

function renderZone(zone, weekStart, today) {
  const section = document.createElement("section")
  section.className = `zone zone-${zone.id}`
  section.append(zoneHeader(zone))

  const days = document.createElement("div")
  days.className = "days"
  for (const dayDate of weekDays(weekStart)) {
    const column = document.createElement("section")
    column.className = "day"
    if (dayDate === today) column.classList.add("today")
    const heading = document.createElement("h3")
    heading.textContent = dayTitle(dayDate)
    column.append(heading)
    const events = data.events.filter(
      (event) => event.date === dayDate && (!event.zones || event.zones.includes(zone.id)),
    )
    const sorted = sortEvents(events, primary.timeZone)
    if (sorted.length === 0) {
      const empty = document.createElement("p")
      empty.className = "day-empty"
      empty.textContent = "Нет занятий"
      column.append(empty)
    } else {
      for (const event of sorted) column.append(eventCard(event, zone, dayDate))
    }
    days.append(column)
  }
  section.append(days)
  return section
}

function weekNav(weekStart, today) {
  const nav = document.createElement("div")
  nav.className = "week-nav"

  const prev = document.createElement("button")
  prev.type = "button"
  prev.className = "week-step"
  prev.textContent = "‹"
  prev.setAttribute("aria-label", "Предыдущая неделя")
  prev.disabled = index === 0
  prev.addEventListener("click", () => {
    index -= 1
    render()
  })

  const label = document.createElement("p")
  label.className = "week-range"
  label.textContent = weekRangeTitle(weekStart)

  const next = document.createElement("button")
  next.type = "button"
  next.className = "week-step"
  next.textContent = "›"
  next.setAttribute("aria-label", "Следующая неделя")
  next.disabled = index === weeks.length - 1
  next.addEventListener("click", () => {
    index += 1
    render()
  })

  nav.append(prev, label)
  const state = weekState(weekStart, today)
  if (state === "past" || state === "future") {
    const badge = document.createElement("span")
    badge.className = "week-badge"
    badge.textContent = state === "past" ? "Архив" : "Скоро"
    nav.append(badge)
  }
  nav.append(next)
  return nav
}

function timeSwitch() {
  const group = document.createElement("div")
  group.className = "time-switch"
  group.setAttribute("role", "group")
  group.setAttribute("aria-label", "Часовой пояс")
  data.zones.forEach((zone, position) => {
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = zone.short || zone.title
    button.setAttribute("aria-pressed", String(position === zoneIndex))
    button.addEventListener("click", () => {
      if (position === zoneIndex) return
      zoneIndex = position
      render()
    })
    group.append(button)
  })
  return group
}

function render() {
  clocks.clear()
  board.replaceChildren()
  const weekStart = weeks[index]
  const zone = data.zones[zoneIndex]
  const today = todayIn(zone.timeZone)

  const head = document.createElement("div")
  head.className = "board-head"
  head.append(weekNav(weekStart, today), timeSwitch())

  board.append(head, renderZone(zone, weekStart, today))
  tick()
}

function tick() {
  for (const [node, timeZone] of clocks) node.textContent = zoneNow(timeZone)
}

async function main() {
  try {
    const response = await fetch("data/schedule.json", { cache: "no-cache" })
    if (!response.ok) throw new Error(String(response.status))
    data = await response.json()
    data.events = data.events || []
    primary = data.zones.find((zone) => zone.id === data.primary) || data.zones[0]
    zoneIndex = Math.max(0, data.zones.indexOf(primary))
    const today = todayIn(primary.timeZone)
    weeks = weekStarts(data.events, today)
    index = pickWeekIndex(weeks, today)
    if (data.events.length === 0) {
      board.textContent = "Расписание пока пустое."
      return
    }
    render()
    window.setInterval(tick, 1000)
  } catch {
    board.textContent = "Не удалось загрузить расписание."
  }
}

main()
