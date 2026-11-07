export const SECTIONS = [
  { key: "presentations", title: "Презентации", empty: "Пока нет презентаций." },
  { key: "recordings", title: "Записи занятий", empty: "Пока нет записей занятий." },
  { key: "articles", title: "Статьи и гайды", empty: "Пока нет статей и гайдов." },
  { key: "books", title: "Книги", empty: "Пока нет книг." },
]

export function newId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${random.replace(/-/g, "").slice(0, 10)}`
}

export function safeHref(value) {
  const raw = String(value ?? "").trim()
  if (!raw || /\s/.test(raw) || raw.includes("..")) return ""
  if (raw.startsWith("materials/") || raw.startsWith("assets/")) return raw
  let candidate = raw
  if (candidate.startsWith("//")) candidate = `https:${candidate}`
  else if (candidate.startsWith("/")) return raw
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`
  try {
    const url = new URL(candidate)
    if (url.protocol === "https:" || url.protocol === "http:") return url.href
  } catch {
    return ""
  }
  return ""
}

export function normalizeLinks(links) {
  if (!Array.isArray(links)) return []
  return links
    .map((link) => ({
      title: String(link?.title || "").trim(),
      url: String(link?.url || "").trim(),
    }))
    .filter((link) => link.title || link.url)
}

export function normalizeMaterial(material, kind) {
  const id = String(material?.id || "").trim() || newId(kind.slice(0, 1))
  return {
    id,
    title: String(material?.title || "").trim(),
    date: String(material?.date || "").trim(),
    note: String(material?.note || "").trim(),
    kind: material?.kind === "file" ? "file" : "link",
    url: String(material?.url || "").trim(),
    links: normalizeLinks(material?.links),
    ...(kind === "recordings" ? { presentation: String(material?.presentation || "").trim() } : {}),
  }
}

export function normalizeMaterials(payload) {
  const source = payload && typeof payload === "object" ? payload : {}
  const result = { presentations: [], recordings: [], articles: [], books: [] }
  for (const section of SECTIONS) {
    if (Array.isArray(source[section.key])) {
      result[section.key] = source[section.key].map((item) => normalizeMaterial(item, section.key))
    }
  }
  const legacy = Array.isArray(source.materials) ? source.materials : []
  if (legacy.length > 0) {
    const used = SECTIONS.some((section) => result[section.key].length > 0)
    if (!used) result.articles = legacy.map((item) => normalizeMaterial(item, "articles"))
  }
  return result
}

export function recordingsFor(presentation, recordings) {
  if (!presentation?.id) return []
  return recordings.filter((recording) => recording.presentation === presentation.id)
}

export function presentationFor(recording, presentations) {
  if (!recording?.presentation) return null
  return presentations.find((presentation) => presentation.id === recording.presentation) || null
}

export function formatMaterialDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return ""
  const value = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(value.getTime())) return ""
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(value)
}
