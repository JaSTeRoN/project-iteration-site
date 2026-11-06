export const KINDS = {
  offline: "Очно",
  "possible-offline": "Возможное очное занятие",
  remote: "Дистанционно",
  maybe: "Возможное дистанционное",
  stream: "Стрим очного занятия",
}

const formatters = new Map()

function zoneFormatter(timeZone) {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

function partsInZone(date, timeZone) {
  const parts = {}
  for (const part of zoneFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value)
  }
  return parts
}

function offsetMs(ms, timeZone) {
  const parts = partsInZone(new Date(ms), timeZone)
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - ms
}

export function zonedToUtc(date, time, timeZone) {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = (time || "00:00").split(":").map(Number)
  const naive = Date.UTC(year, month - 1, day, hour || 0, minute || 0)
  let ms = naive
  for (let step = 0; step < 3; step += 1) ms = naive - offsetMs(ms, timeZone)
  return new Date(ms)
}

export function instantOf(event, timeZone) {
  return zonedToUtc(event.date, event.time, timeZone)
}

export function formatDate(date, timeZone) {
  const parts = partsInZone(date, timeZone)
  const month = String(parts.month).padStart(2, "0")
  const day = String(parts.day).padStart(2, "0")
  return `${parts.year}-${month}-${day}`
}

export function formatTime(date, timeZone) {
  const parts = partsInZone(date, timeZone)
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
}

export function todayIn(timeZone) {
  return formatDate(new Date(), timeZone)
}

export function addDays(iso, count) {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

export function mondayOf(iso) {
  const date = new Date(`${iso}T12:00:00Z`)
  const day = date.getUTCDay()
  const delta = day === 0 ? -6 : 1 - day
  return addDays(iso, delta)
}

export function weekDays(start) {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function dayTitle(iso) {
  const date = new Date(`${iso}T12:00:00Z`)
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" }).format(date)
  const rest = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(date)
  return `${weekday}, ${rest}`
}

export function shortDayTitle(iso) {
  const date = new Date(`${iso}T12:00:00Z`)
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(date)
}

export function dayMonth(iso) {
  const date = new Date(`${iso}T12:00:00Z`)
  const parts = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).formatToParts(date)
  const day = Number(parts.find((part) => part.type === "day").value)
  const month = parts.find((part) => part.type === "month").value
  return { day, month }
}

export function weekRangeTitle(start) {
  const first = dayMonth(start)
  const last = dayMonth(addDays(start, 6))
  const from = `${first.day === 2 ? "со" : "с"} ${first.day}`
  return first.month === last.month
    ? `${from} по ${last.day} ${last.month}`
    : `${from} ${first.month} по ${last.day} ${last.month}`
}

export function visibleWeekDays(start, includeSunday) {
  const days = weekDays(start)
  return includeSunday ? days : days.slice(0, 6)
}

export const TERM_START = "2026-11-02"

export function weekNumber(weekStart, termStart = TERM_START) {
  const anchor = mondayOf(termStart)
  const start = new Date(`${mondayOf(weekStart)}T12:00:00Z`)
  const first = new Date(`${anchor}T12:00:00Z`)
  return Math.round((start - first) / (7 * 86400000)) + 1
}

export function sortEvents(events, timeZone) {
  return [...events].sort((a, b) => instantOf(a, timeZone).getTime() - instantOf(b, timeZone).getTime())
}

export function weekStarts(events, today) {
  const starts = new Set([mondayOf(today)])
  for (const event of events) starts.add(mondayOf(event.date))
  return [...starts].sort()
}

export function weekState(weekStart, today) {
  const monday = mondayOf(today)
  if (weekStart < monday) return "past"
  if (weekStart > monday) return "future"
  return "current"
}

export function pickWeekIndex(starts, today) {
  const index = starts.indexOf(mondayOf(today))
  return index >= 0 ? index : 0
}

export function kindFor(event, zone, primaryZone) {
  if (!primaryZone || zone.id === primaryZone.id) return event.kind || "remote"
  return event.kind === "offline" ? "stream" : event.kind || "remote"
}

export function eventLink(event, defaultLink) {
  return safeLink(event.link || defaultLink || "")
}

export function safeLink(value) {
  const raw = String(value ?? "").trim()
  if (!raw || /\s/.test(raw)) return ""
  let candidate = raw
  if (candidate.startsWith("//")) candidate = `https:${candidate}`
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`
  try {
    const url = new URL(candidate)
    if (url.protocol === "https:" || url.protocol === "http:") return url.href
  } catch {
    return ""
  }
  return ""
}
