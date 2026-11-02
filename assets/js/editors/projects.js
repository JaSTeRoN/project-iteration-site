const FILE = "data/projects.json"

export async function mountProjects(host, api) {
  host.innerHTML = `
    <section class="editor-card">
      <p class="editor-note">Каждая карточка — проект или команда. Пустые поля на сайте не показываются.</p>
      <div data-list></div>
      <div class="week-tools">
        <button type="button" class="quiet" data-add>Добавить проект</button>
        <button type="button" data-save>Сохранить</button>
      </div>
      <p class="status" data-status role="status"></p>
    </section>
  `

  const statusNode = host.querySelector("[data-status]")
  const list = host.querySelector("[data-list]")
  const saveButton = host.querySelector("[data-save]")

  let data = { projects: [] }
  let sha = ""

  function setStatus(text, kind) {
    statusNode.textContent = text
    statusNode.className = `status ${kind || ""}`
  }

  function projectCard(project, index) {
    const card = document.createElement("div")
    card.className = "event-edit"

    const rowOne = document.createElement("div")
    rowOne.className = "event-edit-row"
    const title = document.createElement("input")
    title.type = "text"
    title.placeholder = "Название проекта"
    title.value = project.title || ""
    title.setAttribute("aria-label", "Название проекта")
    const team = document.createElement("input")
    team.type = "text"
    team.placeholder = "Команда: имена через запятую"
    team.value = project.team || ""
    team.setAttribute("aria-label", "Команда")
    rowOne.append(title, team)

    const rowTwo = document.createElement("div")
    rowTwo.className = "event-edit-row"
    const description = document.createElement("input")
    description.type = "text"
    description.placeholder = "Короткое описание"
    description.value = project.description || ""
    description.setAttribute("aria-label", "Описание")
    const link = document.createElement("input")
    link.type = "url"
    link.placeholder = "Ссылка на репозиторий (необязательно)"
    link.value = project.link || ""
    link.setAttribute("aria-label", "Ссылка")
    rowTwo.append(description, link)

    const rowThree = document.createElement("div")
    rowThree.className = "event-edit-row event-edit-footer"
    const remove = document.createElement("button")
    remove.type = "button"
    remove.className = "quiet"
    remove.textContent = "Удалить"
    remove.addEventListener("click", () => {
      data.projects.splice(index, 1)
      render()
    })
    rowThree.append(remove)

    title.addEventListener("input", () => {
      project.title = title.value
    })
    team.addEventListener("input", () => {
      project.team = team.value
    })
    description.addEventListener("input", () => {
      project.description = description.value
    })
    link.addEventListener("input", () => {
      project.link = link.value
    })

    card.append(rowOne, rowTwo, rowThree)
    return card
  }

  function render() {
    list.replaceChildren()
    data.projects.forEach((project, index) => list.append(projectCard(project, index)))
    if (!data.projects.length) {
      const empty = document.createElement("p")
      empty.className = "day-empty"
      empty.textContent = "Пока ни одного проекта."
      list.append(empty)
    }
  }

  function clean(project) {
    return {
      title: String(project.title || "").trim(),
      team: String(project.team || "").trim(),
      description: String(project.description || "").trim(),
      link: String(project.link || "").trim(),
    }
  }

  host.querySelector("[data-add]").addEventListener("click", () => {
    data.projects.push({ title: "", team: "", description: "", link: "" })
    render()
  })

  saveButton.addEventListener("click", async () => {
    if (!api.canWrite) {
      setStatus("У этой учётной записи только чтение.", "bad")
      return
    }
    const next = { projects: data.projects.map(clean) }
    setStatus("Сохраняем…")
    try {
      const result = await api.save(FILE, next, "Update projects", sha)
      sha = result.sha
      data = next
      render()
      setStatus("Сохранено. Сайт обновится через минуту.", "good")
    } catch (error) {
      setStatus(error.message, "bad")
    }
  })

  const loaded = await api.load(FILE)
  data = loaded.data && Array.isArray(loaded.data.projects) ? loaded.data : { projects: [] }
  sha = loaded.sha
  render()
  if (!api.canWrite) {
    saveButton.disabled = true
    setStatus("Только чтение: у токена нет прав на запись.", "bad")
  }
}
