/**
 * House Blueprint Styler
 *
 * All 5 houses share the same 1 080-block structure from the source blueprint.
 * This module only ever RECOLORS blocks — it never adds or removes voxels —
 * so the total count is always identical to source.voxels.length.
 *
 * Customisable per house (without touching block count):
 *   - Wall, roof, trim, window colours (palette)
 *   - Which positions on each wall face are glass vs brick (window layout)
 *     controlled by windowSize, windowCount, windowOffset
 *
 * Window placement
 * ─────────────────
 * The source blueprint's glass blocks give us the canonical "window y-bands"
 * (e.g. y=2–3 for ground floor, y=8–9 for upper floor).  We keep those same
 * y bands but recompute WHICH x/z positions along each wall are glass, using
 * a repeating tile pattern driven by the style params.  Glass blocks that no
 * longer fall on a window position become brick, and vice-versa — count stays
 * the same.
 */

import type { Blueprint, BlueprintVoxel } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface HouseStyle {
  /** Hex string applied to every brick (wall) block. */
  wallColor:    string
  /** Hex string applied to every roof block. */
  roofColor:    string
  /** Hex string applied to every wood/trim block. */
  trimColor:    string
  /** Hex string applied to every glass (window) block. */
  windowColor:  string
  /**
   * Width of each window tile in blocks.
   * small = 1, medium = 2, large = 3
   */
  windowSize:   "small" | "medium" | "large"
  /**
   * How many brick blocks separate consecutive windows horizontally.
   * few = wider gaps, many = tighter packing.
   */
  windowCount:  "few" | "normal" | "many"
  /**
   * Shifts the window tiling pattern along the wall face (0–step).
   * Different offsets make neighbouring houses look varied.
   */
  windowOffset: number
  /** PRNG seed (reserved for future minor variation). */
  seed:         number
}

export type StylePreset =
  | "classic" | "nordic" | "adobe" | "modern" | "cottage"
  | "coastal" | "sunny" | "burgundy" | "lavender" | "charcoal"

// ─────────────────────────────────────────────────────────────────────────────
// Colour palettes (each entry = one possible pick per house)
// 10 presets total (2026-08-12, user request: "double the amount of colors
// used for houses, make it 10 instead of 5") — the original 5 plus 5 more
// distinct color families (coastal blue, sunny cream, burgundy wine-red,
// lavender mauve, charcoal near-black), each still deliberately different
// enough from its neighbors that a house's preset reads as a real color
// family, not just a slightly-different shade of an existing one.
// ─────────────────────────────────────────────────────────────────────────────

export const WALL_PALETTES: Record<StylePreset, readonly string[]> = {
  classic:  ["0xc05030", "0xb84030", "0xcc6644", "0xbe5040"],
  nordic:   ["0x7a8e6a", "0x8a9e7a", "0x6a7a5a", "0x90a07a"],
  adobe:    ["0xc09060", "0xb08050", "0xd0a070", "0xa07848"],
  modern:   ["0x8a8a8a", "0x9a9a9a", "0x7a7a7a", "0x888880"],
  cottage:  ["0xaa8866", "0x997755", "0xbb9977", "0xaa9060"],
  coastal:  ["0x6a95b0", "0x7aa5c0", "0x5a85a0", "0x8ab5d0"],
  sunny:    ["0xd9c078", "0xc9b068", "0xe0c888", "0xccaa60"],
  burgundy: ["0x6a2030", "0x7a2838", "0x5a1828", "0x8a3040"],
  lavender: ["0x9a7a9a", "0xaa8aaa", "0x8a6a8a", "0xb090b0"],
  charcoal: ["0x3a3a3a", "0x2a2a2a", "0x454545", "0x1a1a1a"],
}

export const ROOF_PALETTES: Record<StylePreset, readonly string[]> = {
  classic:  ["0x8b3a3a", "0x7a2a2a", "0x993a3a"],
  nordic:   ["0x445566", "0x334455", "0x3a4a66"],
  adobe:    ["0x7a5535", "0x8a6545", "0x6a4525"],
  modern:   ["0x334455", "0x223344", "0x445566"],
  cottage:  ["0x3a6033", "0x4a7043", "0x2a5025"],
  coastal:  ["0x2a3a55", "0x1a2a45", "0x33445a"],
  sunny:    ["0x6a4a2a", "0x5a3a1a", "0x7a5a3a"],
  burgundy: ["0x2a2a2a", "0x1a1a1a", "0x3a3a3a"],
  lavender: ["0x4a3a4a", "0x3a2a3a", "0x5a4a5a"],
  charcoal: ["0x1a1a1a", "0x0a0a0a", "0x252525"],
}

