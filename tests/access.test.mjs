import assert from "node:assert/strict"
import test from "node:test"
import { gateInstant, gateLabel, gateState } from "../assets/js/access.js"
import { canWrite } from "../assets/js/admin-api.js"

test("правило доступа срабатывает ровно в указанный момент по Томску", () => {
  const gate = { target: "wang.html", open: "2026-11-05T17:00", zone: "Asia/Tomsk" }
  assert.equal(gateInstant(gate).toISOString(), "2026-11-05T10:00:00.000Z")
  assert.equal(gateState(gate, new Date("2026-11-05T09:59:00Z")).open, false)
  assert.equal(gateState(gate, new Date("2026-11-05T10:00:00Z")).open, true)
})

test("пустое правило не закрывает страницу", () => {
  assert.equal(gateState({ target: "wang.html", open: "" }).open, true)
})

test("подпись правила показывает дату и время", () => {
  const label = gateLabel({ target: "wang.html", open: "2026-12-03T17:00", zone: "Asia/Tomsk" })
  assert.match(label, /3 декабря/)
  assert.match(label, /17:00/)
})

test("писать может только аккаунт с правами на репозиторий", () => {
  assert.equal(canWrite({ permission: "admin" }), true)
  assert.equal(canWrite({ permission: "maintain" }), true)
  assert.equal(canWrite({ permission: "write" }), true)
  assert.equal(canWrite({ permission: "read" }), false)
  assert.equal(canWrite(null), false)
})
