/**
 * Hand-authored voxel building shapes — one bespoke design per building type,
 * ported from a Figma Make prototype ("Updated voxel designs", 2026-08-11)
 * where each shape was iterated on visually. Unlike proceduralBuildingGenerator.ts
 * (auto-solves floor count from proportions to hit an arbitrary totalBlocks),
 * these are fixed geometry — each function's block count is a direct
 * consequence of its own dimensions and already lands exactly on this
 * project's real totalBlocks per variant (verified by running each generator:
 * short_apartment 4,000, tall_apartment 8,000, food_bank 4,000, restaurant
 * 5,000, school 5,000, hospital_small 4,000, hospital_medium 6,000,
 * hospital_large 8,000) — no padding/truncation needed.
 *
 * Every variant except church/fountain (pure landmarks, no block-count target)
 * is hollow per floor — visible interior floor slabs + window bands, not a
 * solid box — so kiosk users feel like they're actually building the
 * structure (2026-08-12 user request, first applied to short/tall apartment,
 * then extended same-day to school/food_bank/hospital_small). Where a
 * footprint's area doesn't divide evenly into uniform hollow floors + a thin
 * cap (school, food_bank), the shortfall is absorbed by a small exact-sized
 * architectural extra (entrance canopy, awning) rather than fudging the floor
 * math — see each generator's own comment for its specific arithmetic.
 */

import type { BlueprintVoxel } from "./types"
import { GLASS_HEX } from "./utils"

// Minecraft-inspired palette shared by restaurant + hospital generators
const P = {
  stone: 0x898989, brick: 0xc05030, brickDark: 0x8a3420,
  glass: 0x9fe4f5, glassDark: 0x5aa8cc,
  wood: 0xa07840, woodDark: 0x604828,
  white: 0xeef0f5, offWhite: 0xdcdfe8, gray: 0xb0b4bc,
  red: 0xdd2222, redLight: 0xff4444, yellow: 0xeecf22,
  concrete: 0x9aa0a8, concDark: 0x6e7880,
  darkGray: 0x484e58, sandDark: 0xa89050,
} as const

// Glass colors from the imported palette map to the "window" voxel type
const PALETTE_GLASS = new Set<number>([P.glass, P.glassDark])

type Setter = (x: number, y: number, z: number, c: number) => void

const toHex = (n: number) => `0x${n.toString(16)}`

function makeBlocks(fn: (s: Setter) => void): BlueprintVoxel[] {
  const map = new Map<string, number>()
  fn((x, y, z, c) => map.set(`${x},${y},${z}`, c))
  return Array.from(map.entries()).map(([k, c]) => {
    const [x, y, z] = k.split(",").map(Number)
    return PALETTE_GLASS.has(c)
      ? { x, y, z, type: "window", color: toHex(GLASS_HEX) }
      : { x, y, z, type: "wall", color: toHex(c) }
  })
}

function ifill(s: Setter, x0: number, y0: number, z0: number, w: number, h: number, d: number, c: number) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      for (let z = z0; z < z0 + d; z++)
        s(x, y, z, c)
}

function ishell(
  s: Setter, x0: number, y0: number, z0: number, w: number, h: number, d: number,
  c: number | ((x: number, z: number) => number), t = 2,
) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      for (let z = z0; z < z0 + d; z++)
        if (x < x0 + t || x >= x0 + w - t || z < z0 + t || z >= z0 + d - t)
          s(x, y, z, typeof c === "function" ? c(x, z) : c)
}

function islab(s: Setter, x0: number, y: number, z0: number, w: number, d: number, c: number) {
  ifill(s, x0, y, z0, w, 1, d, c)
}

function iwinRow(s: Setter, x0: number, y: number, z0: number, w: number, d: number, c: number, step = 4, size = 2) {
  for (let x = x0 + 3; x < x0 + w - 3; x++)
    if ((x - x0 - 1) % step < size) {
      s(x, y, z0, c); s(x, y + 1, z0, c)
      s(x, y, z0 + d - 1, c); s(x, y + 1, z0 + d - 1, c)
    }
  for (let z = z0 + 3; z < z0 + d - 3; z++)
    if ((z - z0 - 1) % step < size) {
      s(x0, y, z, c); s(x0, y + 1, z, c)
      s(x0 + w - 1, y, z, c); s(x0 + w - 1, y + 1, z, c)
    }
}

