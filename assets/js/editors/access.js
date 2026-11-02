const FILE = "data/access.json"

const TARGETS = [
  { value: "wang.html", label: "Плитки Вана" },
  { value: "rogue.html", label: "Подземелье Rogue" },
  { value: "apps.html", label: "Страница приложений" },
]

export async function mountAccess(host, api) {
  host.innerHTML = `
    <section class="editor-card">
      <p class="editor-note">Пока не наступит указанное время, карточка на сайте закрыта, а страница показывает заглушку. Это мягкое ограничение: файлы всё равно лежат в открытом репозитории.</p>
      <div data-list></div>
      <div class="week-tools">
        <button type="button" class="quiet" data-add>Добавить правило</button>
        <button type="button" data-save>Сохранить</button>
      </div>
      <p class="status" data-status role="status"></p>
    </section>
  `

  const statusNode = host.querySelector("[data-status]")
  const list = host.querySelector("[data-list]")
  const saveButton = host.querySelector("[data-save]")

  let data = { gates: [] }
  let sha = ""

  function setStatus(text, kind) {
    statusNode.textContent = text
    statusNode.className = `status ${kind || ""}`
  }

  function targetOf(value) {
    const known = TARGETS.find((item) => item.value === value)
    return known ? known.label : value
  }

  function gateCard(gate) {
    const card = document.createElement("div")
    card.className = "event-edit"

    const rowOne = document.createElement("div")
    rowOne.className = "event-edit-row"
    const target = document.createElement("select")
    target.setAttribute("aria-label", "Что закрываем")
    const options = [...TARGETS]
    if (gate.target && !TARGETS.some((item) => item.value === gate.target)) {
      options.push({ value: gate.target, label: gate.target })
    }
    for (const item of options) {
      const option = document.createElement("option")
      option.value = item.value
      option.textContent = item.label
      option.selected = gate.target === item.value
      target.append(option)
    }
    const open = document.createElement("input")
    open.type = "datetime-local"
    open.value = gate.open || ""
    open.setAttribute("aria-label", "Открыть в")
    rowOne.append(target, open)

    const rowTwo = document.createElement("div")
    rowTwo.className = "event-edit-row event-edit-footer"
    const hint = document.createElement("p")
    hint.className = "event-hint"
    hint.textContent = `Откроется: ${open.value ? open.value.replace("T", " ") : "не задано"} (томское время)`
    const remove = document.createElement("button")
    remove.type = "button"
    remove.className = "quiet"
    remove.textContent = "Удалить"
    remove.addEventListener("click", () => {
      data.gates.splice(data.gates.indexOf(gate), 1)
      render()
    })
    rowTwo.append(hint, remove)

    target.addEventListener("change", () => {
      gate.target = target.value
    })
    open.addEventListener("input", () => {
      gate.open = open.value
      hint.textContent = `Откроется: ${open.value ? open.value.replace("T", " ") : "не задано"} (томское время)`
    })

    card.append(rowOne, rowTwo)
    return card
  }

  function render() {
    list.replaceChildren()
    data.gates.forEach((gate) => list.append(gateCard(gate)))
    if (!data.gates.length) {
      const empty = document.createElement("p")
      empty.className = "day-empty"
      empty.textContent = "Ограничений нет — всё открыто."
      list.append(empty)
    }
  }

  host.querySelector("[data-add]").addEventListener("click", () => {
    data.gates.push({ target: "wang.html", open: "", zone: "Asia/Tomsk", note: "" })
    render()
  })

  saveButton.addEventListener("click", async () => {
    if (!api.canWrite) {
      setStatus("У этой учётной записи только чтение.", "bad")
      return
    }
    const next = {
      gates: data.gates
        .map((gate) => ({
          target: String(gate.target || "").trim(),
          open: String(gate.open || "").trim(),
          zone: "Asia/Tomsk",
        }))
        .filter((gate) => gate.target && gate.open),
    }
    setStatus("Сохраняем…")
    try {
      const result = await api.save(FILE, next, "Update access", sha)
      sha = result.sha
      data = next
      render()
      setStatus("Сохранено. Сайт обновится через минуту.", "good")
    } catch (error) {
      setStatus(error.message, "bad")
    }
  })

  const loaded = await api.load(FILE)
  data = loaded.data && Array.isArray(loaded.data.gates) ? loaded.data : { gates: [] }
  sha = loaded.sha
  render()
  if (!api.canWrite) {
    saveButton.disabled = true
    setStatus("Только чтение: у токена нет прав на запись.", "bad")
  }

  return { targetOf }
}
