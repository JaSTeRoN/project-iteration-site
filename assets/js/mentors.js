const MENTORS_KEY = ["rGHibv4zNpWJNT4CLE", "dbhZb8GTYiEa6A4bUTm/2r1bg="].join("")

function fromBase64(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function safeVk(value) {
  try {
    const url = new URL(value)
    if (url.protocol === "https:" || url.protocol === "http:") return url.href
  } catch {
    return ""
  }
  return ""
}

async function decrypt(buffer) {
  const bytes = new Uint8Array(buffer)
  const iv = bytes.slice(0, 12)
  const payload = bytes.slice(12)
  const key = await crypto.subtle.importKey("raw", fromBase64(MENTORS_KEY), "AES-GCM", false, ["decrypt"])
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, payload)
}

async function fetchBytes(url) {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error(String(response.status))
  return response.arrayBuffer()
}

function buildCard(mentor, photoUrl) {
  const card = document.createElement("article")
  card.className = "mentor-card"

  const plate = document.createElement("div")
  plate.className = "mentor-photo"
  const image = document.createElement("img")
  image.src = photoUrl
  image.alt = mentor.name
  image.loading = "eager"
  image.decoding = "async"
  plate.append(image)

  const name = document.createElement("h3")
  name.textContent = mentor.name
  const role = document.createElement("p")
  role.textContent = mentor.role
  card.append(plate, name, role)

  const href = safeVk(mentor.vk)
  if (href) {
    const link = document.createElement("a")
    link.className = "mentor-link"
    link.href = href
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    link.textContent = "ВКонтакте"
    card.append(link)
  }
  return card
}

async function loadMentors() {
  const grid = document.querySelector("#mentor-grid")
  const status = document.querySelector("#mentors-status")
  if (!grid || !status) return
  if (!window.crypto?.subtle) {
    status.textContent = "Не удалось показать наставников в этом браузере."
    return
  }
  try {
    const payload = await decrypt(await fetchBytes("data/mentors.enc"))
    const data = JSON.parse(new TextDecoder().decode(payload))
    if (!Array.isArray(data.mentors)) throw new Error("bad payload")

    const cards = []
    for (const mentor of data.mentors) {
      const number = String(mentor.id).replace("mentor", "")
      const photo = await decrypt(await fetchBytes(`assets/mentors/m${number}.enc`))
      const photoUrl = URL.createObjectURL(new Blob([photo], { type: "image/webp" }))
      cards.push(buildCard(mentor, photoUrl))
    }
    grid.replaceChildren(...cards)
    grid.hidden = false
    status.hidden = true
  } catch {
    status.textContent = "Не удалось загрузить информацию о наставниках."
  }
}

loadMentors()
