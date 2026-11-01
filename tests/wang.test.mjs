import assert from "node:assert/strict"
import test from "node:test"
import {
  LEVEL_PRESETS,
  acceptsAnywhere,
  applyObject,
  averageHeight,
  badSeams,
  candidateCells,
  catalog,
  deadEnd,
  dealLevel1,
  describeEdge,
  edgesEqual,
  emptyBoard,
  generateMap,
  makeTile,
  neighborsOf,
  placementCheck,
  signature,
  tryReplace,
  edge,
} from "../assets/js/wang/engine.js"

const COLOR = ["color"]

function placeSolution(deal) {
  const board = emptyBoard(deal.width, deal.height)
  const remaining = deal.solutionOrder.map((item) => item.tile)
  for (const step of deal.solutionOrder) {
    assert.equal(deadEnd(board, remaining, COLOR), false)
    const check = placementCheck(step.tile, neighborsOf(board, step.x, step.y), COLOR)
    assert.equal(check.ok, true, check.text)
    board[step.y][step.x] = step.tile
    remaining.shift()
  }
  assert.equal(deadEnd(board, remaining, COLOR), false)
  return board
}

test("решение раздачи ставится без поворота и без тупика", () => {
  const deal = dealLevel1({ width: 4, height: 4, tileCount: 9, colorCount: 4, seed: 7 })
  const board = placeSolution(deal)
  for (let y = 0; y < board.length; y += 1) {
    for (let x = 0; x < board[0].length; x += 1) {
      const tile = board[y][x]
      if (!tile || x + 1 >= board[0].length || !board[y][x + 1]) continue
      assert.equal(tile.e.color, board[y][x + 1].w.color)
      assert.notEqual(tile.e, tile.n)
    }
  }
})

test("число плиток не больше поля", () => {
  const deal = dealLevel1({ width: 3, height: 3, tileCount: 40, colorCount: 8, seed: 1 })
  assert.equal(deal.tileCount, 9)
  assert.equal(deal.clamped, true)
  assert.equal(deal.tray.length, 9)
})

test("первая клетка только центр, тупик распознаётся", () => {
  const board = emptyBoard(3, 3)
  assert.deepEqual(candidateCells(board), [[1, 1]])
  const filled = makeTile(
    { n: edge({ color: 0 }), e: edge({ color: 0 }), s: edge({ color: 0 }), w: edge({ color: 0 }) },
    "filled",
  )
  const other = makeTile(
    { n: edge({ color: 1 }), e: edge({ color: 1 }), s: edge({ color: 1 }), w: edge({ color: 1 }) },
    "other",
  )
  board[1][1] = filled
  assert.equal(deadEnd(board, [other], COLOR), true)
  assert.equal(deadEnd(board, [filled], COLOR), false)
  const check = placementCheck(other, neighborsOf(board, 2, 1), COLOR)
  assert.match(check.text, /цвет 1/)
  assert.match(check.text, /цвет 0/)
})

test("проверка не меняет стороны плитки", () => {
  const tile = makeTile(
    { n: edge({ color: 2 }), e: edge({ color: 3 }), s: edge({ color: 4 }), w: edge({ color: 5 }) },
    "fixed",
  )
  const before = JSON.stringify(tile)
  placementCheck(tile, { n: null, e: null, s: null, w: null }, COLOR)
  assert.equal(JSON.stringify(tile), before)
  assert.equal(describeEdge(tile.n, COLOR), "цвет 2")
})

test("автоматические карты согласованы и повторяемы", () => {
  for (const level of [2, 3, 4]) {
    for (let seed = 1; seed <= 8; seed += 1) {
      const options = { ...LEVEL_PRESETS[level], seed }
      const first = generateMap(options)
      const second = generateMap(options)
      assert.equal(badSeams(first.cells, options.channels).length, 0, `level ${level} seed ${seed}`)
      assert.equal(signature(first.cells[0][0], options.channels), signature(second.cells[0][0], options.channels))
      for (const row of first.cells) {
        for (const tile of row) {
          for (const side of ["n", "e", "s", "w"]) {
            assert.ok(!(tile[side].road === 1 && tile[side].water === 1))
          }
          if (["n", "e", "s", "w"].some((side) => tile[side].road === 1)) assert.equal(tile.object, "none")
        }
      }
    }
  }
})