export const TRIM_PALETTES: Record<StylePreset, readonly string[]> = {
  classic:  ["0x8b5e3c", "0x7a4e2c"],
  nordic:   ["0x7a6a5a", "0x6a5a4a"],
  adobe:    ["0x9a7a4a", "0x8a6a3a"],
  modern:   ["0x666666", "0x777777"],
  cottage:  ["0x6b4828", "0x5b3818"],
  coastal:  ["0xe8e8e0", "0xd8d8d0"],
  sunny:    ["0xf0ead0", "0xe0dac0"],
  burgundy: ["0x3a2a28", "0x2a1a18"],
  lavender: ["0xe8e0e8", "0xd8d0d8"],
  charcoal: ["0xc0c0c0", "0xd0d0d0"],
}

export const WINDOW_PALETTES: Record<StylePreset, readonly string[]> = {
  classic:  ["0x90c8d8", "0x88bbcc"],
  nordic:   ["0xaaddee", "0x99ccdd"],
  adobe:    ["0x88ccaa", "0x99ddbb"],
  modern:   ["0xcceeFF", "0xddf0ff"],
  cottage:  ["0x99ddbb", "0x88cc99"],
  coastal:  ["0xaee0f5", "0x9ed0e8"],
  sunny:    ["0x90c8d8", "0x88bbcc"],
  burgundy: ["0xccaa88", "0xbb9977"],
  lavender: ["0xcce8f0", "0xbbd8e8"],
  charcoal: ["0xaad4e0", "0x9ac4d0"],
}

// ─────────────────────────────────────────────────────────────────────────────
// Seeded PRNG  (xorshift32)
// ─────────────────────────────────────────────────────────────────────────────

class RNG {
  private s: number
  constructor(seed: number) { this.s = ((seed ^ 0xdeadbeef) >>> 0) || 1 }
  next(): number {
    let s = this.s
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    this.s = s >>> 0
    return this.s / 0x100000000
  }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)] }
  int(a: number, b: number): number { return Math.floor(this.next() * (b - a + 1)) + a }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: restyle a blueprint without changing its block count
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a new Blueprint with exactly the same voxel positions as `source`,
 * but with colours and glass/brick assignments recomputed from `style`.
 *
 * Guaranteed: result.voxels.length === source.voxels.length
 */
