const FILE = "data/materials.json"
const MAX_FILE = 20 * 1024 * 1024

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
      <p class="editor-note">Карточка — это ссылка или файл. Файлы до 20 МБ загружаются в папку <code>materials/</code>.</p>
      <div data-list></div>
      <div class="week-tools">
        <button type="button" class="quiet" data-add>Добавить материал</button>
        <button type="button" data-save>Сохранить</button>
      </div>
      <p class="status" data-status role="status"></p>
    </section>
  `

  const statusNode = host.querySelector("[data-status]")
  const list = host.querySelector("[data-list]")
  const saveButton = host.querySelector("[data-save]")

  let data = { materials: [] }
  let sha = ""

  function setStatus(text, kind) {
    statusNode.textContent = text
    statusNode.className = `status ${kind || ""}`
  }

  function materialCard(material) {
    const card = document.createElement("div")
    card.className = "event-edit"

    const rowOne = document.createElement("div")
    rowOne.className = "event-edit-row"
    const title = document.createElement("input")
    title.type = "text"
    title.placeholder = "Название материала"
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
    for (const [value, text] of [
      ["link", "Ссылка"],
      ["file", "Файл"],
    ]) {
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

    const rowFour = document.createElement("div")
    rowFour.className = "event-edit-row event-edit-footer"
    const current = document.createElement("p")
    current.className = "event-hint"
    current.textContent = material.kind === "file" && material.url ? `Файл: ${material.url}` : ""
    const remove = document.createElement("button")
    remove.type = "button"
    remove.className = "quiet"
    remove.textContent = "Удалить"
    remove.addEventListener("click", () => {
      data.materials.splice(data.materials.indexOf(material), 1)
      render()
    })
    rowFour.append(current, remove)

    kind.addEventListener("change", () => {
      material.kind = kind.value
      url.hidden = kind.value === "file"
      file.hidden = kind.value !== "file"
    })
    url.addEventListener("input", () => {
      material.url = url.value
    })
    note.addEventListener("input", () => {
      material.note = note.value
    })
    title.addEventListener("input", () => {
      material.title = title.value
    })
    date.addEventListener("input", () => {
      material.date = date.value
    })
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

    card.append(rowOne, rowTwo, rowThree, rowFour)
    return card
  }

  function render() {
    list.replaceChildren()
    data.materials.forEach((material) => list.append(materialCard(material)))
    if (!data.materials.length) {
      const empty = document.createElement("p")
      empty.className = "day-empty"
      empty.textContent = "Пока ни одного материала."
      list.append(empty)
    }
  }

  function clean(material) {
    return {
      title: String(material.title || "").trim(),
      date: String(material.date || "").trim(),
      kind: material.kind === "file" ? "file" : "link",
      url: String(material.url || "").trim(),
      note: String(material.note || "").trim(),
    }
  }

  host.querySelector("[data-add]").addEventListener("click", () => {
    data.materials.push({ title: "", date: "", kind: "link", url: "", note: "" })
    render()
  })

  saveButton.addEventListener("click", async () => {
    if (!api.canWrite) {
      setStatus("У этой учётной записи только чтение.", "bad")
      return
    }
    setStatus("Сохраняем…")
    try {
      for (const material of data.materials) {
        if (!material.pendingFile) continue
        const path = filePath(material.pendingFile.name)
        setStatus(`Загружаем файл ${material.pendingFile.name}…`)
        const base64 = await readAsBase64(material.pendingFile)
        await api.upload(path, base64, `Upload ${material.pendingFile.name}`)
        material.url = path
        material.kind = "file"
        delete material.pendingFile
      }
      const next = { materials: data.materials.map(clean) }
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
  data = loaded.data && Array.isArray(loaded.data.materials) ? loaded.data : { materials: [] }
  sha = loaded.sha
  render()
  if (!api.canWrite) {
    saveButton.disabled = true
    setStatus("Только чтение: у токена нет прав на запись.", "bad")
  }
}