// ── Short Apartment  20×10×32 (5 hollow floors) = 4,000 ─────────────────────
// Palette varies per building instance (2026-08-12, user request: "less
// variety than houses, but still noticeably different") — a small fixed set
// of wall/roof/trim combos rather than houses' full per-instance style pool
// (HOUSE_STYLE_POOL in blueprintForVariant.ts), picked by variantIndex % length.
//
// Hollow per floor (2026-08-12, same-day follow-up — user request: "[the
// buildable buildings] shouldn't be a whole solid block... give it a hollow
// effect for every floor, similar to how restaurant looks now") — same
// ishell/islab/iwinRow technique generateRestaurant already uses, instead of
// the old solid()-filled box. Footprint (20×10) unchanged so the static city
// layout (which already placed this building by footprint) doesn't need
// regenerating; height increased 20→32 instead, to land back on exactly
// 4,000 voxels: perFloor = FH·(W·D) − (FH−1)·(W−2T)(D−2T) = 6·200 − 5·96 =
// 720; total = foundation(200) + 5·720 + roof(200) = 4,000. Verified by
// actually running the generator (not just the arithmetic) — see the commit
// this shipped in.

const SHORT_APARTMENT_PALETTES: { wall: number; roof: number; trim: number }[] = [
  { wall: 0xc05030, roof: 0x4a4a6a, trim: 0x8a3a28 }, // original red brick
  { wall: 0x8a9e7a, roof: 0x445566, trim: 0x6a7a5a }, // sage green
  { wall: 0xc09060, roof: 0x7a5535, trim: 0x9a7a4a }, // adobe tan
  { wall: 0x9a9a9a, roof: 0x334455, trim: 0x777777 }, // modern grey
  { wall: 0xaa8866, roof: 0x3a6033, trim: 0x6b4828 }, // cottage brown
]

export function generateShortApartment(variantIndex = 0): BlueprintVoxel[] {
  const W = 20, D = 10, FH = 6, FLOORS = 5, T = 2
  const { wall: WALL, roof: ROOF, trim: TRIM } = SHORT_APARTMENT_PALETTES[variantIndex % SHORT_APARTMENT_PALETTES.length]
  const FOUND = 0x7a8090, FLOOR_COLOR = 0x9a8878
  return makeBlocks(s => {
    islab(s, 0, 0, 0, W, D, FOUND)
    for (let f = 0; f < FLOORS; f++) {
      const y0 = 1 + f * FH
      ishell(s, 0, y0, 0, W, FH, D, WALL, T)
      islab(s, T, y0, T, W - 2 * T, D - 2 * T, FLOOR_COLOR)
      ishell(s, 0, y0, 0, W, 1, D, TRIM, T)
      ishell(s, 0, y0 + FH - 1, 0, W, 1, D, TRIM, T)
      // Window band covers rows 1..FH-2 (never row 0 or FH-1, the trim rows)
      // — iwinRow paints TWO rows per call (y and y+1), so consecutive calls
      // at offsets 1,2,3 overlap by one row and union to exactly {1,2,3,4}.
      iwinRow(s, 0, y0 + 1, 0, W, D, P.glass, 4, 1)
      iwinRow(s, 0, y0 + 2, 0, W, D, P.glass, 4, 1)
      iwinRow(s, 0, y0 + 3, 0, W, D, P.glass, 4, 1)
    }
    islab(s, 0, 1 + FLOORS * FH, 0, W, D, ROOF)
  })
}

// ── Tall Apartment  16×10×77 (15 hollow floors) = 8,000 ─────────────────────
// Palette varies per building instance (2026-08-12 follow-up to short_apartment
// variety) — same fixed-pool-by-variantIndex pattern as SHORT_APARTMENT_PALETTES.
// Index 0 is the original blue-grey look, kept first/unchanged so it stays
// available exactly as the user asked ("the blue would be okay for all").
//
// Hollow per floor (2026-08-12, same-day follow-up, same reasoning as
// generateShortApartment above). FH stays 5, identical to the original solid
// version's floor height — only FLOORS (10→15) and total height (50→77)
// change to hit exactly 8,000: perFloor = 5·160 − 4·72 = 512; total =
// foundation(160) + 15·512 + roof(160) = 8,000.

const TALL_APARTMENT_PALETTES: { wall: number; roof: number; trim: number }[] = [
  { wall: 0x8898aa, roof: 0x334455, trim: 0x6688aa }, // original blue-grey
  { wall: 0x3a6b6e, roof: 0x1e3638, trim: 0x2a4f52 }, // deep slate teal
  { wall: 0x555a63, roof: 0x22262c, trim: 0x3d434c }, // dark modern charcoal
  { wall: 0x4f6b52, roof: 0x2c3b2e, trim: 0x3a5240 }, // deep institutional green
  { wall: 0xa89078, roof: 0x5a4f3f, trim: 0x8a7a62 }, // sandstone tan
]

