import assert from "node:assert/strict"
import { test } from "node:test"

import {
  LENGTHS,
  castOptions,
  generateStory,
  listEvents,
  replaceNode,
} from "../assets/js/narrative/engine.js"

test("story generation is deterministic for a seed", () => {
  const a = generateStory({ seed: 41, genre: "cyberpunk", tone: "grim", length: "long" })
  const b = generateStory({ seed: 41, genre: "cyberpunk", tone: "grim", length: "long" })
  assert.deepEqual(a.nodes, b.nodes)
  assert.deepEqual(a.trace, b.trace)
  assert.equal(a.title, b.title)
})

test("length controls the number of story nodes", () => {
  for (const [length, count] of [["short", 5], ["medium", 7], ["long", 8]]) {
    const story = generateStory({ seed: 7, length })
    assert.equal(story.nodes.length, count)
    assert.equal(story.trace.length, count)
    assert.deepEqual(story.nodes.map((node) => node.type), LENGTHS[length].types)
  }
})

test("required and forbidden events affect the obstacle", () => {
  const events = listEvents("fantasy")
  const required = events[0]
  const forbidden = events[1]
  const story = generateStory({
    seed: 12,
    genre: "fantasy",
    requiredEvent: required,
    forbiddenEvent: forbidden,
  })
  const obstacle = story.nodes.find((node) => node.type === "obstacle")
  assert.ok(obstacle.text.includes(required))
  assert.ok(!obstacle.text.includes(forbidden))
  assert.ok(story.trace.some((entry) => entry.detail.includes(required)))
})

test("locked nodes keep their text on regeneration", () => {
  const first = generateStory({ seed: 22, genre: "detective", tone: "grim" })
  const target = first.nodes.find((node) => node.type === "falseLead")
  const next = generateStory({
    ...first.options,
    seed: 99,
    locked: { falseLead: target },
  })
  assert.equal(next.nodes.find((node) => node.type === "falseLead").text, target.text)
  assert.equal(next.nodes.find((node) => node.type === "falseLead").locked, true)
})

test("replaceNode keeps the rest of the story intact", () => {
  const story = generateStory({ seed: 33, genre: "fantasy" })
  const next = replaceNode(story, "climax", 808)
  assert.equal(next.nodes.length, story.nodes.length)
  for (const node of story.nodes) {
    if (node.type === "climax") continue
    assert.equal(next.nodes.find((item) => item.type === node.type).text, node.text)
  }
})

test("cast and relationship are reflected in the text and trace", () => {
  const options = castOptions("fantasy")
  const hero = options.heroes[1]
  const ally = options.allies[0]
  const story = generateStory({
    seed: 44,
    genre: "fantasy",
    cast: { hero: hero.name, ally: ally.name },
    relationship: "rival",
  })
  assert.ok(story.nodes.find((node) => node.type === "call").text.includes(hero.name))
  assert.ok(story.trace.some((entry) => entry.detail.includes("соперник")))
  assert.ok(story.nodes.find((node) => node.type === "helper").text.includes(ally.name))
})

test("tone changes the generated language", () => {
  const heroic = generateStory({ seed: 55, genre: "detective", tone: "heroic" })
  const comic = generateStory({ seed: 55, genre: "detective", tone: "comic" })
  assert.notEqual(
    heroic.nodes.find((node) => node.type === "resolution").text,
    comic.nodes.find((node) => node.type === "resolution").text,
  )
})
