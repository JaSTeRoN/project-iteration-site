import { loadAccessCatalog } from "../access-catalog.js"

const FILE = "data/access.json"

export async function mountAccess(host, api) {
  host.innerHTML = `
    <section class="editor-card">
      <p class="editor-note">Пока не наступит указанное время, элемент закрыт на сайте. Список целей собирается автоматически из <code>apps.html</code> и <code>data/materials.json</code>: новые приложения и материалы появятся здесь без правки кода. Это мягкое ограничение — файлы всё равно лежат в открытом репозитории.</p>
      <div data-list></div>
      <div class="week-tools">
        <button type="button" class="quiet" data-refresh>Обновить список</button>
        <button type="button" class="quiet" data-add>Добавить правило</button>
        <button type="button" data-save>Сохранить раздел</button>
      </div>
      <p class="status" data-status role="status"></p>
    </section>
  `

  const statusNode = host.querySelector("[data-status]")
  const list = host.querySelector("[data-list]")
  const saveButton = host.querySelector("[data-save]")
  const refreshButton = host.querySelector("[data-refresh]")

  let data = { gates: [] }
  let groups = []
  let sha = ""
  let baseline = ""

  function setStatus(text, kind) {
    statusNode.textContent = text
    statusNode.className = `status ${kind || ""}`
  }

  function allTargets() {
    return groups.flatMap((group) => group.items)
  }

  function targetOf(value) {
    return allTargets().find((item) => item.value === value)?.label || value
  }

  function firstTarget() {
    return allTargets().find((item) => item.value !== "apps.html")?.value || "apps.html"
  }

  function fillTargets(select, current) {
    const used = new Set()
    for (const group of groups) {
      if (!group.items?.length) continue
      const optgroup = document.createElement("optgroup")
      optgroup.label = group.label
      for (const item of group.items) {
        if (used.has(item.value)) continue
        used.add(item.value)
        const option = document.createElement("option")
        option.value = item.value
        option.textContent = item.label
        option.selected = current === item.value
        optgroup.append(option)
      }
      if (optgroup.children.length > 0) select.append(optgroup)
    }
    if (current && !used.has(current)) {
      const optgroup = document.createElement("optgroup")
      optgroup.label = "Не найдено в каталоге"
      const option = document.createElement("option")
      option.value = current
      option.textContent = current
      option.selected = true
      optgroup.append(option)
      select.append(optgroup)
    }
  }

  function gateHint(gate) {
    const when = gate.open ? gate.open.replace("T", " ") : "не задано"
    return `${targetOf(gate.target)} · откроется: ${when} (томское время)`
  }

  function serialized() {
    return {
      gates: data.gates
        .map((gate) => ({
          target: String(gate.target || "").trim(),
          open: String(gate.open || "").trim(),
          zone: "Asia/Tomsk",
        }))
        .filter((gate) => gate.target && gate.open),
    }
  }

  function gateCard(gate) {
    const card = document.createElement("div")
    card.className = "event-edit"

    const rowOne = document.createElement("div")
    rowOne.className = "event-edit-row"
    const target = document.createElement("select")
    target.setAttribute("aria-label", "Что закрываем")
    fillTargets(target, gate.target)
    const open = document.createElement("input")
    open.type = "datetime-local"
    open.value = gate.open || ""
    open.setAttribute("aria-label", "Открыть в")
    rowOne.append(target, open)

    const rowTwo = document.createElement("div")
    rowTwo.className = "event-edit-row event-edit-footer"
    const hint = document.createElement("p")
    hint.className = "event-hint"
    hint.textContent = gateHint(gate)
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
      hint.textContent = gateHint(gate)
    })
    open.addEventListener("input", () => {
      gate.open = open.value
      hint.textContent = gateHint(gate)
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
    data.gates.push({ target: firstTarget(), open: "", zone: "Asia/Tomsk", note: "" })
    render()
  })

  refreshButton.addEventListener("click", async () => {
    refreshButton.disabled = true
    setStatus("Обновляем список целей…")
    try {
      const catalog = await loadAccessCatalog()
      groups = catalog.groups
      render()
      setStatus(`Список обновлён: ${allTargets().length} элементов.`, "good")
    } catch (error) {
      setStatus(error.message, "bad")
    } finally {
      refreshButton.disabled = false
    }
  })

  saveButton.addEventListener("click", async () => {
    if (!api.canWrite) {
      setStatus("У этой учётной записи только чтение.", "bad")
      return
    }
    const next = serialized()
    setStatus("Сохраняем…")
    try {
      const result = await api.save(FILE, next, "Update access", sha)
      sha = result.sha
      data = next
      baseline = JSON.stringify(next)
      render()
      setStatus("Сохранено. Сайт обновится через минуту.", "good")
    } catch (error) {
      setStatus(error.message, "bad")
    }
  })

  const [loaded, catalog] = await Promise.all([api.load(FILE), loadAccessCatalog()])
  data = loaded.data && Array.isArray(loaded.data.gates) ? loaded.data : { gates: [] }
  groups = catalog.groups
  sha = loaded.sha
  baseline = JSON.stringify(serialized())
  render()
  if (!api.canWrite) {
    saveButton.disabled = true
    setStatus("Только чтение: у токена нет прав на запись.", "bad")
  }

  return {
    targetOf,
    async collectChanges() {
      const next = serialized()
      const text = JSON.stringify(next)
      if (text === baseline) return { files: [] }
      return {
        files: [{ path: FILE, data: next }],
        commit: (fileShas) => {
          sha = fileShas[FILE] || sha
          data = next
          baseline = text
          render()
          setStatus("Сохранено в общем коммите.", "good")
        },
      }
    },
  }
}