export function generateTallApartment(variantIndex = 0): BlueprintVoxel[] {
  const W = 16, D = 10, FH = 5, FLOORS = 15, T = 2
  const { wall: WALL, roof: ROOF, trim: TRIM } = TALL_APARTMENT_PALETTES[variantIndex % TALL_APARTMENT_PALETTES.length]
  const FOUND = 0x666677, FLOOR_COLOR = 0x777888
  return makeBlocks(s => {
    islab(s, 0, 0, 0, W, D, FOUND)
    for (let f = 0; f < FLOORS; f++) {
      const y0 = 1 + f * FH
      ishell(s, 0, y0, 0, W, FH, D, WALL, T)
      islab(s, T, y0, T, W - 2 * T, D - 2 * T, FLOOR_COLOR)
      ishell(s, 0, y0, 0, W, 1, D, TRIM, T)
      ishell(s, 0, y0 + FH - 1, 0, W, 1, D, TRIM, T)
      // Rows 1,2 (union of two 2-row iwinRow calls, offset by 1) cover
      // exactly {1,2,3} — the 3 middle rows of FH=5, matching the original
      // solid version's isWin(winFys=[1,2,3]) window band exactly.
      iwinRow(s, 0, y0 + 1, 0, W, D, P.glass, 2, 1)
      iwinRow(s, 0, y0 + 2, 0, W, D, P.glass, 2, 1)
    }
    islab(s, 0, 1 + FLOORS * FH, 0, W, D, ROOF)
  })
}

// ── Food Bank  40×10×11 (2 hollow floors + thick found/roof + awning) = 4,000 ──
// Palette varies per building instance (2026-08-12, user request: "3
// colors") — same fixed-pool-by-variantIndex pattern as apartments.
// wallAlt originally covered the non-storefront side fallback fill of the old
// solid() box; repurposed (2026-08-12 hollow follow-up) as the interior floor
// slab tint now that there's no more solid interior to fill.
//
// Hollow per floor (2026-08-12, same request as the apartments/school/
// hospital_small conversions). Footprint (40×10) unchanged. 40×10's footprint
// area (400) has no exact solution with uniform floors + a thin 1-layer cap —
// verified by exhaustive search — so the foundation/roof caps are thickened
// (4 + 3 layers, still T=2) to shrink the remainder to a small, clean 32
// voxels: perFloor = FH·(W·D) − (FH−1)·(W−2T)(D−2T) = 2·400 − 1·216 = 584;
// core = found(4·400=1600) + 2·584 + roof(3·400=1200) = 3968. The remaining
// 32 voxels become a single flat awning slab (8×1×4) over the dock doors,
// protruding into z<0 space that the shell never touches — same technique
// generateRestaurant's awning uses — landing exactly on 4,000. Verified by
// running the generator, not just this arithmetic.
//
// Each hollow floor is only 2 rows tall, too thin to carve out a separate
// trim band, so floor 0 keeps its two loading-dock doors and floor 1 keeps a
// window band as pure post-hoc recolors of the already-`ishell`'d ring cells
// (zero added voxels) rather than baking them into the ring fill itself.

const FOOD_BANK_PALETTES: { wall: number; roof: number; found: number; wallAlt: number }[] = [
  { wall: 0xc8a870, roof: 0x8b6c42, found: 0x8a7a5a, wallAlt: 0xb89860 }, // original tan
  { wall: 0x9aa0a8, roof: 0x5a6068, found: 0x6e7880, wallAlt: 0x848a92 }, // industrial grey-blue
  { wall: 0x8a9e6a, roof: 0x5a6e42, found: 0x6a7a52, wallAlt: 0x7a8e5a }, // fresh-produce green
]

export function generateFoodBank(variantIndex = 0): BlueprintVoxel[] {
  const W = 40, D = 10, T = 2, FH = 2, FLOORS = 2, FOUND_H = 4, ROOF_H = 3
  const { wall: WALL, roof: ROOF, found: FOUND, wallAlt: FLOOR_COLOR } = FOOD_BANK_PALETTES[variantIndex % FOOD_BANK_PALETTES.length]
  const DOOR = 0x3a3020
  return makeBlocks(s => {
    ifill(s, 0, 0, 0, W, FOUND_H, D, FOUND)
    for (let f = 0; f < FLOORS; f++) {
      const y0 = FOUND_H + f * FH
      ishell(s, 0, y0, 0, W, FH, D, WALL, T)
      islab(s, T, y0, T, W - 2 * T, D - 2 * T, FLOOR_COLOR)
      if (f === 0) {
        // Loading dock doors on front (z=0), two doors — recolor over the wall ring
        for (let y = y0; y < y0 + FH; y++) {
          for (let x = 5; x <= 10; x++) s(x, y, 0, DOOR)
          for (let x = 15; x <= 20; x++) s(x, y, 0, DOOR)
        }
      } else {
        iwinRow(s, 0, y0, 0, W, D, P.glass, 4, 1)
      }
    }
    const roofY = FOUND_H + FLOORS * FH
    ifill(s, 0, roofY, 0, W, ROOF_H, D, ROOF)
    // Awning over the dock doors, protruding at z<0 — absorbs the exact
    // remainder (8×1×4=32) to land on 4,000; never overlaps the shell above.
    ifill(s, 6, FOUND_H + FH, -4, 8, 1, 4, ROOF)
  })
}

