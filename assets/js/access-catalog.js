import { SECTIONS } from "./materials-data.js"

const APP_PAGE = { value: "apps.html", label: "Страница приложений" }
const APPS_URL = new URL("../../apps.html", import.meta.url)
const MATERIALS_URL = new URL("../../data/materials.json", import.meta.url)

function cleanTitle(value, fallback) {
  return String(value || "").replace(/\s+/g, " ").trim() || fallback
}

function appTarget(href) {
  return String(href || "").split("#")[0].trim()
}

function appGroupsFromDocument(document) {
  const groups = new Map()
  for (const card of document.querySelectorAll("a.card[href]")) {
    const target = appTarget(card.getAttribute("href"))
    if (!target || /^https?:/i.test(target)) continue
    const title = cleanTitle(card.querySelector("h2")?.textContent, target)
    const themeNode = card.closest(".apps-theme")?.querySelector(".apps-theme-title")
    const tag = card.querySelector(".tag")?.textContent
    const theme = cleanTitle(themeNode?.textContent || tag, "Приложения")
    const label = theme.startsWith("Приложения") ? theme : `Приложения · ${theme}`
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push({ value: target, label: title })
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
}

async function loadAppsGroups() {
  try {
    const response = await fetch(APPS_URL, { cache: "no-cache" })
    if (!response.ok) return []
    const document = new DOMParser().parseFromString(await response.text(), "text/html")
    return appGroupsFromDocument(document)
  } catch {
    return []
  }
}

async function loadMaterialGroups() {
  try {
    const response = await fetch(MATERIALS_URL, { cache: "no-cache" })
    if (!response.ok) return []
    const payload = await response.json()
    const groups = []
    for (const section of SECTIONS) {
      const items = Array.isArray(payload?.[section.key])
        ? payload[section.key]
            .filter((item) => item && item.id)
            .map((item) => ({
              value: `material:${item.id}`,
              label: cleanTitle(item.title, "Материал без названия"),
            }))
        : []
      if (items.length > 0) groups.push({ label: `Материалы · ${section.title}`, items })
    }
    return groups
  } catch {
    return []
  }
}

/**
 * Builds the access-target list from the actual page and data files.
 * Adding a card to apps.html or an item to data/materials.json is enough
 * for it to appear in the admin access editor.
 */
export async function loadAccessCatalog() {
  const [appGroups, materialGroups] = await Promise.all([loadAppsGroups(), loadMaterialGroups()])
  return {
    groups: [
      { label: "Страницы", items: [APP_PAGE] },
      ...appGroups,
      ...materialGroups,
    ],
  }
}

export { APP_PAGE }
