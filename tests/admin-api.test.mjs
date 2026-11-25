import assert from "node:assert/strict"
import test from "node:test"

import { createApi } from "../assets/js/admin-api.js"

test("saveMany writes several files in one Git commit", async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  let blob = 0
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input)
    const method = options.method || "GET"
    calls.push({ url, method, body: options.body })
    const ok = (payload) => ({ ok: true, status: 200, json: async () => payload })
    if (url.endsWith("/git/ref/heads/main")) return ok({ object: { sha: "head-sha" } })
    if (url.endsWith("/git/commits/head-sha")) return ok({ tree: { sha: "base-tree" } })
    if (url.endsWith("/git/blobs")) {
      blob += 1
      return ok({ sha: `blob-${blob}` })
    }
    if (url.endsWith("/git/trees")) return ok({ sha: "new-tree" })
    if (url.endsWith("/git/commits") && method === "POST") return ok({ sha: "new-commit" })
    if (url.endsWith("/git/refs/heads/main") && method === "PATCH") return ok({})
    throw new Error(`Unexpected request: ${method} ${url}`)
  }

  try {
    const api = createApi({ token: "token", login: "user", permission: "admin" })
    const result = await api.saveMany(
      [
        { path: "data/schedule.json", data: { events: [{ id: "1" }] } },
        { path: "materials/slide.pdf", base64: "cGRm" },
      ],
      "Update schedule and materials",
    )
    assert.equal(result.sha, "new-commit")
    assert.deepEqual(result.files, {
      "data/schedule.json": "blob-1",
      "materials/slide.pdf": "blob-2",
    })
    assert.equal(calls.filter((call) => call.url.endsWith("/git/blobs")).length, 2)
    const tree = calls.find((call) => call.url.endsWith("/git/trees"))
    assert.ok(tree)
    const treeBody = JSON.parse(tree.body)
    assert.equal(treeBody.base_tree, "base-tree")
    assert.deepEqual(treeBody.tree.map((item) => item.path), ["data/schedule.json", "materials/slide.pdf"])
    const commit = calls.find((call) => call.url.endsWith("/git/commits") && call.method === "POST")
    assert.equal(JSON.parse(commit.body).parents[0], "head-sha")
  } finally {
    globalThis.fetch = originalFetch
  }
})
