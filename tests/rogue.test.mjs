import assert from "node:assert/strict"
import test from "node:test"
import {
  allReachable,
  doorsTouchRooms,
  generateDungeon,
  gridsMatch,
  playback,
  sectorOf,
} from "../assets/js/rogue/generate.js"

function run(params) {
  return generateDungeon({
    sectorW: 13,
    sectorH: 9,
    minRoomW: 4,
    minRoomH: 3,
    maxRoomW: 8,
    maxRoomH: 6,
    extraChance: 0.2,
    loot: true,
    ...params,
  })
}

test("подземелье связное, двери у комнат, ролик совпадает с итогом", () => {
  const cases = []
  for (let seed = 1; seed <= 25; seed += 1) {
    cases.push({ seed, cols: 3, rows: 3, roomChance: 0.78 })
  }
  cases.push({ seed: 3, cols: 3, rows: 3, roomChance: 0 })
  cases.push({ seed: 4, cols: 3, rows: 3, roomChance: 1 })
  cases.push({ seed: 5, cols: 2, rows: 2, roomChance: 0.7 })
  cases.push({ seed: 6, cols: 5, rows: 4, roomChance: 0.6, extraChance: 0.05, loot: false })
  for (const params of cases) {
    const dungeon = run(params)
    const again = run(params)
    assert.equal(dungeon.events.length, again.events.length, `seed ${params.seed}`)
    assert.equal(allReachable(dungeon.grid), true, `связность seed ${params.seed}`)
    assert.equal(doorsTouchRooms(dungeon.grid), true, `двери seed ${params.seed}`)
    const played = playback(dungeon, dungeon.events.length)
    assert.equal(gridsMatch(played.grid, dungeon.grid), true, `playback seed ${params.seed}`)
    assert.equal(played.done, true)
    const rooms = dungeon.sectors.filter((sector) => sector.room)
    if (rooms.length >= 2) {
      let up = null
      let down = null
      for (let y = 0; y < dungeon.height; y += 1) {
        for (let x = 0; x < dungeon.width; x += 1) {
          if (dungeon.grid[y][x].stairs === "up") up = sectorOf(dungeon, x, y)
          if (dungeon.grid[y][x].stairs === "down") down = sectorOf(dungeon, x, y)
        }
      }
      assert.notEqual(up, down, `лестницы seed ${params.seed}`)
      assert.notEqual(up, -1)
    }
  }
})

test("один сид даёт одну геометрию", () => {
  const first = run({ seed: 11, cols: 3, rows: 3, roomChance: 0.8 })
  const second = run({ seed: 11, cols: 3, rows: 3, roomChance: 0.8 })
  assert.equal(gridsMatch(first.grid, second.grid), true)
})

test("каждый шаг ролика меняет картинку и объясняет себя", () => {
  const cases = [
    { seed: 1, cols: 3, rows: 3, roomChance: 0.78 },
    { seed: 8, cols: 3, rows: 3, roomChance: 0 },
    { seed: 4, cols: 2, rows: 2, roomChance: 1, loot: false },
  ]
  for (const params of cases) {
    const dungeon = run(params)
    let previousPicture = ""
    let previousCaption = ""
    for (let step = 1; step <= dungeon.events.length; step += 1) {
      const frame = playback(dungeon, step)
      assert.match(frame.caption, new RegExp(`Шаг ${step} из ${dungeon.events.length}`), `seed ${params.seed}`)
      assert.notEqual(frame.caption, previousCaption, `подпись seed ${params.seed} шаг ${step}`)
      const picture = JSON.stringify({
        cells: frame.grid.map((row) => row.map((cell) => `${cell.kind}${cell.stairs ?? ""}${cell.gold ? 1 : 0}`)),
        decided: frame.decided,
        anchors: frame.anchors.map((item) => [item.x, item.y]),
        links: frame.links.map((item) => [item.a, item.b, Boolean(item.extra)]),
        focus: frame.focus,
        showPlan: frame.showPlan,
      })
      assert.notEqual(picture, previousPicture, frame.caption)
      previousPicture = picture
      previousCaption = frame.caption
    }
  }
})

test("шаг ролика не показывает комнату заранее", () => {
  const dungeon = run({ seed: 2, cols: 3, rows: 3, roomChance: 1 })
  const early = playback(dungeon, 1)
  assert.equal(early.grid.some((row) => row.some((cell) => cell.kind === "room")), false)
  assert.match(early.caption, /сектор/)
})
