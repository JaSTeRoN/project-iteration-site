import assert from "node:assert/strict"
import test from "node:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"

const root = new URL("../", import.meta.url)

function pages() {
  const top = readdirSync(root).filter((name) => name.endsWith(".html"))
  const nested = readdirSync(new URL("materials/", root))
    .filter((name) => name.endsWith(".html"))
    .map((name) => `materials/${name}`)
  return [...top, ...nested]
}

test("каждая страница подключает иконку и манифест", () => {
  const files = pages()
  assert.ok(files.length >= 20, `страниц слишком мало: ${files.length}`)
  for (const file of files) {
    const html = readFileSync(new URL(file, root), "utf8")
    assert.match(html, /rel="icon" href="\/assets\/brand\/favicon\.svg"/, `нет SVG-иконки: ${file}`)
    assert.match(html, /rel="apple-touch-icon" href="\/assets\/brand\/apple-touch-icon\.png"/, `нет apple-touch-icon: ${file}`)
    assert.match(html, /rel="manifest" href="\/site\.webmanifest"/, `нет манифеста: ${file}`)
  }
})

test("файлы иконок существуют, манифест корректен", () => {
  for (const path of [
    "favicon.ico",
    "site.webmanifest",
    "assets/brand/favicon.svg",
    "assets/brand/favicon-32.png",
    "assets/brand/apple-touch-icon.png",
    "assets/brand/icon-192.png",
    "assets/brand/icon-512.png",
    "assets/brand/icon-512-maskable.png",
  ]) {
    assert.ok(existsSync(new URL(path, root)), `нет файла: ${path}`)
  }

  const manifest = JSON.parse(readFileSync(new URL("site.webmanifest", root), "utf8"))
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, "в манифесте нет иконок")
  for (const icon of manifest.icons) {
    assert.ok(existsSync(new URL(icon.src.replace(/^\//, ""), root)), `нет иконки из манифеста: ${icon.src}`)
  }
})
