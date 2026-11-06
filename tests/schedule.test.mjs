import assert from "node:assert/strict"
import test from "node:test"
import {
  KINDS,
  addDays,
  eventLink,
  formatDate,
  formatTime,
  instantOf,
  kindFor,
  mondayOf,
  pickWeekIndex,
  sortEvents,
  weekDays,
  weekNumber,
  weekRangeTitle,
  weekStarts,
  weekState,
  visibleWeekDays,
  zonedToUtc,
} from "../assets/js/schedule-data.js"

const TOMSK = "Asia/Tomsk"
const KALININGRAD = "Europe/Kaliningrad"

test("неделя начинается с понедельника и длится семь дней", () => {
  assert.equal(mondayOf("2026-11-04"), "2026-11-02")
  assert.equal(mondayOf("2026-11-08"), "2026-11-02")
  assert.deepEqual(weekDays("2026-11-02"), [
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08",
  ])
  assert.equal(addDays("2026-11-02", 6), "2026-11-08")
  assert.equal(weekRangeTitle("2026-11-02"), "со 2 по 8 ноября")
  assert.equal(weekRangeTitle("2026-08-03"), "с 3 по 9 августа")
  assert.equal(weekRangeTitle("2026-11-30"), "с 30 ноября по 6 декабря")
  assert.equal(weekRangeTitle("2026-12-07"), "с 7 по 13 декабря")
})

test("недели нумеруются от 2 ноября 2026 года", () => {
  assert.equal(weekNumber("2026-11-02"), 1)
  assert.equal(weekNumber("2026-11-05"), 1)
  assert.equal(weekNumber("2026-11-09"), 2)
  assert.equal(weekNumber("2026-11-16"), 3)
  assert.equal(weekNumber("2026-11-30"), 5)
  assert.equal(weekNumber("2026-10-26"), 0)
  assert.equal(weekNumber("2026-11-09", "2026-11-09"), 1)
})

test("воскресенье появляется в сетке только при наличии занятия", () => {
  assert.equal(visibleWeekDays("2026-11-02", false).length, 6)
  const withSunday = visibleWeekDays("2026-11-02", true)
  assert.equal(withSunday.length, 7)
  assert.equal(withSunday[6], "2026-11-08")
})

test("занятие хранится одним моментом и пересчитывается во вторую зону", () => {
  assert.equal(zonedToUtc("2026-11-04", "12:00", TOMSK).toISOString(), "2026-11-04T05:00:00.000Z")

  const wednesday = instantOf({ date: "2026-11-04", time: "12:00" }, TOMSK)
  assert.equal(formatTime(wednesday, TOMSK), "12:00")
  assert.equal(formatTime(wednesday, KALININGRAD), "07:00")
  assert.equal(formatDate(wednesday, KALININGRAD), "2026-11-04")

  const thursday = instantOf({ date: "2026-11-05", time: "16:45" }, TOMSK)
  assert.equal(formatTime(thursday, KALININGRAD), "11:45")

  const saturday = instantOf({ date: "2026-11-07", time: "20:00" }, TOMSK)
  assert.equal(formatTime(saturday, KALININGRAD), "15:00")
})

test("поздний слот уезжает в предыдущий день по Калининграду", () => {
  const night = instantOf({ date: "2026-11-02", time: "00:30" }, TOMSK)
  assert.equal(formatDate(night, KALININGRAD), "2026-11-01")
  assert.equal(formatTime(night, KALININGRAD), "19:30")
})

test("недели собираются из событий и всегда включают текущую", () => {
  const events = [{ date: "2026-11-04" }, { date: "2026-11-11" }, { date: "2026-11-09" }]
  assert.deepEqual(weekStarts(events, "2026-11-02"), ["2026-11-02", "2026-11-09"])
  assert.deepEqual(weekStarts([], "2026-11-04"), ["2026-11-02"])

  const starts = weekStarts(events, "2026-11-02")
  assert.equal(pickWeekIndex(starts, "2026-11-02"), 0)
  assert.equal(pickWeekIndex(starts, "2026-11-10"), 1)
  assert.equal(pickWeekIndex(starts, "2026-12-25"), 0)
})

test("прошедшая неделя помечается архивом, будущая — другой меткой", () => {
  assert.equal(weekState("2026-10-26", "2026-11-04"), "past")
  assert.equal(weekState("2026-11-02", "2026-11-04"), "current")
  assert.equal(weekState("2026-11-09", "2026-11-04"), "future")
})

test("офлайн-занятие для второй зоны становится стримом", () => {
  const tomsk = { id: "tomsk" }
  const kaliningrad = { id: "kaliningrad" }
  assert.equal(kindFor({ kind: "offline" }, tomsk, tomsk), "offline")
  assert.equal(kindFor({ kind: "offline" }, kaliningrad, tomsk), "stream")
  assert.equal(kindFor({ kind: "maybe" }, kaliningrad, tomsk), "maybe")
  assert.equal(kindFor({}, kaliningrad, tomsk), "remote")
})

test("ссылка по умолчанию подставляется, своя — важнее", () => {
  const fallback = "https://meet.example/room"
  assert.equal(eventLink({ link: "" }, fallback), fallback)
  assert.equal(eventLink({ link: "https://example.com/a" }, fallback), "https://example.com/a")
  assert.equal(eventLink({ link: "telemost.yandex.ru/j/1" }, fallback), "https://telemost.yandex.ru/j/1")
  assert.equal(eventLink({ link: "//example.com/a" }, fallback), "https://example.com/a")
  assert.equal(eventLink({ link: "javascript:alert(1)" }, fallback), "")
  assert.equal(eventLink({}, ""), "")
  assert.equal(KINDS["possible-offline"], "Возможное очное занятие")
})

test("занятия одного дня сортируются по моменту", () => {
  const events = [
    { date: "2026-11-04", time: "18:00" },
    { date: "2026-11-04", time: "12:00" },
    { date: "2026-11-04", time: "16:45" },
  ]
  assert.deepEqual(
    sortEvents(events, TOMSK).map((event) => event.time),
    ["12:00", "16:45", "18:00"],
  )
})
