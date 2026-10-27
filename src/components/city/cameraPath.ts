import type { CameraState } from "./cityScene"

// Camera fly-through between logged shots (2026-10-23, user request) — the
// shots are exactly what the camera logger's "Copy" gives (extra fields like
// distance/headingDeg are ignored and recomputed from position/target).
// Dev tooling only, see DevBuildSequence.tsx.

/** One logged shot; `durationMs` = time to travel here from the previous shot (ignored on the first). */
export type CameraKeyframe = CameraState & { durationMs?: number }

interface Orbit {
  target: { x: number; y: number; z: number }
  distance: number
  heading: number // radians, atan2(dx, dz) — 0 = camera north of target
  tilt: number // radians below horizon
  fov: number
}

function toOrbit(s: CameraState, fallbackFov: number): Orbit {
  const dx = s.position.x - s.target.x
  const dy = s.position.y - s.target.y
  const dz = s.position.z - s.target.z
  const distance = Math.hypot(dx, dy, dz) || 1
  return {
    target: { ...s.target },
    distance,
    heading: Math.atan2(dx, dz),
    tilt: Math.asin(-dy / distance),
    fov: s.fov ?? fallbackFov,
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Which way the camera swings between shots. "shortest" takes the smaller
 * turn (350° → 10° turns 20°, not 340°), which can reverse direction from
 * one shot to the next. "clockwise"/"counterclockwise" are as the city
 * appears to turn on screen; clockwise = heading increasing (N → E → S → W),
 * checked by projecting points through a three.js camera. Either can turn
 * more than 180° to keep going the same way.
 */
export type CameraSpin = "shortest" | "clockwise" | "counterclockwise"

const TAU = 2 * Math.PI
const mod = (n: number) => ((n % TAU) + TAU) % TAU

function lerpAngle(a: number, b: number, t: number, spin: CameraSpin) {
  let d: number
  if (spin === "clockwise") d = mod(b - a) // heading increases
  else if (spin === "counterclockwise") d = -mod(a - b) // heading decreases
  else {
    d = mod(b - a)
    if (d > Math.PI) d -= TAU
  }
  return a + d * t
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export function cameraPathDuration(path: CameraKeyframe[]) {
  return path.slice(1).reduce((sum, k) => sum + Math.max(0, k.durationMs ?? 0), 0)
}

/**
 * Camera state `elapsedMs` into the path. Interpolates in orbit terms —
 * target, distance, heading, tilt, fov — rather than raw position, so the
 * camera swings around what it looks at instead of cutting straight through
 * the scene. `ease` reshapes the whole path's time (one gentle start/stop,
 * no halt at the in-between shots).
 */
export function cameraStateAt(
  path: CameraKeyframe[],
  elapsedMs: number,
  ease: (t: number) => number = (t) => t,
  spin: CameraSpin = "shortest"
): CameraState {
  const fallbackFov = path[0].fov ?? 50
  const total = cameraPathDuration(path)
  if (path.length < 2 || total <= 0) return path[path.length - 1]
  let ms = ease(Math.min(1, Math.max(0, elapsedMs / total))) * total

  for (let i = 1; i < path.length; i++) {
    const seg = Math.max(0, path[i].durationMs ?? 0)
    if (ms <= seg || i === path.length - 1) {
      const t = seg > 0 ? Math.min(1, ms / seg) : 1
      const a = toOrbit(path[i - 1], fallbackFov)
      const b = toOrbit(path[i], fallbackFov)
      const target = {
        x: lerp(a.target.x, b.target.x, t),
        y: lerp(a.target.y, b.target.y, t),
        z: lerp(a.target.z, b.target.z, t),
      }
      const distance = lerp(a.distance, b.distance, t)
      const heading = lerpAngle(a.heading, b.heading, t, spin)
      const tilt = lerp(a.tilt, b.tilt, t)
      const horiz = distance * Math.cos(tilt)
      return {
        position: {
          x: target.x + horiz * Math.sin(heading),
          y: target.y - distance * Math.sin(tilt),
          z: target.z + horiz * Math.cos(heading),
        },
        target,
        fov: lerp(a.fov, b.fov, t),
      }
    }
    ms -= seg
  }
  return path[path.length - 1]
}