// ── Restaurant  22×11×(6 floors × fh4) = 5,000 ──────────────────────────────
// Visual: warm brick, large storefront glazing, red awning, chimney, rooftop sign
// Brick/chimney color varies per building instance (2026-08-12, user request:
// "a variety of colors, minimum 7" — the red awning is explicitly kept as-is,
// "that can stay red", so P.red/P.redLight/P.yellow and everything else
// (foundation, window trim, glass, sign wood) stay fixed across all
// palettes — only the brick wall + its matching chimney color vary.

const RESTAURANT_PALETTES: { brick: number; brickDark: number }[] = [
  { brick: 0xc05030, brickDark: 0x8a3420 }, // original brick red-orange
  { brick: 0xc9a03c, brickDark: 0x8a6c28 }, // mustard gold
  { brick: 0x3f6b4a, brickDark: 0x2a4a33 }, // forest green
  { brick: 0x4a6a8a, brickDark: 0x33475e }, // slate blue
  { brick: 0x4a4a50, brickDark: 0x2f2f33 }, // charcoal modern
  { brick: 0xd8cfb0, brickDark: 0xa89870 }, // cream ivory
  { brick: 0x6a4468, brickDark: 0x472e46 }, // plum
  { brick: 0x2f7a72, brickDark: 0x1f524c }, // teal
]

export function generateRestaurant(variantIndex = 0): BlueprintVoxel[] {
  const { brick: BRICK, brickDark: BRICK_DARK } = RESTAURANT_PALETTES[variantIndex % RESTAURANT_PALETTES.length]
  return makeBlocks(s => {
    const [W, D, floors, fh] = [22, 11, 6, 4]
    ifill(s, 0, 0, 0, W, 2, D, P.sandDark)
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      ishell(s, 0, y0, 0, W, fh, D, BRICK, 2)
      islab(s, 2, y0, 2, W - 4, D - 4, P.woodDark)
      if (f === 0) {
        ifill(s, 2, y0, 0, W - 4, fh - 1, 2, P.glassDark)
        for (let x = 2; x < W - 2; x += 4) ifill(s, x, y0, 0, 1, fh - 1, 2, P.woodDark)
      } else {
        iwinRow(s, 0, y0 + 1, 0, W, D, P.glass, 4, 1)
      }
    }
    // Red awning — kept red regardless of palette, per user request
    ifill(s, -1, 2 + fh - 1, -2, W + 2, 1, 3, P.red)
    ifill(s, -1, 2 + fh, -2, W + 2, 1, 3, P.redLight)
    // Chimney + cap
    ifill(s, W - 3, 2 + floors * fh, D - 3, 2, 5, 2, BRICK_DARK)
    ifill(s, W - 4, 2 + floors * fh + 5, D - 4, 4, 1, 1, BRICK_DARK)
    // Rooftop sign
    ifill(s, 3, 2 + floors * fh, 0, W - 6, 3, 2, P.wood)
    ifill(s, 4, 2 + floors * fh + 1, 0, W - 8, 2, 1, P.yellow)
    // Floor trim
    for (let f = 0; f < floors; f++) ifill(s, 0, 2 + f * fh + fh - 1, 0, W, 1, D, P.woodDark)
  })
}

// ── School  50×10×12 (2 hollow floors + thick found/roof + canopy) = 5,000 ──
// Multi-color per building (2026-08-12, user request: "schools tend to be
// [multi-color] in real life... i would like 3 variants") — unlike every
// other hand-authored generator here (one wall color per building), each
// school splits its 50-wide front/back into 4 vertical color sections (like
// real schools' colorful panel architecture), picked from one of 3
// SCHOOL_PALETTES via variantIndex. Roof/foundation/trim come from the same
// palette entry (not a globally-fixed neutral) so each scheme reads as one
// coordinated design — index 0 preserves the original tan/blue/gold look,
// now expressed as an alternating panel rhythm instead of one flat wall.
//
// Hollow per floor (2026-08-12, same-day hollow-conversion follow-up).
// Footprint (50×10) unchanged. 50×10's footprint area (500) has no exact
// solution with uniform floors + a thin 1-layer cap — verified by exhaustive
// search — so the foundation/roof caps are thickened (3 + 3 layers, still
// T=2) to shrink the remainder to a small, clean 104 voxels: perFloor =
// FH·(W·D) − (FH−1)·(W−2T)(D−2T) = 3·500 − 2·276 = 948; core = found(3·500=
// 1500) + 2·948 + roof(3·500=1500) = 4896. The remaining 104 voxels become an
// entrance canopy (a 10×1×4 roof slab + two 2×8×2 support columns, 40+64=104
// exact) protruding into z<0 space the shell never touches — landing exactly
// on 5,000. Verified by running the generator, not just this arithmetic.
//
// ishell's color param accepts a per-cell function so the ring can still be
// wall-color-per-x-section (wallColorAt) even though it's now hollow.