test("замена плитки слушается правил Вана", () => {
  const options = { ...LEVEL_PRESETS[4], seed: 4, objectDensity: 0 }
  const map = generateMap(options)
  const tiles = catalog(map.cells, options.channels)
  for (const tile of tiles) {
    assert.ok(acceptsAnywhere(map.cells, tile, options.channels).length >= 1)
  }
  const alien = makeTile(
    {
      n: edge({ road: 1, water: 0, grassColor: 0, grassHeight: 0 }),
      e: edge({ road: 0, water: 1, grassColor: 1, grassHeight: 1 }),
      s: edge({ road: 1, water: 0, grassColor: 2, grassHeight: 2 }),
      w: edge({ road: 0, water: 0, grassColor: 3, grassHeight: 3 }),
    },
    "alien",
  )
  let rejected = false
  for (let y = 1; y < map.height - 1 && !rejected; y += 1) {
    for (let x = 1; x < map.width - 1; x += 1) {
      const result = tryReplace(map.cells, x, y, alien, options.channels)
      if (!result.ok) {
        rejected = true
        assert.match(result.text, /Не подходит/)
        break
      }
    }
  }
  assert.equal(rejected, true)
  assert.equal(badSeams(map.cells, options.channels).length, 0)
})

test("объект не встаёт на дорогу", () => {
  const map = generateMap({ ...LEVEL_PRESETS[4], seed: 9 })
  let checked = false
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = map.cells[y][x]
      if (!["n", "e", "s", "w"].some((side) => tile[side].road === 1)) continue
      const result = applyObject(map.cells, x, y, "tree")
      assert.equal(result.ok, false)
      checked = true
    }
  }
  assert.equal(checked, true)
  assert.equal(Number.isFinite(averageHeight(map.cells[0][0])), true)
})

test("дороги чаще идут прямо, чем поворачивают", () => {
  const opposite = { n: "s", s: "n", e: "w", w: "e" }
  let straight = 0
  let corner = 0
  for (let seed = 1; seed <= 12; seed += 1) {
    const map = generateMap({ ...LEVEL_PRESETS[2], seed })
    for (const row of map.cells) {
      for (const tile of row) {
        const sides = ["n", "e", "s", "w"].filter((side) => tile[side].road === 1)
        if (sides.length !== 2) continue
        if (opposite[sides[0]] === sides[1]) straight += 1
        else corner += 1
      }
    }
  }
  assert.ok(straight > corner, `прямых ${straight}, поворотов ${corner}`)
})

test("дороги почти не пересекаются", () => {
  let junctions = 0
  let roadCells = 0
  for (let seed = 1; seed <= 12; seed += 1) {
    const map = generateMap({ ...LEVEL_PRESETS[2], seed })
    for (const row of map.cells) {
      for (const tile of row) {
        const count = ["n", "e", "s", "w"].filter((side) => tile[side].road === 1).length
        if (count > 0) roadCells += 1
        if (count >= 3) junctions += 1
      }
    }
  }
  assert.equal(junctions, 0)
  assert.ok(roadCells > 30, `клеток с дорогой ${roadCells}`)
})

test("одинаковые стороны равны, разные нет", () => {
  const a = edge({ road: 1, grassColor: 3, grassHeight: 2 })
  const b = edge({ road: 1, grassColor: 3, grassHeight: 2 })
  const c = edge({ road: 0, grassColor: 3, grassHeight: 2 })
  assert.equal(edgesEqual(a, b, ["road", "grassColor", "grassHeight"]), true)
  assert.equal(edgesEqual(a, c, ["road"]), false)
})
