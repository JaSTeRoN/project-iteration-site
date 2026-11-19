export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function lerp(from, to, amount) {
  return from + (to - from) * amount
}

export function gaitPose(phase, stepAmplitude = 18, armAmplitude = 8) {
  const swing = Math.sin(phase)
  return {
    leftLeg: swing * stepAmplitude,
    rightLeg: -swing * stepAmplitude,
    leftArm: -swing * armAmplitude,
    rightArm: swing * armAmplitude,
    bob: Math.abs(Math.sin(phase * 2)),
  }
}

export function jumpStep(y, velocity, dt, gravity = 1500) {
  let nextVelocity = velocity + gravity * dt
  let nextY = y + nextVelocity * dt
  let landed = false
  if (nextY >= 0) {
    nextY = 0
    nextVelocity = 0
    landed = true
  }
  return { y: nextY, velocity: nextVelocity, landed }
}