const SCHOOL_PALETTES: { colors: readonly number[]; roof: number; found: number; trim: number }[] = [
  { colors: [0xddc870, 0x6688aa, 0xddc870, 0xaa9444], roof: 0x6688aa, found: 0x9a8040, trim: 0xaa9444 }, // original tan/blue, now paneled
  { colors: [0xd64545, 0x4a7bc9, 0xe0c040, 0x5a9e4f], roof: 0x556070, found: 0x8a8a86, trim: 0xe8e8e2 }, // primary colors
  { colors: [0xc06a45, 0xd4a83c, 0x3a8a82, 0x4a4a50], roof: 0x3a3f47, found: 0x7a746c, trim: 0xd8d4c8 }, // warm modern
]

export function generateSchool(variantIndex = 0): BlueprintVoxel[] {
  const W = 50, D = 10, T = 2, FH = 3, FLOORS = 2, FOUND_H = 3, ROOF_H = 3
  const { colors, roof: ROOF, found: FOUND, trim: TRIM } = SCHOOL_PALETTES[variantIndex % SCHOOL_PALETTES.length]
  const sectionWidth = W / colors.length
  const wallColorAt = (x: number) => colors[Math.min(colors.length - 1, Math.floor(x / sectionWidth))]
  const cx = Math.floor(W / 2)
  return makeBlocks(s => {
    ifill(s, 0, 0, 0, W, FOUND_H, D, FOUND)
    for (let f = 0; f < FLOORS; f++) {
      const y0 = FOUND_H + f * FH
      ishell(s, 0, y0, 0, W, FH, D, (x, _z) => wallColorAt(x), T)
      islab(s, T, y0, T, W - 2 * T, D - 2 * T, FOUND)
      // Window band (middle row) — deliberately spills into what becomes the
      // top trim row (iwinRow always paints 2 rows); the trim call right
      // after overwrites that spillover back, same last-write-wins trick
      // used for the entrance-arch/red-cross overlays below.
      iwinRow(s, 0, y0 + 1, 0, W, D, P.glass, 4, 1)
      ishell(s, 0, y0, 0, W, 1, D, TRIM, T)
      ishell(s, 0, y0 + FH - 1, 0, W, 1, D, TRIM, T)
    }
    const roofY = FOUND_H + FLOORS * FH
    ifill(s, 0, roofY, 0, W, ROOF_H, D, ROOF)

    // Central entrance arch on front (z=0), spanning both floors — pure
    // recolor of already-populated ring cells, zero added voxels.
    for (let y = FOUND_H; y < roofY; y++)
      for (let x = cx - 2; x <= cx + 2; x++) s(x, y, 0, P.glass)

    // Entrance canopy, protruding at z<0 — absorbs the exact remainder
    // (40 + 32 + 32 = 104) to land on 5,000; columns (y 1..8) sit strictly
    // below the canopy slab (y 9) so their footprints never share a
    // coordinate (would otherwise collapse in makeBlocks' dedup map).
    ifill(s, cx - 5, 1, -3, 2, 8, 2, TRIM)
    ifill(s, cx + 3, 1, -3, 2, 8, 2, TRIM)
    ifill(s, cx - 5, roofY, -4, 10, 1, 4, TRIM)
  })
}

// ── Small Hospital  20×10×32 (5 hollow floors) = 4,000 ──────────────────────
// Hollow per floor (2026-08-12, same request as the apartments/school/
// food_bank conversions). hospital_small is geometrically identical to
// short_apartment (same 20×10 footprint, same 4,000 target), so it reuses
// that exact solved structure verbatim (T=2, FH=6, FLOORS=5, 1-layer
// foundation+roof → 4,000, new H=32) with only the colors swapped in — see
// generateShortApartment's comment for the arithmetic. The red cross (front
// facade + roof) is a pure color overwrite applied after the shell is built,
// adding zero voxels: z=0 is always inside the T=2 ring for every floor, and
// the roof is a full-footprint slab, so every cell the cross touches is
// already populated. No palette/variantIndex added — this building never had
// per-instance color variety, and this change is scoped to hollowing the
// structure, not adding variety that wasn't asked for.

