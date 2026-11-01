export function worldToScreen(point, view, width, height) {
  return {
    x: (point.x - view.camX) * view.zoom + width / 2,
    y: (point.y - view.camY) * view.zoom + height / 2,
  }
}

export function screenToWorld(sx, sy, view, width, height) {
  return {
    x: (sx - width / 2) / view.zoom + view.camX,
    y: (sy - height / 2) / view.zoom + view.camY,
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Панорамирование одним пальцем, щипок двумя, короткий щелчок и короткий свайп.
 * Жесты мыши и касания проходят через один и тот же обработчик.
 */
export function bindPointer(el, view, handlers = {}) {
  const pointers = new Map()
  let origin = null
  let moved = false
  let pinching = false
  let pinchDistance = 0

  function localPoint(event) {
    const rect = el.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      w: rect.width,
      h: rect.height,
    }
  }

  function pairDistance() {
    const points = [...pointers.values()]
    if (points.length < 2) return 0
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1
  }

  el.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return
    el.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, localPoint(event))
    if (pointers.size === 1) {
      const point = localPoint(event)
      origin = { ...point, camX: view.camX, camY: view.camY, t: performance.now() }
      moved = false
    } else if (pointers.size === 2) {
      pinching = true
      pinchDistance = pairDistance()
    }
  })

  el.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, localPoint(event))
    if (pointers.size >= 2 && pinchDistance > 0) {
      const next = pairDistance()
      const ratio = next / pinchDistance
      pinchDistance = next
      const points = [...pointers.values()]
      const mx = (points[0].x + points[1].x) / 2
      const my = (points[0].y + points[1].y) / 2
      const before = screenToWorld(mx, my, view, points[0].w, points[0].h)
      view.zoom = clamp(view.zoom * ratio, 0.25, 5)
      const after = screenToWorld(mx, my, view, points[0].w, points[0].h)
      view.camX += before.x - after.x
      view.camY += before.y - after.y
      return
    }
    if (!origin || pointers.size !== 1) return
    const point = localPoint(event)
    const dx = point.x - origin.x
    const dy = point.y - origin.y
    if (Math.hypot(dx, dy) > 6) moved = true
    if (moved) {
      view.camX = origin.camX - dx / view.zoom
      view.camY = origin.camY - dy / view.zoom
    }
  })

  function finish(event) {
    if (!pointers.has(event.pointerId)) return
    pointers.delete(event.pointerId)
    if (pinching) {
      if (pointers.size < 2) {
        pinching = false
        origin = null
        moved = false
      }
      return
    }
    if (!origin) return
    const point = localPoint(event)
    const dx = point.x - origin.x
    const dy = point.y - origin.y
    const distance = Math.hypot(dx, dy)
    const elapsed = performance.now() - origin.t
    if (!moved && distance < 8) {
      handlers.onTap?.(point.x, point.y)
    } else if (handlers.onSwipe && elapsed < 280 && distance > 32) {
      view.camX = origin.camX
      view.camY = origin.camY
      const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "e" : "w") : (dy > 0 ? "s" : "n")
      handlers.onSwipe(direction)
    }
    origin = null
    moved = false
  }

  el.addEventListener("pointerup", finish)
  el.addEventListener("pointercancel", finish)
}
