import assert from "node:assert/strict"
import test from "node:test"
import {
  SECTIONS,
  formatMaterialDate,
  normalizeLinks,
  normalizeMaterials,
  presentationFor,
  recordingsFor,
  recordingsForLesson,
  safeHref,
} from "../assets/js/materials-data.js"

test("материалы делятся на четыре раздела", () => {
  assert.deepEqual(SECTIONS.map((section) => section.key), ["presentations", "recordings", "articles", "books"])
  const data = normalizeMaterials({})
  for (const section of SECTIONS) assert.deepEqual(data[section.key], [])
})

test("старый формат материалов переносится в статьи", () => {
  const data = normalizeMaterials({ materials: [{ title: "Старый материал", url: "https://example.com/a" }] })
  assert.equal(data.articles.length, 1)
  assert.equal(data.articles[0].title, "Старый материал")
  assert.equal(data.articles[0].kind, "link")
})

test("ссылки принимают http, домен без протокола и файлы в materials", () => {
  assert.equal(safeHref("https://example.com/a"), "https://example.com/a")
  assert.equal(safeHref("example.com/a"), "https://example.com/a")
  assert.equal(safeHref("//example.com/a"), "https://example.com/a")
  assert.equal(safeHref("materials/file.pdf"), "materials/file.pdf")
  assert.equal(safeHref("assets/file.pdf"), "assets/file.pdf")
  assert.equal(safeHref("javascript:alert(1)"), "")
  assert.equal(safeHref("https://example.com/a b"), "")
  assert.equal(safeHref("materials/../secret"), "")
})

test("дополнительные ссылки очищаются от пустых строк", () => {
  const links = normalizeLinks([
    { title: "Статья", url: "https://example.com/a" },
    { title: "", url: "" },
    { title: "Книга" },
  ])
  assert.deepEqual(links, [
    { title: "Статья", url: "https://example.com/a" },
    { title: "Книга", url: "" },
  ])
})

test("записи связаны с презентацией в обе стороны", () => {
  const presentations = [{ id: "p-1", title: "Плитки Вана" }]
  const recordings = [
    { id: "r-1", title: "Занятие 1", presentation: "p-1" },
    { id: "r-2", title: "Занятие 2", presentation: "p-2" },
  ]
  assert.deepEqual(recordingsFor(presentations[0], recordings).map((item) => item.id), ["r-1"])
  assert.equal(presentationFor(recordings[0], presentations)?.title, "Плитки Вана")
  assert.equal(presentationFor(recordings[1], presentations), null)
})

test("дата материала выводится по-русски", () => {
  assert.equal(formatMaterialDate("2026-11-05"), "5 ноября 2026 г.")
  assert.equal(formatMaterialDate(""), "")
  assert.equal(formatMaterialDate("2026-13-40"), "")
})

test("запись занятия связывается с занятием расписания", () => {
  const recordings = [
    { id: "r-1", lessonId: "ev-2026-11-05-1700" },
    { id: "r-2", lessonId: "" },
  ]
  assert.deepEqual(recordingsForLesson(recordings, "ev-2026-11-05-1700").map((item) => item.id), ["r-1"])
  assert.deepEqual(recordingsForLesson(recordings, ""), [])
  const data = normalizeMaterials({
    recordings: [{ id: "r-1", title: "Запись", lessonId: "ev-2026-11-05-1700" }],
  })
  assert.equal(data.recordings[0].lessonId, "ev-2026-11-05-1700")
})
