import * as THREE from "three"
import type { Block, Blueprint } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Colour constants
// ─────────────────────────────────────────────────────────────────────────────

export const GLASS_HEX      = 0x90c8d8

// ─────────────────────────────────────────────────────────────────────────────
// Drop-in placement animation (revealBlockAt) — shared by a real user's own
// placement (addBlock, played once camera is already framed on the block) and
// the ambient decoration-construction loop (playAmbientCycle). The block
// falls from above and lands with a hard stop — no squash/bounce (2026-08-28,
// user feedback: read as too bouncy). Real (accelerating) gravity physics:
// distance fallen grows with t³, so it starts slow and speeds up hard into
// the landing (2026-08-28: an earlier ease-out version, which starts fast and
// slows down, was a wrong-direction fix for a genuine ease-in bug — the
// previous ease-in was paired with too short a duration/too tall a drop, so
// almost all the perceptible motion got compressed into the fall's last
// sliver of time; the real fix was slowing the whole fall down, not flipping
// the curve). Cubic rather than quadratic (2026-08-28, follow-up user
// feedback: the overall fall read as too slow, but the slow start itself was
// liked and shouldn't just get uniformly sped up) — t³ keeps the first ~0.2s
// nearly identical in real time to the old t²/0.5s curve (actually a touch
// slower), then accelerates harder through the back half so it lands in
// DROP_FALL_DUR instead of dragging out.
// ─────────────────────────────────────────────────────────────────────────────

// World units the block falls from above its resting position.
export const DROP_HEIGHT = 3.0
// Fall duration, seconds. 0.5→0.38 (2026-08-28, user feedback: too slow
// overall) — paired with the t³ curve above so the cut comes out of the
// back half of the fall, not the slow start.
export const DROP_FALL_DUR = 0.38

// ─────────────────────────────────────────────────────────────────────────────
// "This is your block" marker (markOwnBlock in cityScene.ts) — a persistent,
// gently-pulsing lit look on exactly one block's OWN instance colour:
// whichever one the CURRENT kiosk session most recently placed, or re-found
// via its own code. Purely client-side/local, and there is only ever one at
// a time — marking a new block moves it, so a kiosk cycling between
// different real users' codes always shows the CURRENT one's own block, and
// looks entirely normal to anyone viewing a different kiosk (2026-08-28,
// user request). 2026-08-28, follow-up: replaces an earlier version that
// used a separate camera-facing glow sprite floating near the block — user
// disliked the "circular sprite" look and wanted the block ITSELF to read as
// lit up instead, so this blends the block's own colour toward white rather
// than adding any extra geometry. 2026-08-28, second follow-up ("more
// opacity would look better"): initially misread as "swap white for a
// different tint" and tried a warm gold — user clarified they liked white,
// just wanted a lower peak blend fraction (i.e. literally more opaque —
// less washed-out — at the pulse's brightest), so this stays white, just at
// a lower OWN_BLOCK_BLEND_MAX than the first attempt.
// ─────────────────────────────────────────────────────────────────────────────

export const OWN_BLOCK_LIT_HEX = 0xffffff   // white "lit" tone blended toward
export const OWN_BLOCK_BLEND_MIN = 0.1      // fraction of OWN_BLOCK_LIT_HEX at the pulse's dim point
export const OWN_BLOCK_BLEND_MAX = 0.3      // fraction of OWN_BLOCK_LIT_HEX at the pulse's bright point — capped low so the block's own colour stays clearly visible even at peak
export const OWN_BLOCK_PULSE_PERIOD = 2.0   // seconds per breathing cycle

export const TYPE_COLORS: Record<string, number> = {
  wall:    0xc05030,
  brick:   0xc05030,
  roof:    0x8b3a3a,
  window:  GLASS_HEX,
  glass:   GLASS_HEX,
  floor:   0x888888,
  stone:   0x888888,
  chimney: 0x666666,
  wood:    0x8b5e3c,
  path:    0xa09070,
}

export function resolveColor(b: Block): number {
  if (b.color !== undefined) {
    return typeof b.color === "number"
      ? b.color
      : parseInt(String(b.color).replace(/^0x/i, ""), 16)
  }
  return TYPE_COLORS[b.type] ?? 0x888888
}

export const isGlass = (b: Block): boolean => resolveColor(b) === GLASS_HEX

// ─────────────────────────────────────────────────────────────────────────────
// Index lookup tables
// solidUpTo[i] = number of solid blocks in blocks[0..i-1]
// glassUpTo[i] = number of glass blocks in blocks[0..i-1]
// Gives O(1) InstancedMesh index lookup per addBlock call.
// ─────────────────────────────────────────────────────────────────────────────

export function computeUpTo(blocks: Block[]) {
  const n = blocks.length
  const solidUpTo = new Int32Array(n + 1)
  const glassUpTo = new Int32Array(n + 1)
  let s = 0, g = 0
  for (let i = 0; i < n; i++) {
    solidUpTo[i] = s
    glassUpTo[i] = g
    if (isGlass(blocks[i])) g++; else s++
  }
  solidUpTo[n] = s
  glassUpTo[n] = g
  return { solidUpTo, glassUpTo }
}

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint → world-space Block[]
// Centres the blueprint footprint on the building's world position,
// then sorts bottom-up (y asc) with x, z as tiebreakers.
// ─────────────────────────────────────────────────────────────────────────────

export function processBlueprint(
  blueprint: Blueprint,
  worldPos: { x: number; z: number }
): Block[] {
  const voxels = blueprint.voxels
  if (voxels.length === 0) return []

  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (const v of voxels) {
    if (v.x < minX) minX = v.x
    if (v.x > maxX) maxX = v.x
    if (v.z < minZ) minZ = v.z
    if (v.z > maxZ) maxZ = v.z
  }
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2

  return voxels
    .map((v) => ({
      x: v.x - cx + worldPos.x,
      y: v.y,
      z: v.z - cz + worldPos.z,
      type: v.type,
      color: v.color,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z)
}

// ─────────────────────────────────────────────────────────────────────────────
// Block-face canvas texture (module-level singleton)
// Edge-darkening bevel + per-pixel grain; multiplies with per-instance colour.
// ─────────────────────────────────────────────────────────────────────────────

function makeBlockTexture(): THREE.CanvasTexture {
  const S   = 64
  const buf = new Uint8ClampedArray(S * S * 4)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ex    = Math.min(x, S - 1 - x) / (S * 0.14)
      const ey    = Math.min(y, S - 1 - y) / (S * 0.14)
      const bevel = 0.55 + 0.45 * Math.min(1, Math.min(ex, ey))
      const grain = 1 + (Math.random() - 0.5) * 0.16
      const v     = Math.min(255, Math.max(0, Math.round(255 * bevel * grain)))
      const i     = (y * S + x) * 4
      buf[i] = buf[i + 1] = buf[i + 2] = v
      buf[i + 3] = 255
    }
  }
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = S
  canvas.getContext("2d")!.putImageData(new ImageData(buf, S, S), 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  return tex
}

export const BLOCK_TEX = makeBlockTexture()
