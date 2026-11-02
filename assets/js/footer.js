const year = new Date().getFullYear()

for (const node of document.querySelectorAll("[data-year]")) {
  node.textContent = String(year)
}
