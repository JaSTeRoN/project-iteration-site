import {
  KINDS,
  addDays,
  dayTitle,
  formatDate,
  formatTime,
  instantOf,
  mondayOf,
  shortDayTitle,
  sortEvents,
  todayIn,
  weekDays,
  weekNumber,
  weekRangeTitle,
} from "../schedule-data.js"

const FILE = "data/schedule.json"

export async function mountSchedule(host, api) {
  host.innerHTML = `
    <section class="editor-card">
      <label class="default-link">
        <span>Ссылка на подключение по умолчанию</span>
        <input type="url" data-default placeholder="https://… подставляется во все занятия">
      </label>
      <div class="week-tools">
        <div class="week-switch">
          <button type="button" class="quiet" data-prev aria-label="Предыдущая неделя">‹</button>
          <p class="week-label" data-label></p>
          <button type="button" class="quiet" data-next aria-label="Следующая неделя">›</button>
        </div>
        <div class="week-jump">
          <input type="date" data-date aria-label="Перейти к неделе">
          <button type="button" class="quiet" data-go>Перейти</button>
        </div>
        <button type="button" data-save>Сохранить</button>
      </div>
      <div class="week-tools">
        <label class="week-topic">
          <span>Тема всех занятий недели</span>
          <input type="text" data-week-topic placeholder="Например, «Плитки Вана»">
        </label>
        <button type="button" class="quiet" data-apply-topic>Заполнить неделю</button>
      </div>
      <p class="status" data-status role="status"></p>
    </section>
    <div data-week></div>
  `

  const field = (selector) => host.querySelector(selector)
  const statusNode = field("[data-status]")
  const defaultInput = field("[data-default]")
  const weekBody = field("[data-week]")
  const label = field("[data-label]")
  const weekDate = field("[data-date]")
  const weekTopicInput = field("[data-week-topic]")
  const saveButton = field("[data-save]")

  let data = null
  let sha = ""
  let primary = null
  let weekStart = ""
  let dirty = false

  function setStatus(text, kind) {
    statusNode.textContent = text
    statusNode.className = `status ${kind || ""}`
  }

  function markDirty() {
    dirty = true
    if (saveButton) saveButton.textContent = "Сохранить"
  }

  function zoneHint(event) {
    const instant = instantOf(event, primary.timeZone)
    const parts = []
    if (Array.isArray(event.zones) && event.zones.length > 0) {
      const names = event.zones.map((id) => {
        const zone = data.zones.find((item) => item.id === id)
        return zone ? zone.short || zone.title : id
      })
      parts.push(`Только ${names.join(", ")}`)
    }
    for (const zone of data.zones) {
      if (zone.id === primary.id) continue
      if (Array.isArray(event.zones) && !event.zones.includes(zone.id)) continue
      const name = zone.short || zone.title
      const time = formatTime(instant, zone.timeZone)
      const date = formatDate(instant, zone.timeZone)
      parts.push(date === event.date ? `${name} ${time}` : `${name} ${time}, ${shortDayTitle(date)}`)
    }
    return parts.join(" · ")
  }

  function eventRow(event) {
    const row = document.createElement("div")
    row.className = "event-edit"

    const head = document.createElement("div")
    head.className = "event-edit-row"
    const time = document.createElement("input")
    time.type = "time"
    time.value = event.time || ""
    time.required = true
    time.setAttribute("aria-label", "Время занятия")
    const kind = document.createElement("select")
    kind.setAttribute("aria-label", "Формат занятия")
    for (const [value, text] of Object.entries(KINDS)) {
      const option = document.createElement("option")
      option.value = value
      option.textContent = text
      option.selected = event.kind === value
      kind.append(option)
    }
    head.append(time, kind)

    const extra = document.createElement("div")
    extra.className = "event-edit-row"
    const place = document.createElement("input")
    place.type = "text"
    place.placeholder = "Аудитория"
    place.value = event.place || ""
    place.setAttribute("aria-label", "Аудитория")
    const link = document.createElement("input")
    link.type = "url"
    link.placeholder = "Своя ссылка (необязательно)"
    link.value = event.link || ""
    link.setAttribute("aria-label", "Своя ссылка на конференцию")
    const remove = document.createElement("button")
    remove.type = "button"
    remove.className = "quiet"
    remove.textContent = "Удалить"
    remove.addEventListener("click", () => {
      data.events.splice(data.events.indexOf(event), 1)
      markDirty()
      renderWeek()
    })
    extra.append(place, link, remove)

    const hint = document.createElement("p")
    hint.className = "event-hint"
    hint.textContent = zoneHint(event)

    const topic = document.createElement("input")
    topic.type = "text"
    topic.className = "event-topic"
    topic.placeholder = "Тема занятия"
    topic.value = event.topic || ""
    topic.setAttribute("aria-label", "Тема занятия")
    topic.addEventListener("input", () => {
      event.topic = topic.value
      markDirty()
    })

    const zonesSelect = document.createElement("select")
    zonesSelect.className = "zone-select"
    zonesSelect.setAttribute("aria-label", "Где показывать занятие")
    const allZones = document.createElement("option")
    allZones.value = ""
    allZones.textContent = "Все зоны"
    zonesSelect.append(allZones)
    for (const zone of data.zones) {
      const option = document.createElement("option")
      option.value = zone.id
      option.textContent = `Только ${zone.short || zone.title}`
      option.selected = Array.isArray(event.zones) && event.zones.length === 1 && event.zones[0] === zone.id
      zonesSelect.append(option)
    }
    zonesSelect.addEventListener("change", () => {
      if (zonesSelect.value) event.zones = [zonesSelect.value]
      else delete event.zones
      hint.textContent = zoneHint(event)
      markDirty()
    })

    const footer = document.createElement("div")
    footer.className = "event-edit-row event-edit-footer"
    footer.append(hint, zonesSelect)

    time.addEventListener("input", () => {
      event.time = time.value
      hint.textContent = zoneHint(event)
      markDirty()
    })
    kind.addEventListener("change", () => {
      event.kind = kind.value
      markDirty()
    })
    place.addEventListener("input", () => {
      event.place = place.value
      markDirty()
    })
    link.addEventListener("input", () => {
      event.link = link.value
      markDirty()
    })

    row.append(head, topic, extra, footer)
    return row
  }

  function renderWeek() {
    const number = weekNumber(weekStart, data.termStart)
    label.textContent = number > 0
      ? `Неделя №${number} · ${weekRangeTitle(weekStart)}`
      : weekRangeTitle(weekStart)
    weekDate.value = weekStart
    const weekEvents = data.events.filter((item) => weekDays(weekStart).includes(item.date))
    if (document.activeElement !== weekTopicInput) {
      weekTopicInput.value = weekEvents.find((item) => item.topic)?.topic || ""
    }
    weekBody.replaceChildren()
    const grid = document.createElement("div")
    grid.className = "days-edit"
    for (const date of weekDays(weekStart)) {
      const column = document.createElement("section")
      column.className = "day-edit"
      column.dataset.date = date
      const heading = document.createElement("h3")
      heading.textContent = dayTitle(date)
      const list = document.createElement("div")
      for (const event of sortEvents(data.events.filter((item) => item.date === date), primary.timeZone)) {
        list.append(eventRow(event))
      }
      const add = document.createElement("button")
      add.type = "button"
      add.className = "quiet"
      add.textContent = "Добавить занятие"
      add.addEventListener("click", () => {
        data.events.push({ date, time: "17:00", kind: "offline", place: "", link: "", topic: "" })
        markDirty()
        renderWeek()
      })
      column.append(heading, list, add)
      grid.append(column)
    }
    const card = document.createElement("section")
    card.className = "editor-card"
    card.append(grid)
    weekBody.append(card)
  }

  function normalized() {
    const events = sortEvents(
      data.events.map((event) => {
        const copy = {
          date: event.date,
          time: event.time,
          kind: event.kind,
          place: String(event.place || "").trim(),
          link: String(event.link || "").trim(),
        }
        const topic = String(event.topic || "").trim()
        if (topic) copy.topic = topic
        if (event.zones) copy.zones = event.zones
        return copy
      }),
      primary.timeZone,
    )
    return {
      primary: data.primary,
      termStart: data.termStart,
      defaultLink: String(data.defaultLink || "").trim(),
      zones: data.zones,
      events,
    }
  }

  field("[data-prev]").addEventListener("click", () => {
    weekStart = addDays(weekStart, -7)
    renderWeek()
  })
  field("[data-next]").addEventListener("click", () => {
    weekStart = addDays(weekStart, 7)
    renderWeek()
  })
  field("[data-go]").addEventListener("click", () => {
    if (!weekDate.value) return
    weekStart = mondayOf(weekDate.value)
    renderWeek()
  })
  defaultInput.addEventListener("input", () => {
    data.defaultLink = defaultInput.value
    markDirty()
  })
  field("[data-apply-topic]").addEventListener("click", () => {
    const value = weekTopicInput.value.trim()
    const days = weekDays(weekStart)
    for (const event of data.events) {
      if (!days.includes(event.date)) continue
      if (value) event.topic = value
      else delete event.topic
    }
    markDirty()
    renderWeek()
    setStatus(
      value ? "Тема заполнена для всех занятий недели." : "Темы занятий этой недели очищены.",
      "good",
    )
  })

  saveButton.addEventListener("click", async () => {
    if (!api.canWrite) {
      setStatus("У этой учётной записи только чтение.", "bad")
      return
    }
    const next = normalized()
    setStatus("Сохраняем…")
    try {
      const result = await api.save(FILE, next, "Update schedule", sha)
      sha = result.sha
      data = next
      defaultInput.value = next.defaultLink || ""
      dirty = false
      renderWeek()
      setStatus("Сохранено. Сайт обновится через минуту.", "good")
    } catch (error) {
      setStatus(error.message, "bad")
    }
  })

  const loaded = await api.load(FILE)
  if (!loaded.data) throw new Error("В репозитории нет data/schedule.json.")
  data = loaded.data
  data.events = data.events || []
  sha = loaded.sha
  primary = data.zones.find((zone) => zone.id === data.primary) || data.zones[0]
  defaultInput.value = data.defaultLink || ""
  weekStart = mondayOf(todayIn(primary.timeZone))
  renderWeek()
  if (!api.canWrite) {
    saveButton.disabled = true
    setStatus("Только чтение: у токена нет прав на запись.", "bad")
  } else if (!dirty) {
    setStatus("")
  }
}