export function generateSmallHospital(): BlueprintVoxel[] {
  const W = 20, D = 10, FH = 6, FLOORS = 5, T = 2
  const WALL = 0xe8e8f0, ROOF = 0xaaaacc, FOUND = 0x888899, TRIM = 0x9999aa, FLOOR_COLOR = 0xd0d0da
  const RED = 0xdd3344
  const midX = Math.floor(W / 2)
  const midZ = Math.floor(D / 2)
  return makeBlocks(s => {
    islab(s, 0, 0, 0, W, D, FOUND)
    for (let f = 0; f < FLOORS; f++) {
      const y0 = 1 + f * FH
      ishell(s, 0, y0, 0, W, FH, D, WALL, T)
      islab(s, T, y0, T, W - 2 * T, D - 2 * T, FLOOR_COLOR)
      ishell(s, 0, y0, 0, W, 1, D, TRIM, T)
      ishell(s, 0, y0 + FH - 1, 0, W, 1, D, TRIM, T)
      iwinRow(s, 0, y0 + 1, 0, W, D, P.glass, 4, 1)
      iwinRow(s, 0, y0 + 2, 0, W, D, P.glass, 4, 1)
      iwinRow(s, 0, y0 + 3, 0, W, D, P.glass, 4, 1)
    }
    const roofY = 1 + FLOORS * FH
    islab(s, 0, roofY, 0, W, D, ROOF)

    // Red cross overlay — recolors already-populated cells only (front
    // facade z=0, roof), zero added voxels.
    for (let y = 8; y <= 24; y++)
      for (let x = midX - 1; x <= midX + 1; x++) s(x, y, 0, RED)
    for (let y = 14; y <= 17; y++)
      for (let x = midX - 3; x <= midX + 3; x++) s(x, y, 0, RED)
    for (let x = 0; x < W; x++)
      for (let z = 0; z < D; z++) {
        const isCross = (Math.abs(x - midX) <= 1 && Math.abs(z - midZ) <= 3) || (Math.abs(z - midZ) <= 1 && Math.abs(x - midX) <= 3)
        if (isCross) s(x, roofY, z, RED)
      }
  })
}

// ── Medium Hospital  18×18×(6 floors × fh3) + tower = 6,000 ────────────────
// Visual: white shell + central protruding tower, roof cross, ambulance bay

export function generateMediumHospital(): BlueprintVoxel[] {
  return makeBlocks(s => {
    const [W, D, floors, fh] = [18, 18, 6, 3]
    ifill(s, 0, 0, 0, W, 2, D, P.concrete)
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      ishell(s, 0, y0, 0, W, fh, D, P.white, 2)
      islab(s, 2, y0, 2, W - 4, D - 4, P.offWhite)
      iwinRow(s, 0, y0 + 1, 0, W, D, P.glass, 3, 1)
      ifill(s, 0, y0 + fh - 1, 0, W, 1, D, P.concDark)
    }
    // Central tower
    const cx = Math.floor(W / 2) - 3
    for (let f = floors; f < floors + 3; f++) {
      const y0 = 2 + f * fh
      ishell(s, cx, y0, 4, 6, fh, D - 8, P.white, 1)
      islab(s, cx + 1, y0, 5, 4, D - 10, P.offWhite)
      iwinRow(s, cx, y0 + 1, 4, 6, D - 8, P.glass, 2, 1)
    }
    // Roof cross + antenna
    const ry = 2 + floors * fh
    islab(s, 0, ry, 0, W, D, P.gray)
    ifill(s, W / 2 - 1, ry + 1, 3, 2, 1, D - 6, P.red)
    ifill(s, 4, ry + 1, D / 2 - 1, W - 8, 1, 2, P.red)
    // Ambulance bay canopy
    ifill(s, 2, 2, -3, 8, 1, 4, P.white)
    ifill(s, 2, 3, -3, 8, 1, 4, P.red)
    // Antenna tip above tower (ry+9 = y 29, guaranteed free)
    ifill(s, Math.floor(W / 2), ry + 9, Math.floor(D / 2), 1, 4, 1, P.darkGray)
  })
}

// ── Large Hospital  16×16×(9 floors × fh3) + two towers = 8,000 ────────────
// Visual: white main body, left + right staggered towers, helipad, antenna

