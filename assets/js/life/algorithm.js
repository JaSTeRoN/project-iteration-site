import { makeRng } from "../rng.js"

export const PATTERNS = {
  glider: {
    name: "Планер",
    rows: [".#.", "..#", "###"],
  },
  blinker: {
    name: "Мигалка",
    rows: ["###"],
  },
  pulsar: {
    name: "Пульсар",
    rows: [
      "..###...###..",
      ".............",
      "#....#.#....#",
      "#....#.#....#",
      "#....#.#....#",
      "..###...###..",
      ".............",
      "..###...###..",
      "#....#.#....#",
      "#....#.#....#",
      "#....#.#....#",
      ".............",
      "..###...###..",
    ],
  },
  gosper: {
    name: "Ружьё Госпера",
    rows: [
      "........................#...........",
      "......................#.#...........",
      "............##......##............##",
      "...........#...#....##............##",
      "##........#.....#...##..............",
      "##........#...#.##....#.#...........",
      "..........#.....#.......#...........",
      "...........#...#....................",
      "............##......................",
    ],
  },
}

export function makeBoard(rows, cols, fill = 0) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    throw new Error("Размер поля должен быть положительным")
  }
  return Array.from({ length: rows }, () => Array(cols).fill(fill ? 1 : 0))
}

export function countNeighbors(board, x, y, wrap = false) {
  const rows = board.length
  const cols = board[0].length
  let total = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      let nx = x + dx
      let ny = y + dy
      if (wrap) {
        nx = (nx + cols) % cols
        ny = (ny + rows) % rows
      } else if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
        continue
      }
      total += board[ny][nx] ? 1 : 0
    }
  }
  return total
}

export function stepLife(board, { wrap = false } = {}) {
  const rows = board.length
  const cols = board[0].length
  const next = makeBoard(rows, cols)
  const changes = []
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const alive = board[y][x] === 1
      const neighbors = countNeighbors(board, x, y, wrap)
      const nextAlive = neighbors === 3 || (alive && neighbors === 2)
      next[y][x] = nextAlive ? 1 : 0
      if (alive !== nextAlive) {
        changes.push({ x, y, alive, next: nextAlive, neighbors })
      }
    }
  }
  return { board: next, changes, born: changes.filter((item) => !item.alive), died: changes.filter((item) => item.alive) }
}

export function countPopulation(board) {
  let total = 0
  for (const row of board) {
    for (const cell of row) total += cell ? 1 : 0
  }
  return total
}

export function toggleCell(board, x, y) {
  board[y][x] = board[y][x] ? 0 : 1
}

export function createRandomBoard(rows, cols, density = 0.28, seed = 1) {
  const rng = makeRng(seed)
  const board = makeBoard(rows, cols)
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      board[y][x] = rng() < density ? 1 : 0
    }
  }
  return board
}

export function fromRows(rows) {
  return rows.map((row) => [...row].map((cell) => (cell === "#" ? 1 : 0)))
}

export function patternToBoard(pattern, padding = 1) {
  const source = Array.isArray(pattern) ? pattern : pattern.rows
  const width = Math.max(...source.map((row) => row.length))
  const height = source.length
  const board = makeBoard(height + padding * 2, width + padding * 2)
  stampPattern(board, source, padding, padding)
  return board
}

export function stampPattern(board, pattern, originX = 0, originY = 0) {
  const source = Array.isArray(pattern) ? pattern : pattern.rows
  for (let y = 0; y < source.length; y += 1) {
    for (let x = 0; x < source[y].length; x += 1) {
      if (source[y][x] !== "#") continue
      const boardX = originX + x
      const boardY = originY + y
      if (boardY >= 0 && boardY < board.length && boardX >= 0 && boardX < board[0].length) {
        board[boardY][boardX] = 1
      }
    }
  }
  return board
}

export function patternSize(pattern) {
  const source = Array.isArray(pattern) ? pattern : pattern.rows
  return { width: Math.max(...source.map((row) => row.length)), height: source.length }
}
