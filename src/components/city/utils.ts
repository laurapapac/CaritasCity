import * as THREE from "three"
import type { Block, Blueprint } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Colour constants
// ─────────────────────────────────────────────────────────────────────────────

export const GLASS_HEX      = 0x90c8d8
export const HIGHLIGHT_HEX  = 0xffff44
// Long enough to survive real-world reaction time: type a 6-char code, wait for
// the API round-trip, then actually find the right spot on a wall that may now
// have many other blocks in frame (see FOCUS_OFFSET in cityScene.ts).
export const HIGHLIGHT_DUR  = 5.0   // seconds

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
