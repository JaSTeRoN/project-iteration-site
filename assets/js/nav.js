const header = document.querySelector(".site-header")
const toggle = document.querySelector(".nav-toggle")
const nav = document.querySelector("#site-nav")

if (header && toggle && nav) {
  header.classList.add("nav-ready")

  const title = toggle.querySelector(".nav-toggle-title")
  const current = nav.querySelector('[aria-current="page"]')
  const page = location.pathname.split("/").pop() || "index.html"
  if (title) {
    title.textContent = current ? current.textContent.trim() : page === "index.html" ? "Главная" : "Разделы"
  }

  const isOpen = () => header.classList.contains("nav-open")
  const setOpen = (open) => {
    header.classList.toggle("nav-open", open)
    toggle.setAttribute("aria-expanded", String(open))
  }

  toggle.addEventListener("click", (event) => {
    event.stopPropagation()
    setOpen(!isOpen())
  })

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false)
  })

  document.addEventListener("click", (event) => {
    if (isOpen() && !header.contains(event.target)) setOpen(false)
  })

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false)
      toggle.focus()
    }
  })

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) setOpen(false)
  })
}
