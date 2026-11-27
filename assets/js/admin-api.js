const SESSION_KEY = "iteration-admin-session"
export const SESSION_TTL = 12 * 60 * 60 * 1000

export const REPO = "JaSTeRoN/project-iteration-site"
export const BRANCH = "main"

function requestError(message, status) {
  const error = new Error(message)
  error.status = status
  return error
}

function errorText(status) {
  if (status === 401) return "GitHub ответил 401: токен не подошёл или истёк."
  if (status === 403) return "GitHub ответил 403: токену не хватает права Contents: Read and write."
  if (status === 404) return "GitHub ответил 404: нет доступа к файлу или его нет в репозитории."
  if (status === 409) return "Файл на GitHub успели изменить. Перезагрузите раздел и повторите правку."
  if (status === 422) return "GitHub ответил 422: проверьте права токена на содержимое репозитория."
  return `GitHub ответил ${status}.`
}

export function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session.token || !session.expires || Date.now() > session.expires) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      // хранилище недоступно — считаем, что сессии нет
    }
    return null
  }
}

export function writeSession({ token, login, permission, issuedAt }) {
  // Срок отсчитывается от входа и не продлевается при перезагрузке админки.
  const started = Number.isFinite(issuedAt) ? issuedAt : Date.now()
  const session = { token, login, permission, issuedAt: started, expires: started + SESSION_TTL }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function canWrite(session) {
  return Boolean(session) && ["admin", "maintain", "write"].includes(session.permission)
}

export async function signIn(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token.trim()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  }
  const userResponse = await fetch("https://api.github.com/user", { headers })
  if (userResponse.status === 401) {
    throw requestError("Токен не подошёл: проверьте, что он активен и не истёк.", 401)
  }
  if (!userResponse.ok) throw requestError(errorText(userResponse.status), userResponse.status)
  const user = await userResponse.json()

  const repoResponse = await fetch(`https://api.github.com/repos/${REPO}`, { headers })
  if (!repoResponse.ok) {
    throw requestError("Не удалось прочитать репозиторий — проверьте права токена.", repoResponse.status)
  }
  const repo = await repoResponse.json()
  const permissions = repo.permissions || {}
  const permission = permissions.admin
    ? "admin"
    : permissions.maintain
      ? "maintain"
      : permissions.push
        ? "write"
        : "read"

  return { token: token.trim(), login: user.login, permission }
}

export function createApi(session) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${session.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  }
  const contents = (path) => `https://api.github.com/repos/${REPO}/contents/${path}`

  async function send(url, options) {
    return fetch(url, { ...options, headers: { ...headers, ...(options?.headers || {}) } })
  }

  async function load(path) {
    const response = await send(`${contents(path)}?ref=${BRANCH}`)
    if (response.status === 404) return { sha: "", data: null }
    if (!response.ok) throw new Error(errorText(response.status))
    const payload = await response.json()
    const text = new TextDecoder().decode(
      Uint8Array.from(atob(payload.content.replace(/\n/g, "")), (char) => char.charCodeAt(0)),
    )
    return { sha: payload.sha, data: JSON.parse(text) }
  }

  async function put(path, base64, message, sha) {
    const response = await send(contents(path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, content: base64, sha: sha || undefined, branch: BRANCH }),
    })
    if (!response.ok) throw new Error(errorText(response.status))
    const payload = await response.json()
    return { sha: payload.content.sha }
  }

  function fileBase64(file) {
    if (file.base64) return file.base64
    if (file.text !== undefined) return textBase64(file.text)
    const data = file.data !== undefined ? file.data : null
    return textBase64(`${JSON.stringify(data, null, 2)}\n`)
  }

  async function saveMany(files, message) {
    if (!Array.isArray(files) || files.length === 0) return { sha: "", files: {} }
    const git = `https://api.github.com/repos/${REPO}/git`
    const reference = await send(`${git}/ref/heads/${BRANCH}`)
    if (!reference.ok) throw new Error(errorText(reference.status))
    const head = await reference.json()
    const commit = await send(`${git}/commits/${head.object.sha}`)
    if (!commit.ok) throw new Error(errorText(commit.status))
    const baseCommit = await commit.json()

    const blobs = await Promise.all(
      files.map(async (file) => {
        const response = await send(`${git}/blobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: fileBase64(file), encoding: "base64" }),
        })
        if (!response.ok) throw new Error(errorText(response.status))
        const payload = await response.json()
        return { path: file.path, sha: payload.sha }
      }),
    )

    const treeResponse = await send(`${git}/trees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: blobs.map((blob) => ({ path: blob.path, mode: "100644", type: "blob", sha: blob.sha })),
      }),
    })
    if (!treeResponse.ok) throw new Error(errorText(treeResponse.status))
    const tree = await treeResponse.json()

    const commitResponse = await send(`${git}/commits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, tree: tree.sha, parents: [head.object.sha] }),
    })
    if (!commitResponse.ok) throw new Error(errorText(commitResponse.status))
    const nextCommit = await commitResponse.json()

    const refResponse = await send(`${git}/refs/heads/${BRANCH}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: nextCommit.sha }),
    })
    if (!refResponse.ok) throw new Error(errorText(refResponse.status))

    return {
      sha: nextCommit.sha,
      files: Object.fromEntries(blobs.map((blob) => [blob.path, blob.sha])),
    }
  }

  const textEncoder = new TextEncoder()

  function textBase64(text) {
    return btoa(String.fromCharCode(...textEncoder.encode(text)))
  }

  return {
    session,
    canWrite: canWrite(session),
    load,
    async save(path, data, message, sha) {
      return put(path, textBase64(`${JSON.stringify(data, null, 2)}\n`), message, sha)
    },
    async upload(path, base64, message) {
      return put(path, base64, message, "")
    },
    saveMany,
  }
}
