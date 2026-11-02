import assert from "node:assert/strict"
import test from "node:test"
import { addDays, blankWeek, mondayOf, pickWeek, sortEvents } from "../assets/js/schedule-data.js"

test("неделя начинается с понедельника и длится шесть дней", () => {
  assert.equal(mondayOf("2026-11-04"), "2026-11-02")
  assert.equal(mondayOf("2026-11-08"), "2026-11-02")
  const week = blankWeek("2026-11-05")
  assert.equal(week.start, "2026-11-02")
  assert.deepEqual(week.days.map((day) => day.date), [
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
  ])
  assert.equal(addDays("2026-11-02", 5), "2026-11-07")
})

test("текущая неделя выбирается по дате, занятия сортируются по времени", () => {
  const weeks = [
    { start: "2026-10-26", days: [] },
    { start: "2026-11-02", days: [] },
    { start: "2026-11-09", days: [] },
  ]
  assert.equal(pickWeek(weeks, "2026-11-04").start, "2026-11-02")
  assert.equal(pickWeek(weeks, "2026-11-08").start, "2026-11-02")
  assert.deepEqual(
    sortEvents([{ time: "18:00" }, { time: "12:00" }, { time: "16:45" }]).map((item) => item.time),
    ["12:00", "16:45", "18:00"],
  )
})