export function generateLargeHospital(): BlueprintVoxel[] {
  return makeBlocks(s => {
    const [W, D, floors, fh] = [16, 16, 9, 3]
    ifill(s, 0, 0, 0, W, 2, D, P.concrete)
    // Main body
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      ishell(s, 0, y0, 0, W, fh, D, P.white, 2)
      islab(s, 2, y0, 2, W - 4, D - 4, P.offWhite)
      iwinRow(s, 0, y0 + 1, 0, W, D, P.glass, 3, 1)
      ifill(s, 0, y0 + fh - 1, 0, W, 1, D, P.concDark)
    }
    // Left tower (shorter)
    for (let f = floors; f < floors + 4; f++) {
      const y0 = 2 + f * fh
      ishell(s, 1, y0, 1, 8, fh, D - 2, P.white, 1)
      islab(s, 2, y0, 2, 6, D - 4, P.offWhite)
      iwinRow(s, 1, y0 + 1, 1, 8, D - 2, P.glass, 2, 1)
    }
    // Right tower (taller)
    for (let f = floors; f < floors + 6; f++) {
      const y0 = 2 + f * fh
      ishell(s, W - 9, y0, 1, 8, fh, D - 2, P.white, 1)
      islab(s, W - 8, y0, 2, 6, D - 4, P.offWhite)
      iwinRow(s, W - 9, y0 + 1, 1, 8, D - 2, P.glass, 2, 1)
    }
    // Roof
    const ry = 2 + floors * fh
    islab(s, 0, ry, 0, W, D, P.gray)
    ifill(s, W / 2 - 1, ry + 1, 3, 2, 1, D - 6, P.red)
    ifill(s, 4, ry + 1, D / 2 - 1, W - 8, 1, 2, P.red)
    // Helipad on left tower roof
    ifill(s, W - 9, ry, 1, 8, 1, D - 2, P.yellow)
    ifill(s, W - 8, ry + 1, D / 2 - 1, 6, 1, 2, P.white)
    ifill(s, W - 6, ry + 1, 2, 2, 1, D - 4, P.white)
    // Antenna
    ifill(s, W / 2, ry + 2, D / 2, 1, 10, 1, P.darkGray)
    ifill(s, W / 2 - 1, ry + 12, D / 2, 3, 1, 1, P.red)
  })
}

// ── Church  20×36 nave + 8×8 steeple, stepped gable roof + spire + cross ────
// Not one of the 158 real QR-linked buildings — a single purely aesthetic
// landmark the user asked to hand-place (2026-08-11), so unlike every other
// generator here it has no totalBlocks to hit exactly; block count is
// whatever this shape naturally comes out to.

export function generateChurch(): BlueprintVoxel[] {
  return makeBlocks((s) => {
    const NAVE_W = 20, NAVE_D = 36, NAVE_H = 14
    const TOWER_W = 8, TOWER_D = 8, TOWER_H = 26
    const CHURCH = {
      stone: 0xcfcabe, stoneDark: 0xa39c88, roof: 0x4a4038,
      gold: 0xd4af37, door: 0x5a3a20,
    } as const

    // Foundation + nave shell
    islab(s, 0, 0, 0, NAVE_W, NAVE_D, CHURCH.stoneDark)
    ishell(s, 0, 1, 0, NAVE_W, NAVE_H, NAVE_D, CHURCH.stone, 2)

    // Tall arched-look windows down both long sides
    for (let z = 6; z < NAVE_D - 6; z += 6) {
      for (let y = 4; y <= 9; y++) {
        s(0, y, z, P.glass)
        s(NAVE_W - 1, y, z, P.glass)
      }
    }

    // Stepped gable roof over the nave (triangular cross-section)
    const roofBaseY = 1 + NAVE_H
    const roofHeight = 8
    for (let ry = 0; ry < roofHeight; ry++) {
      const inset = ry
      if (inset * 2 >= NAVE_W) break
      for (let x = inset; x < NAVE_W - inset; x++)
        for (let z = 0; z < NAVE_D; z++)
          s(x, roofBaseY + ry, z, CHURCH.roof)
    }

    // Bell tower, protruding in front of the nave's z=0 face
    const towerX0 = Math.floor((NAVE_W - TOWER_W) / 2)
    const towerZ0 = -TOWER_D + 4
    islab(s, towerX0, 0, towerZ0, TOWER_W, TOWER_D, CHURCH.stoneDark)
    ishell(s, towerX0, 1, towerZ0, TOWER_W, TOWER_H, TOWER_D, CHURCH.stone, 1)

    // Entrance door in the tower's front face
    for (let y = 1; y <= 4; y++)
      for (let x = towerX0 + 2; x < towerX0 + TOWER_W - 2; x++)
        s(x, y, towerZ0, CHURCH.door)

    // Pyramidal spire cap
    const spireBaseY = 1 + TOWER_H
    const spireHeight = 6
    for (let sy = 0; sy < spireHeight; sy++) {
      const inset = sy
      if (inset * 2 >= TOWER_W) break
      for (let x = towerX0 + inset; x < towerX0 + TOWER_W - inset; x++)
        for (let z = towerZ0 + inset; z < towerZ0 + TOWER_D - inset; z++)
          s(x, spireBaseY + sy, z, CHURCH.roof)
    }

    // Cross on top of the spire
    const crossX = towerX0 + Math.floor(TOWER_W / 2)
    const crossZ = towerZ0 + Math.floor(TOWER_D / 2)
    const crossBaseY = spireBaseY + spireHeight
    for (let cy = 0; cy < 3; cy++) s(crossX, crossBaseY + cy, crossZ, CHURCH.gold)
    s(crossX - 1, crossBaseY + 1, crossZ, CHURCH.gold)
    s(crossX + 1, crossBaseY + 1, crossZ, CHURCH.gold)
  })
}

