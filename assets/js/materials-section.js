import {
  SECTIONS,
  formatMaterialDate,
  normalizeMaterials,
  presentationFor,
  recordingsFor,
  safeHref,
} from "./materials-data.js"

const host = document.querySelector("[data-materials-section]")
const sectionKey = host?.dataset.materialsSection || ""
const root = host?.dataset.root || ""
const section = SECTIONS.find((item) => item.key === sectionKey)

function fileHref(value) {
  const href = safeHref(value)
  if (!href) return ""
  if (href.startsWith("materials/") || href.startsWith("assets/")) return `${root}${href}`
  return href
}

function externalLink(href, text, className) {
  const link = document.createElement("a")
  if (className) link.className = className
  link.href = href
  link.target = "_blank"
  link.rel = "noopener noreferrer"
  link.textContent = text
  return link
}

function pageLink(key, id, text, className) {
  const link = document.createElement("a")
  if (className) link.className = className
  link.href = `${key}.html#material-${id}`
  link.textContent = text
  return link
}

function materialTitle(material) {
  return material.title || "Материал"
}

function relationBlock(presentation, all) {
  const children = recordingsFor(presentation, all.recordings)
  if (children.length === 0) return null
  const block = document.createElement("div")
  block.className = "material-related"
  const title = document.createElement("p")
  title.className = "material-related-title"
  title.textContent = children.length === 1 ? "Запись занятия" : "Записи занятий"
  const list = document.createElement("ul")
  for (const child of children) {
    const item = document.createElement("li")
    const date = formatMaterialDate(child.date)
    item.append(pageLink("recordings", child.id, date ? `${date} — ${materialTitle(child)}` : materialTitle(child)))
    list.append(item)
  }
  block.append(title, list)
  return block
}

function presentationBlock(recording, all) {
  const presentation = presentationFor(recording, all.presentations)
  if (!presentation) return null
  const block = document.createElement("p")
  block.className = "material-related"
  block.append("Презентация: ")
  block.append(pageLink("presentations", presentation.id, materialTitle(presentation)))
  return block
}

function extrasBlock(material) {
  const links = material.links
    .map((link) => ({ ...link, href: fileHref(link.url) }))
    .filter((link) => link.href)
  if (links.length === 0) return null
  const block = document.createElement("div")
  block.className = "material-links"
  const label = document.createElement("span")
  label.textContent = links.length === 1 ? "Дополнительно:" : "Дополнительные ссылки:"
  block.append(label, " ")
  links.forEach((link, index) => {
    if (index > 0) block.append(", ")
    block.append(externalLink(link.href, link.title || link.url))
  })
  return block
}

function materialCard(material, all) {
  const card = document.createElement("article")
  card.className = "card material-card"
  card.id = `material-${material.id}`

  const date = formatMaterialDate(material.date)
  if (date) {
    const meta = document.createElement("p")
    meta.className = "card-meta"
    meta.textContent = date
    card.append(meta)
  }

  const title = document.createElement("h2")
  title.textContent = materialTitle(material)
  card.append(title)

  if (material.note) {
    const note = document.createElement("p")
    note.textContent = material.note
    card.append(note)
  }

  const relation = sectionKey === "presentations"
    ? relationBlock(material, all)
    : sectionKey === "recordings"
      ? presentationBlock(material, all)
      : null
  if (relation) card.append(relation)

  const extras = extrasBlock(material)
  if (extras) card.append(extras)

  const href = fileHref(material.url)
  if (href) {
    const label = material.kind === "file"
      ? "Скачать"
      : sectionKey === "presentations"
        ? "Открыть презентацию"
        : sectionKey === "recordings"
          ? "Смотреть запись"
          : "Открыть"
    card.append(externalLink(href, label, "card-link"))
  }

  return card
}

async function load() {
  if (!section || !host) return
  try {
    const response = await fetch(`${root}data/materials.json`, { cache: "no-cache" })
    if (!response.ok) throw new Error(String(response.status))
    const all = normalizeMaterials(await response.json())
    const items = all[section.key]
    if (items.length === 0) {
      const empty = document.createElement("p")
      empty.className = "materials-empty"
      empty.textContent = section.empty
      host.append(empty)
      return
    }
    const grid = document.createElement("div")
    grid.className = "app-grid materials-grid"
    for (const item of items) grid.append(materialCard(item, all))
    host.append(grid)
  } catch {
    host.textContent = "Не удалось загрузить материалы."
  }
}

load()
