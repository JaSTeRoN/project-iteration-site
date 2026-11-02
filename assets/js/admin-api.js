const SESSION_KEY = "iteration-admin-session"
const TTL = 12 * 60 * 60 * 1000

export const REPO = "JaSTeRoN/project-iteration-site"
export const BRANCH = "main"

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
    return null
  }
}

export function writeSession({ token, login, permission }) {
  const session = { token, login, permission, expires: Date.now() + TTL }
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
  if (userResponse.status === 401) throw new Error("Токен не подошёл: проверьте, что он активен и не истёк.")
  if (!userResponse.ok) throw new Error(errorText(userResponse.status))
  const user = await userResponse.json()

  const repoResponse = await fetch(`https://api.github.com/repos/${REPO}`, { headers })
  if (!repoResponse.ok) throw new Error("Не удалось прочитать репозиторий — проверьте права токена.")
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

  return {
    session,
    canWrite: canWrite(session),
    load,
    async save(path, data, message, sha) {
      const text = `${JSON.stringify(data, null, 2)}\n`
      const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(text)))
      return put(path, base64, message, sha)
    },
    async upload(path, base64, message) {
      return put(path, base64, message, "")
    },
  }
}
