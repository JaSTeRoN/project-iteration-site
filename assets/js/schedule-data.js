export const KINDS = {
  offline: "Очно",
  remote: "Дистанционно",
  maybe: "Возможное дистанционное",
  stream: "Стрим очного занятия",
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
  return Array.from({ length: 6 }, (_, index) => addDays(start, index))
}

export function blankWeek(start) {
  const monday = mondayOf(start)
  return {
    start: monday,
    days: weekDays(monday).map((date) => ({ date, tomsk: [], kaliningrad: [] })),
  }
}

export function sortEvents(events) {
  return [...events].sort((a, b) => String(a.time).localeCompare(String(b.time)))
}

export function pickWeek(weeks, today) {
  const sorted = [...weeks].sort((a, b) => a.start.localeCompare(b.start))
  const current = sorted.find((week) => today >= week.start && today <= addDays(week.start, 5))
  if (current) return current
  const past = sorted.filter((week) => week.start <= today)
  return past.at(-1) || sorted[0] || null
}

export function todayIn(timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export function dayTitle(iso) {
  const date = new Date(`${iso}T12:00:00Z`)
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" }).format(date)
  const rest = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(date)
  return `${weekday}, ${rest}`
}

export function safeLink(value) {
  try {
    const url = new URL(value)
    if (url.protocol === "https:" || url.protocol === "http:") return url.href
  } catch {
    return ""
  }
  return ""
}