// ── Fountain: circular basin + raised two-tier pedestal ─────────────────────
// Not one of the 158 real QR-linked buildings — a second purely aesthetic
// landmark the user asked to hand-place near the church (2026-08-12), same
// deal as generateChurch: no totalBlocks to hit, block count is whatever this
// shape naturally comes out to.

export function generateFountain(): BlueprintVoxel[] {
  return makeBlocks((s) => {
    const R = 5
    const FOUNTAIN = {
      stone: 0xb8b3a6, stoneDark: 0x8f8a7c, water: 0x4a90d9, gold: 0xd4af37,
    } as const

    // Base slab + raised rim ring (basin walls), lower basin
    for (let x = -R; x <= R; x++) {
      for (let z = -R; z <= R; z++) {
        const d2 = x * x + z * z
        if (d2 > R * R) continue
        s(x, 0, z, FOUNTAIN.stoneDark)
        if (d2 > (R - 1) * (R - 1)) s(x, 1, z, FOUNTAIN.stone) // rim
      }
    }
    // Water surface inside the rim
    for (let x = -(R - 1); x <= R - 1; x++)
      for (let z = -(R - 1); z <= R - 1; z++)
        if (x * x + z * z <= (R - 1) * (R - 1)) s(x, 1, z, FOUNTAIN.water)

    // Central pedestal column rising from the basin
    for (let y = 1; y <= 4; y++) {
      s(0, y, 0, FOUNTAIN.stone); s(1, y, 0, FOUNTAIN.stone)
      s(0, y, 1, FOUNTAIN.stone); s(1, y, 1, FOUNTAIN.stone)
    }

    // Upper (second-tier) basin ring + its own water pool
    const R2 = 3
    for (let x = -R2; x <= R2 + 1; x++) {
      for (let z = -R2; z <= R2 + 1; z++) {
        const cx = x - 0.5, cz = z - 0.5
        const d2 = cx * cx + cz * cz
        if (d2 > R2 * R2) continue
        if (d2 > (R2 - 1) * (R2 - 1)) s(x, 4, z, FOUNTAIN.stone) // rim
        else s(x, 4, z, FOUNTAIN.water)
      }
    }

    // Gold finial on top
    s(0, 5, 0, FOUNTAIN.gold); s(1, 5, 0, FOUNTAIN.gold)
    s(0, 5, 1, FOUNTAIN.gold); s(1, 5, 1, FOUNTAIN.gold)
    s(0, 6, 0, FOUNTAIN.gold); s(1, 6, 0, FOUNTAIN.gold)
    s(0, 6, 1, FOUNTAIN.gold); s(1, 6, 1, FOUNTAIN.gold)
  })
}

// Variant key → generator. Every non-house variant now has a hand-authored
// design; house keeps using generateHouseBlueprint (a recolor of the imported
// blueprint, not a fixed shape generator like these). "church" and
// "fountain" are not among the 158 real QR-linked buildings — see their own
// generators' comments. Every generator receives a per-building variantIndex
// (2026-08-12) — generateShortApartment, generateTallApartment,
// generateFoodBank, generateRestaurant, and generateSchool use it for
// palette variety (generateSchool alone uses it for multi-color panel
// sections within one building, not just a single wall color); the
// rest (including generateSmallHospital, which has no palette at all) ignore
// the argument, which TS allows for a function with fewer declared params
// than the Record's value type expects.
export const HAND_AUTHORED_DESIGNS: Partial<Record<string, (variantIndex: number) => BlueprintVoxel[]>> = {
  short_apartment: generateShortApartment,
  tall_apartment: generateTallApartment,
  food_bank: generateFoodBank,
  restaurant: generateRestaurant,
  school: generateSchool,
  hospital_small: generateSmallHospital,
  hospital_medium: generateMediumHospital,
  hospital_large: generateLargeHospital,
  church: generateChurch,
  fountain: generateFountain,
}
