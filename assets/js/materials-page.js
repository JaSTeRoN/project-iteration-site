import {
  SECTIONS,
  formatMaterialDate,
  normalizeMaterials,
  presentationFor,
  recordingsFor,
  safeHref,
} from "./materials-data.js"

const host = document.querySelector("#materials-sections")

function externalLink(href, text, className) {
  const link = document.createElement("a")
  if (className) link.className = className
  link.href = href
  link.target = "_blank"
  link.rel = "noopener noreferrer"
  link.textContent = text
  return link
}

function anchoredLink(id, text, className) {
  const link = document.createElement("a")
  if (className) link.className = className
  link.href = `#material-${id}`
  link.textContent = text
  return link
}

function materialTitle(material) {
  return material.title || "Материал"
}

function relationBlock(presentation, recordings, presentations) {
  const block = document.createElement("div")
  block.className = "material-related"
  if (presentation) {
    const kids = recordingsFor(presentation, recordings)
    if (kids.length === 0) return null
    const title = document.createElement("p")
    title.className = "material-related-title"
    title.textContent = kids.length === 1 ? "Запись занятия" : "Записи занятий"
    const list = document.createElement("ul")
    for (const child of kids) {
      const item = document.createElement("li")
      const date = formatMaterialDate(child.date)
      item.append(anchoredLink(child.id, date ? `${date} — ${materialTitle(child)}` : materialTitle(child)))
      list.append(item)
    }
    block.append(title, list)
    return block
  }
  return null
}

function presentationBlock(recording, presentations) {
  const presentation = presentationFor(recording, presentations)
  if (!presentation) return null
  const block = document.createElement("p")
  block.className = "material-related"
  block.append("Презентация: ")
  block.append(anchoredLink(presentation.id, materialTitle(presentation)))
  return block
}

function extrasBlock(material) {
  const links = material.links.filter((link) => safeHref(link.url))
  if (links.length === 0) return null
  const block = document.createElement("div")
  block.className = "material-links"
  const label = document.createElement("span")
  label.textContent = links.length === 1 ? "Дополнительно:" : "Дополнительные ссылки:"
  block.append(label, " ")
  links.forEach((link, index) => {
    if (index > 0) block.append(", ")
    block.append(externalLink(safeHref(link.url), link.title || link.url))
  })
  return block
}

function materialCard(material, section, all) {
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

  const relation = section.key === "presentations"
    ? relationBlock(material, all.recordings, all.presentations)
    : section.key === "recordings"
      ? presentationBlock(material, all.presentations)
      : null
  if (relation) card.append(relation)

  const extras = extrasBlock(material)
  if (extras) card.append(extras)

  const href = safeHref(material.url)
  if (href) {
    const label = material.kind === "file"
      ? "Скачать"
      : section.key === "presentations"
        ? "Открыть презентацию"
        : section.key === "recordings"
          ? "Смотреть запись"
          : "Открыть"
    card.append(externalLink(href, label, "card-link"))
  }

  return card
}

function renderSection(section, all) {
  const wrapper = document.createElement("section")
  wrapper.className = "materials-section"
  wrapper.id = `materials-${section.key}`

  const head = document.createElement("div")
  head.className = "materials-head"
  const heading = document.createElement("h2")
  heading.textContent = section.title
  head.append(heading)
  wrapper.append(head)

  const items = all[section.key]
  if (items.length === 0) {
    const empty = document.createElement("p")
    empty.className = "materials-empty"
    empty.textContent = section.empty
    wrapper.append(empty)
    return wrapper
  }

  const grid = document.createElement("div")
  grid.className = "app-grid materials-grid"
  for (const item of items) grid.append(materialCard(item, section, all))
  wrapper.append(grid)
  return wrapper
}

async function load() {
  try {
    const response = await fetch("data/materials.json", { cache: "no-cache" })
    if (!response.ok) throw new Error(String(response.status))
    const payload = await response.json()
    const all = normalizeMaterials(payload)
    host.replaceChildren(...SECTIONS.map((section) => renderSection(section, all)))
  } catch {
    host.textContent = "Не удалось загрузить материалы."
  }
}

load()
