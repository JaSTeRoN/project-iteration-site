import assert from "node:assert/strict"
import test from "node:test"
import { existsSync, readFileSync } from "node:fs"

const page = new URL("../404.html", import.meta.url)
const html = readFileSync(page, "utf8")

function attributeValues(name) {
  return [...html.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((match) => match[1])
}

// GitHub Pages отдаёт содержимое 404.html по любому несуществующему адресу,
// поэтому относительные пути на этой странице ломаются на вложенных путях:
// /materials/1.pdf превращает "assets/site.css" в /materials/assets/site.css.
test("страница 404 ссылается на файлы от корня сайта", () => {
  const links = [...attributeValues("href"), ...attributeValues("src")]
  const local = links.filter((link) => link && !/^(#|https?:|mailto:|data:|\/\/)/i.test(link))

  assert.ok(local.length >= 10, `локальных ссылок слишком мало: ${local.length}`)
  for (const link of local) {
    assert.ok(link.startsWith("/"), `ссылка должна начинаться с /: ${link}`)
    assert.ok(existsSync(new URL(`.${link}`, page)), `файл не найден: ${link}`)
  }
})