export function generateHouseBlueprint(source: Blueprint, style: HouseStyle): Blueprint {
  const voxels = source.voxels

  // ── 1. Locate the 4 exterior wall faces ────────────────────────────────────
  // Strategy: count brick+glass blocks per z-value and per x-value (y > 0).
  // Faces are the outermost z/x values that have a significant block count
  // (filters out stray structural or path blocks at extreme coordinates).

  const zCount = new Map<number, number>()
  const xCount = new Map<number, number>()
  for (const v of voxels) {
    if ((v.type === "brick" || v.type === "glass") && v.y > 0) {
      zCount.set(v.z, (zCount.get(v.z) ?? 0) + 1)
      xCount.set(v.x, (xCount.get(v.x) ?? 0) + 1)
    }
  }

  const FACE_MIN_BLOCKS = 20  // minimum wall blocks to qualify as a real face

  const faceZs = [...zCount.entries()]
    .filter(([, n]) => n >= FACE_MIN_BLOCKS).map(([z]) => z).sort((a, b) => a - b)
  const faceXs = [...xCount.entries()]
    .filter(([, n]) => n >= FACE_MIN_BLOCKS).map(([x]) => x).sort((a, b) => a - b)

  if (faceZs.length < 2 || faceXs.length < 2) {
    // Fallback: return the source unchanged if we can't detect faces
    return source
  }

  const frontZ = faceZs[0]
  const backZ  = faceZs[faceZs.length - 1]
  const leftX  = faceXs[0]
  const rightX = faceXs[faceXs.length - 1]

  // ── 2. Derive window y-bands from existing glass blocks ────────────────────
  // The source blueprint tells us which y-values windows live on (e.g. 2–3, 8–9).
  // We reuse those same rows — only the horizontal positions change.

  const glassYsSorted = [...new Set(voxels.filter(v => v.type === "glass").map(v => v.y))]
    .sort((a, b) => a - b)

  // Group consecutive y-values into bands: [2,3], [8,9] → [[2,3],[8,9]]
  const yBands: number[][] = []
  for (const y of glassYsSorted) {
    const last = yBands[yBands.length - 1]
    if (last && y === last[last.length - 1] + 1) last.push(y)
    else yBands.push([y])
  }

  // Trim each band to windowHeight rows
  const windowHeight = style.windowSize === "large" ? 2 : style.windowSize === "medium" ? 2 : 1
  const activeYSet   = new Set(yBands.flatMap(band => band.slice(0, windowHeight)))

  // Fallback y-band if source has no glass
  if (activeYSet.size === 0) { activeYSet.add(2); activeYSet.add(3) }

  // ── 3. Compute new glass positions via tiling window pattern ───────────────

  const windowWidth = style.windowSize === "large" ? 3 : style.windowSize === "medium" ? 2 : 1
  const gapWidth    = { few: 3, normal: 2, many: 1 }[style.windowCount] ?? 2
  const windowStep  = windowWidth + gapWidth
  const offset      = style.windowOffset

  // Avoid placing windows in the outermost 2 blocks of each face (corner bricks)
  const BORDER = 2

  const newGlass = new Set<string>()

  /**
   * Mark glass positions on a single wall face.
   * `faceVoxels` — all voxels at that face's fixed coord.
   * `along`      — coordinate that varies along the face ("x" or "z").
   * `faceMin/Max`— range of the `along` coord on this face (for border guard).
   */
  function applyWindowPattern(
    faceVoxels: BlueprintVoxel[],
    along: "x" | "z",
    faceMin: number,
    faceMax: number,
  ) {
    for (const v of faceVoxels) {
      if ((v.type !== "brick" && v.type !== "glass") || !activeYSet.has(v.y)) continue

      const pos = v[along]
      if (pos < faceMin + BORDER || pos > faceMax - BORDER) continue  // skip corners

      const relPos = ((pos - faceMin - BORDER - offset) % windowStep + windowStep) % windowStep
      if (relPos < windowWidth) {
        newGlass.add(`${v.x},${v.y},${v.z}`)
      }
    }
  }

  applyWindowPattern(voxels.filter(v => v.z === frontZ), "x", leftX,  rightX)
  applyWindowPattern(voxels.filter(v => v.z === backZ),  "x", leftX,  rightX)
  applyWindowPattern(voxels.filter(v => v.x === leftX),  "z", frontZ, backZ)
  applyWindowPattern(voxels.filter(v => v.x === rightX), "z", frontZ, backZ)

  // ── 4. Remap all voxel colours ─────────────────────────────────────────────

  const newVoxels: BlueprintVoxel[] = voxels.map(v => {
    const key       = `${v.x},${v.y},${v.z}`
    const makeGlass = newGlass.has(key)

    // Window positions (may differ from source's glass)
    if (makeGlass) {
      return { x: v.x, y: v.y, z: v.z, type: "glass", color: style.windowColor }
    }

    switch (v.type) {
      // Brick stays brick; ex-glass positions become brick (window moved away)
      case "brick":
      case "glass":
        return { x: v.x, y: v.y, z: v.z, type: "brick", color: style.wallColor }
      case "roof":
        return { ...v, color: style.roofColor }
      case "wood":
        return { ...v, color: style.trimColor }
      // Structural blocks keep their original colours
      case "stone":
      case "chimney":
      case "path":
      default:
        return v
    }
  })

  // Sanity: count must never change
  if (newVoxels.length !== voxels.length) {
    console.error(`[houseGenerator] Block count changed: ${voxels.length} → ${newVoxels.length}`)
  }

  return {
    name:       `${source.name ?? "House"} (styled)`,
    voxelCount: newVoxels.length,
    voxels:     newVoxels,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: generate N styles for a neighbourhood
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces `count` HouseStyles that all share the same preset palette
 * but differ in exact shade, window layout, and offset — so a neighbourhood
 * looks coherent but each house is unique.
 */
export function generateNeighbourhoodStyles(
  preset:     StylePreset,
  windowSize: HouseStyle["windowSize"],
  windowCount: HouseStyle["windowCount"],
  masterSeed: number,
  count = 5,
): HouseStyle[] {
  const rng = new RNG(masterSeed)

  return Array.from({ length: count }, (_, i) => ({
    wallColor:    rng.pick(WALL_PALETTES[preset]),
    roofColor:    rng.pick(ROOF_PALETTES[preset]),
    trimColor:    rng.pick(TRIM_PALETTES[preset]),
    windowColor:  rng.pick(WINDOW_PALETTES[preset]),
    windowSize,
    windowCount,
    // Each house gets a different horizontal shift so windows don't all align
    windowOffset: i % (windowSize === "large" ? 5 : windowSize === "medium" ? 4 : 3),
    seed:         masterSeed * 100 + i,
  }))
}
