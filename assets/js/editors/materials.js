import { SECTIONS, newId, safeHref } from "../materials-data.js"

const FILE = "data/materials.json"
const MAX_FILE = 20 * 1024 * 1024
const ID_PREFIX = { presentations: "p", recordings: "r", articles: "a", books: "b" }

function lessonLabel(event) {
  const date = new Date(`${event.date}T12:00:00Z`)
  const day = Number.isNaN(date.getTime())
    ? event.date
    : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(date)
  const topic = String(event.topic || "").trim()
  return `${day}, ${event.time}${topic ? ` — ${topic.length > 52 ? `${topic.slice(0, 52)}…` : topic}` : ""}`
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      resolve(result.slice(result.indexOf(",") + 1))
    }
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."))
    reader.readAsDataURL(file)
  })
}

function filePath(name) {
  const safe = name
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
  return `materials/${Date.now()}-${safe || "file"}`
}

export async function mountMaterials(host, api) {
  host.innerHTML = `
    <section class="editor-card">
      <p class="editor-note">Материалы делятся на презентации, записи занятий, статьи и книги. У записи можно выбрать занятие в расписании и презентацию, по которой оно проходило, а к любому материалу — добавить дополнительные ссылки. Файлы до 20 МБ загружаются в папку <code>materials/</code>.</p>
      <div data-sections></div>
      <div class="week-tools">
        <button type="button" data-save>Сохранить</button>
      </div>
      <p class="status" data-status role="status"></p>
    </section>
  `

  const statusNode = host.querySelector("[data-status]")
  const sectionsHost = host.querySelector("[data-sections]")
  const saveButton = host.querySelector("[data-save]")

  let data = { presentations: [], recordings: [], articles: [], books: [] }
  let sha = ""
  let lessons = []

  function setStatus(text, kind) {
    statusNode.textContent = text
    statusNode.className = `status ${kind || ""}`
  }

  function presentationOptions(selected) {
    const select = document.createElement("select")
    select.setAttribute("aria-label", "Презентация занятия")
    const none = document.createElement("option")
    none.value = ""
    none.textContent = "Без презентации"
    select.append(none)
    for (const presentation of data.presentations) {
      const option = document.createElement("option")
      option.value = presentation.id
      option.textContent = presentation.title || "Без названия"
      option.selected = presentation.id === selected
      select.append(option)
    }
    return select
  }

  function linksEditor(material) {
    const box = document.createElement("div")
    box.className = "material-links-edit"

    const render = () => {
      box.replaceChildren()
      const label = document.createElement("p")
      label.className = "material-links-label"
      label.textContent = "Дополнительные ссылки"
      box.append(label)

      material.links.forEach((link, index) => {
        const row = document.createElement("div")
        row.className = "event-edit-row material-link-row"
        const title = document.createElement("input")
        title.type = "text"
        title.placeholder = "Подпись"
        title.value = link.title || ""
        title.setAttribute("aria-label", "Подпись ссылки")
        const url = document.createElement("input")
        url.type = "url"
        url.placeholder = "https://…"
        url.value = link.url || ""
        url.setAttribute("aria-label", "Адрес ссылки")
        const remove = document.createElement("button")
        remove.type = "button"
        remove.className = "quiet"
        remove.textContent = "×"
        remove.setAttribute("aria-label", "Удалить ссылку")
        title.addEventListener("input", () => { material.links[index].title = title.value })
        url.addEventListener("input", () => { material.links[index].url = url.value })
        remove.addEventListener("click", () => {
          material.links.splice(index, 1)
          render()
        })
        row.append(title, url, remove)
        box.append(row)
      })

      const add = document.createElement("button")
      add.type = "button"
      add.className = "quiet"
      add.textContent = "Добавить ссылку"
      add.addEventListener("click", () => {
        material.links.push({ title: "", url: "" })
        render()
      })
      box.append(add)
    }

    render()
    return box
  }

  function materialEditor(material, section) {
    const card = document.createElement("div")
    card.className = "event-edit"

    const rowOne = document.createElement("div")
    rowOne.className = "event-edit-row"
    const title = document.createElement("input")
    title.type = "text"
    title.placeholder = "Название"
    title.value = material.title || ""
    title.setAttribute("aria-label", "Название")
    const date = document.createElement("input")
    date.type = "date"
    date.value = material.date || ""
    date.setAttribute("aria-label", "Дата")
    rowOne.append(title, date)

    const rowTwo = document.createElement("div")
    rowTwo.className = "event-edit-row"
    const kind = document.createElement("select")
    kind.setAttribute("aria-label", "Тип")
    for (const [value, text] of [["link", "Ссылка"], ["file", "Файл"]]) {
      const option = document.createElement("option")
      option.value = value
      option.textContent = text
      option.selected = (material.kind || "link") === value
      kind.append(option)
    }
    const url = document.createElement("input")
    url.type = "url"
    url.placeholder = "https://…"
    url.value = material.kind === "file" ? "" : material.url || ""
    url.setAttribute("aria-label", "Ссылка")
    const file = document.createElement("input")
    file.type = "file"
    file.setAttribute("aria-label", "Файл")
    file.hidden = material.kind !== "file"
    url.hidden = material.kind === "file"
    rowTwo.append(kind, url, file)

    const rowThree = document.createElement("div")
    rowThree.className = "event-edit-row"
    const note = document.createElement("input")
    note.type = "text"
    note.placeholder = "Комментарий (необязательно)"
    note.value = material.note || ""
    note.setAttribute("aria-label", "Комментарий")
    rowThree.append(note)

    let presentationRow = null
    if (section.key === "recordings") {
      presentationRow = document.createElement("div")
      presentationRow.className = "event-edit-row"
      const presentation = presentationOptions(material.presentation || "")
      const wrap = document.createElement("label")
      wrap.className = "field"
      wrap.textContent = "Презентация занятия"
      wrap.append(presentation)
      presentationRow.append(wrap)
      presentation.addEventListener("change", () => { material.presentation = presentation.value })
    }

    let lessonRow = null
    if (section.key === "recordings") {
      lessonRow = document.createElement("div")
      lessonRow.className = "event-edit-row"
      const select = document.createElement("select")
      select.setAttribute("aria-label", "Занятие в расписании")
      const none = document.createElement("option")
      none.value = ""
      none.textContent = "Не указано"
      select.append(none)
      for (const event of lessons) {
        const option = document.createElement("option")
        option.value = event.id || ""
        option.textContent = lessonLabel(event)
        option.selected = (event.id || "") === (material.lessonId || "")
        select.append(option)
      }
      const wrap = document.createElement("label")
      wrap.className = "field"
      wrap.textContent = "Занятие в расписании"
      wrap.append(select)
      lessonRow.append(wrap)
      select.addEventListener("change", () => { material.lessonId = select.value })
    }

    const current = document.createElement("p")
    current.className = "event-hint"
    current.textContent = material.kind === "file" && material.url ? `Файл: ${material.url}` : ""
    const remove = document.createElement("button")
    remove.type = "button"
    remove.className = "quiet"
    remove.textContent = "Удалить"
    remove.addEventListener("click", () => {
      const index = data[section.key].indexOf(material)
      if (index >= 0) data[section.key].splice(index, 1)
      if (section.key === "presentations") {
        for (const recording of data.recordings) {
          if (recording.presentation === material.id) recording.presentation = ""
        }
      }
      render()
    })
    const footer = document.createElement("div")
    footer.className = "event-edit-row event-edit-footer"
    footer.append(current, remove)

    kind.addEventListener("change", () => {
      material.kind = kind.value
      url.hidden = kind.value === "file"
      file.hidden = kind.value !== "file"
    })
    url.addEventListener("input", () => { material.url = url.value })
    note.addEventListener("input", () => { material.note = note.value })
    title.addEventListener("input", () => { material.title = title.value })
    date.addEventListener("input", () => { material.date = date.value })
    file.addEventListener("change", () => {
      const selected = file.files && file.files[0]
      if (!selected) return
      if (selected.size > MAX_FILE) {
        setStatus("Файл больше 20 МБ — загрузите его вручную.", "bad")
        file.value = ""
        return
      }
      material.pendingFile = selected
      current.textContent = `К загрузке: ${selected.name}`
      setStatus("Файл будет загружен при сохранении.", "")
    })

    card.append(rowOne, rowTwo, rowThree)
    if (presentationRow) card.append(presentationRow)
    if (lessonRow) card.append(lessonRow)
    card.append(linksEditor(material), footer)
    return card
  }

  function sectionBlock(section) {
    const wrap = document.createElement("section")
    wrap.className = "materials-edit"
    const head = document.createElement("div")
    head.className = "materials-edit-head"
    const heading = document.createElement("h2")
    heading.textContent = section.title
    const add = document.createElement("button")
    add.type = "button"
    add.className = "quiet"
    add.textContent = "Добавить"
    add.addEventListener("click", () => {
      const item = {
        id: newId(ID_PREFIX[section.key] || "m"),
        title: "",
        date: "",
        note: "",
        kind: "link",
        url: "",
        links: [],
      }
      if (section.key === "recordings") {
        item.presentation = ""
        item.lessonId = ""
      }
      data[section.key].push(item)
      render()
    })
    head.append(heading, add)
    const list = document.createElement("div")
    data[section.key].forEach((material) => list.append(materialEditor(material, section)))
    if (!data[section.key].length) {
      const empty = document.createElement("p")
      empty.className = "day-empty"
      empty.textContent = "Пока пусто."
      list.append(empty)
    }
    wrap.append(head, list)
    return wrap
  }

  function render() {
    sectionsHost.replaceChildren(...SECTIONS.map(sectionBlock))
  }

  function cleanMaterial(material, section) {
    const result = {
      id: material.id,
      title: String(material.title || "").trim(),
      date: String(material.date || "").trim(),
      note: String(material.note || "").trim(),
      kind: material.kind === "file" ? "file" : "link",
      url: safeHref(material.url) || String(material.url || "").trim(),
      links: (material.links || [])
        .map((link) => ({ title: String(link.title || "").trim(), url: safeHref(link.url) || String(link.url || "").trim() }))
        .filter((link) => link.title || link.url),
    }
    if (section.key === "recordings") {
      result.presentation = String(material.presentation || "").trim()
      result.lessonId = String(material.lessonId || "").trim()
    }
    return result
  }

  saveButton.addEventListener("click", async () => {
    if (!api.canWrite) {
      setStatus("У этой учётной записи только чтение.", "bad")
      return
    }
    setStatus("Сохраняем…")
    try {
      for (const section of SECTIONS) {
        for (const material of data[section.key]) {
          if (!material.pendingFile) continue
          const path = filePath(material.pendingFile.name)
          setStatus(`Загружаем файл ${material.pendingFile.name}…`)
          const base64 = await readAsBase64(material.pendingFile)
          await api.upload(path, base64, `Upload ${material.pendingFile.name}`)
          material.url = path
          material.kind = "file"
          delete material.pendingFile
        }
      }
      const next = {}
      for (const section of SECTIONS) {
        next[section.key] = data[section.key].map((material) => cleanMaterial(material, section))
      }
      const result = await api.save(FILE, next, "Update materials", sha)
      sha = result.sha
      data = next
      render()
      setStatus("Сохранено. Сайт обновится через минуту.", "good")
    } catch (error) {
      setStatus(error.message, "bad")
    }
  })

  const loaded = await api.load(FILE)
  data = loaded.data && typeof loaded.data === "object" ? loaded.data : {}
  for (const section of SECTIONS) {
    if (!Array.isArray(data[section.key])) data[section.key] = []
  }
  if (Array.isArray(data.materials) && data.materials.length > 0) {
    data.articles = data.materials.map((item) => ({
      id: item.id || newId("a"),
      title: item.title || "",
      date: item.date || "",
      note: item.note || "",
      kind: item.kind === "file" ? "file" : "link",
      url: item.url || "",
      links: [],
    }))
    delete data.materials
  }
  sha = loaded.sha
  try {
    const schedule = await api.load("data/schedule.json")
    const events = Array.isArray(schedule?.data?.events) ? schedule.data.events : []
    lessons = events.slice().sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  } catch {
    lessons = []
  }
  render()
  if (!api.canWrite) {
    saveButton.disabled = true
    setStatus("Только чтение: у токена нет прав на запись.", "bad")
  }
}
