import assert from "node:assert/strict"
import test from "node:test"
import {
  PATTERNS,
  countNeighbors,
  countPopulation,
  createRandomBoard,
  fromRows,
  makeBoard,
  stampPattern,
  stepLife,
} from "../assets/js/life/algorithm.js"

function cells(board) {
  const result = []
  for (let y = 0; y < board.length; y += 1) {
    for (let x = 0; x < board[0].length; x += 1) {
      if (board[y][x]) result.push(`${x}:${y}`)
    }
  }
  return result.sort()
}

test("block is a still life", () => {
  const board = fromRows(["##", "##"])
  const next = stepLife(board)
  assert.deepEqual(next.board, board)
  assert.equal(next.changes.length, 0)
})

test("blinker has period two", () => {
  const board = makeBoard(5, 5)
  ;[[1, 2], [2, 2], [3, 2]].forEach(([x, y]) => {
    board[y][x] = 1
  })
  const second = stepLife(stepLife(board).board).board
  assert.deepEqual(second, board)
})

test("glider moves one cell down and right in four generations", () => {
  const board = makeBoard(8, 8)
  stampPattern(board, PATTERNS.glider, 1, 1)
  let current = board
  for (let i = 0; i < 4; i += 1) current = stepLife(current).board
  const expected = makeBoard(8, 8)
  stampPattern(expected, PATTERNS.glider, 2, 2)
  assert.deepEqual(cells(current), cells(expected))
})

test("dead cell with exactly three neighbours is born", () => {
  const board = makeBoard(5, 5)
  ;[[1, 2], [3, 2], [2, 1]].forEach(([x, y]) => {
    board[y][x] = 1
  })
  const next = stepLife(board).board
  assert.equal(next[2][2], 1)
})

test("one neighbour kills and four neighbours kill", () => {
  const lonely = makeBoard(5, 5)
  lonely[2][2] = 1
  lonely[2][1] = 1
  assert.equal(stepLife(lonely).board[2][2], 0)

  const crowded = makeBoard(5, 5)
  crowded[2][2] = 1
  ;[[1, 2], [3, 2], [1, 1], [2, 1]].forEach(([x, y]) => {
    crowded[y][x] = 1
  })
  assert.equal(stepLife(crowded).board[2][2], 0)
})

test("wrap counts neighbours through opposite edges", () => {
  const board = makeBoard(5, 5)
  board[0][0] = 1
  board[4][4] = 1
  assert.equal(countNeighbors(board, 0, 0, true), 1)
  assert.equal(countNeighbors(board, 0, 0, false), 0)
})

test("random boards are deterministic by seed", () => {
  const first = createRandomBoard(10, 12, 0.35, 99)
  const second = createRandomBoard(10, 12, 0.35, 99)
  assert.deepEqual(first, second)
  assert.ok(countPopulation(first) > 0)
})
