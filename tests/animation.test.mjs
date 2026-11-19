import test from "node:test"
import assert from "node:assert/strict"
import { clamp, gaitPose, jumpStep, lerp } from "../assets/js/animation/motion.js"

test("clamp and lerp stay in range", () => {
  assert.equal(clamp(-5, 0, 10), 0)
  assert.equal(clamp(15, 0, 10), 10)
  assert.equal(lerp(0, 10, 0.5), 5)
})

test("gait gives legs and arms opposite phases", () => {
  const pose = gaitPose(0.9, 20, 8)
  assert.ok(pose.leftLeg > 0)
  assert.ok(pose.rightLeg < 0)
  assert.ok(pose.leftArm < 0)
  assert.ok(pose.rightArm > 0)
  assert.ok(Math.abs(pose.leftLeg + pose.rightLeg) < 1e-9)
  assert.ok(pose.bob >= 0 && pose.bob <= 1)
})

test("jump integrates gravity and lands at zero", () => {
  let y = 0
  let velocity = -540
  let landed = false
  for (let i = 0; i < 200 && !landed; i += 1) {
    const result = jumpStep(y, velocity, 1 / 60)
    y = result.y
    velocity = result.velocity
    landed = result.landed
    assert.ok(y <= 0)
  }
  assert.equal(landed, true)
  assert.equal(y, 0)
  assert.equal(velocity, 0)
})
