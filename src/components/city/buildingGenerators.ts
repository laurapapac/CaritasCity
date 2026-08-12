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

function ishell(s: Setter, x0: number, y0: number, z0: number, w: number, h: number, d: number, c: number, t = 2) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      for (let z = z0; z < z0 + d; z++)
        if (x < x0 + t || x >= x0 + w - t || z < z0 + t || z >= z0 + d - t)
          s(x, y, z, c)
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

// ── Solid-fill helpers ──────────────────────────────────────────────────────

// Fills a W×D×H solid volume, centered at origin
function solid(
  W: number,
  D: number,
  H: number,
  fn: (x: number, y: number, z: number) => { type: string; color: number },
): BlueprintVoxel[] {
  const out: BlueprintVoxel[] = []
  const ox = -Math.floor(W / 2)
  const oz = -Math.floor(D / 2)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let z = 0; z < D; z++) {
        const r = fn(x, y, z)
        out.push({ x: x + ox, y, z: z + oz, type: r.type, color: toHex(r.color) })
      }
  return out
}

// True if (x,y,z) is on any exterior face of the W×D×H volume
const ext = (x: number, z: number, W: number, D: number) =>
  x === 0 || x === W - 1 || z === 0 || z === D - 1

// True if a wall-face position `pos` along a face of length `len` should have a window
function winPos(pos: number, len: number, period = 3, border = 2): boolean {
  return pos >= border && pos < len - border && (pos - border) % period === 0
}

// True if exterior block at (x,y,z) should be a window
function isWin(
  x: number, y: number, z: number,
  W: number, D: number, FH: number,
  winFys: number[],
  period = 3,
): boolean {
  if (!winFys.includes(y % FH)) return false
  if ((z === 0 || z === D - 1) && x > 0 && x < W - 1) return winPos(x, W, period)
  if ((x === 0 || x === W - 1) && z > 0 && z < D - 1) return winPos(z, D, period)
  return false
}

// ── Short Apartment  20×10×20 = 4,000 ───────────────────────────────────────
// Palette varies per building instance (2026-08-12, user request: "less
// variety than houses, but still noticeably different") — a small fixed set
// of wall/roof/trim combos rather than houses' full per-instance style pool
// (HOUSE_STYLE_POOL in blueprintForVariant.ts), picked by variantIndex % length.

const SHORT_APARTMENT_PALETTES: { wall: number; roof: number; trim: number }[] = [
  { wall: 0xc05030, roof: 0x4a4a6a, trim: 0x8a3a28 }, // original red brick
  { wall: 0x8a9e7a, roof: 0x445566, trim: 0x6a7a5a }, // sage green
  { wall: 0xc09060, roof: 0x7a5535, trim: 0x9a7a4a }, // adobe tan
  { wall: 0x9a9a9a, roof: 0x334455, trim: 0x777777 }, // modern grey
  { wall: 0xaa8866, roof: 0x3a6033, trim: 0x6b4828 }, // cottage brown
]

export function generateShortApartment(variantIndex = 0): BlueprintVoxel[] {
  const W = 20, D = 10, H = 20, FH = 4
  const { wall: WALL, roof: ROOF, trim: TRIM } = SHORT_APARTMENT_PALETTES[variantIndex % SHORT_APARTMENT_PALETTES.length]
  const FOUND = 0x7a8090
  return solid(W, D, H, (x, y, z) => {
    if (y === H - 1) return { type: "roof", color: ROOF }
    if (y === 0) return { type: "stone", color: FOUND }
    const fy = y % FH
    if (ext(x, z, W, D)) {
      if (fy === 0 || fy === FH - 1) return { type: "wall", color: TRIM }
      if (isWin(x, y, z, W, D, FH, [1, 2])) return { type: "window", color: GLASS_HEX }
      return { type: "wall", color: WALL }
    }
    return { type: fy === 0 ? "floor" : "wall", color: fy === 0 ? 0x9a8878 : WALL }
  })
}

// ── Tall Apartment  16×10×50 = 8,000 ────────────────────────────────────────
// Palette varies per building instance (2026-08-12 follow-up to short_apartment
// variety) — same fixed-pool-by-variantIndex pattern as SHORT_APARTMENT_PALETTES.
// Index 0 is the original blue-grey look, kept first/unchanged so it stays
// available exactly as the user asked ("the blue would be okay for all").

const TALL_APARTMENT_PALETTES: { wall: number; roof: number; trim: number }[] = [
  { wall: 0x8898aa, roof: 0x334455, trim: 0x6688aa }, // original blue-grey
  { wall: 0x3a6b6e, roof: 0x1e3638, trim: 0x2a4f52 }, // deep slate teal
  { wall: 0x555a63, roof: 0x22262c, trim: 0x3d434c }, // dark modern charcoal
  { wall: 0x4f6b52, roof: 0x2c3b2e, trim: 0x3a5240 }, // deep institutional green
  { wall: 0xa89078, roof: 0x5a4f3f, trim: 0x8a7a62 }, // sandstone tan
]

export function generateTallApartment(variantIndex = 0): BlueprintVoxel[] {
  const W = 16, D = 10, H = 50, FH = 5
  const { wall: WALL, roof: ROOF, trim: TRIM } = TALL_APARTMENT_PALETTES[variantIndex % TALL_APARTMENT_PALETTES.length]
  const FOUND = 0x666677
  return solid(W, D, H, (x, y, z) => {
    if (y === H - 1) return { type: "roof", color: ROOF }
    if (y === 0) return { type: "stone", color: FOUND }
    const fy = y % FH
    if (ext(x, z, W, D)) {
      if (fy === 0 || fy === FH - 1) return { type: "wall", color: TRIM }
      if (isWin(x, y, z, W, D, FH, [1, 2, 3], 2)) return { type: "window", color: GLASS_HEX }
      return { type: "wall", color: WALL }
    }
    return { type: fy === 0 ? "floor" : "wall", color: fy === 0 ? 0x777888 : WALL }
  })
}

// ── Food Bank  40×10×10 = 4,000 ─────────────────────────────────────────────
// Palette varies per building instance (2026-08-12, user request: "3
// colors") — same fixed-pool-by-variantIndex pattern as apartments.
// wallAlt covers the non-storefront side fallback fill, kept proportioned to
// each palette's own WALL (a touch darker/desaturated) rather than a fixed
// value, so it never clashes with a differently-colored WALL.

const FOOD_BANK_PALETTES: { wall: number; roof: number; found: number; wallAlt: number }[] = [
  { wall: 0xc8a870, roof: 0x8b6c42, found: 0x8a7a5a, wallAlt: 0xb89860 }, // original tan
  { wall: 0x9aa0a8, roof: 0x5a6068, found: 0x6e7880, wallAlt: 0x848a92 }, // industrial grey-blue
  { wall: 0x8a9e6a, roof: 0x5a6e42, found: 0x6a7a52, wallAlt: 0x7a8e5a }, // fresh-produce green
]

export function generateFoodBank(variantIndex = 0): BlueprintVoxel[] {
  const W = 40, D = 10, H = 10
  const { wall: WALL, roof: ROOF, found: FOUND, wallAlt: WALL_ALT } = FOOD_BANK_PALETTES[variantIndex % FOOD_BANK_PALETTES.length]
  const DOOR = 0x3a3020
  return solid(W, D, H, (x, y, z) => {
    if (y === H - 1) return { type: "roof", color: ROOF }
    if (y === 0) return { type: "stone", color: FOUND }
    if (ext(x, z, W, D)) {
      // Loading dock doors on front (z=0), two doors
      const door1 = z === 0 && x >= 5 && x <= 10 && y >= 1 && y <= 6
      const door2 = z === 0 && x >= 15 && x <= 20 && y >= 1 && y <= 6
      if (door1 || door2) return { type: "wall", color: DOOR }
      // Clerestory windows near top, front and back
      if ((z === 0 || z === D - 1) && y >= 7 && y <= 8 && x > 0 && x < W - 1 && (x - 1) % 4 === 0)
        return { type: "window", color: GLASS_HEX }
      // Side wall windows
      if ((x === 0 || x === W - 1) && y >= 4 && y <= 6 && z > 0 && z < D - 1 && z % 3 === 1)
        return { type: "window", color: GLASS_HEX }
      return { type: "wall", color: WALL }
    }
    return { type: "wall", color: WALL_ALT }
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

// ── School  50×10×10 = 5,000 ────────────────────────────────────────────────

export function generateSchool(): BlueprintVoxel[] {
  const W = 50, D = 10, H = 10, FH = 5
  const WALL = 0xddc870, ROOF = 0x6688aa, FOUND = 0x9a8040, TRIM = 0xaa9444
  const cx = Math.floor(W / 2)
  return solid(W, D, H, (x, y, z) => {
    if (y === H - 1) return { type: "roof", color: ROOF }
    if (y === 0) return { type: "stone", color: FOUND }
    const fy = y % FH
    if (ext(x, z, W, D)) {
      // Central entrance arch on front (z=0)
      if (z === 0 && Math.abs(x - cx) <= 2 && y >= 1 && y <= 7)
        return { type: "window", color: GLASS_HEX }
      if (fy === 0 || fy === FH - 1) return { type: "wall", color: TRIM }
      // Wide classroom windows on front and back
      if ((z === 0 || z === D - 1) && x > 0 && x < W - 1 && (x - 2) % 4 === 0)
        return { type: "window", color: GLASS_HEX }
      // Side windows
      if ((x === 0 || x === W - 1) && z > 0 && z < D - 1 && z % 2 === 1)
        return { type: "window", color: GLASS_HEX }
      return { type: "wall", color: WALL }
    }
    return { type: fy === 0 ? "floor" : "wall", color: fy === 0 ? 0x9a8040 : WALL }
  })
}

// ── Small Hospital  20×10×20 = 4,000 ────────────────────────────────────────

export function generateSmallHospital(): BlueprintVoxel[] {
  const W = 20, D = 10, H = 20, FH = 4
  const WALL = 0xe8e8f0, ROOF = 0xaaaacc, FOUND = 0x888899, TRIM = 0x9999aa
  const RED = 0xdd3344
  const midX = Math.floor(W / 2)
  return solid(W, D, H, (x, y, z) => {
    if (y === H - 1) {
      // Red cross on roof
      const isCross =
        (Math.abs(x - midX) <= 1 && Math.abs(z - Math.floor(D / 2)) <= 3) ||
        (Math.abs(z - Math.floor(D / 2)) <= 1 && Math.abs(x - midX) <= 3)
      return { type: "roof", color: isCross ? RED : ROOF }
    }
    if (y === 0) return { type: "stone", color: FOUND }
    const fy = y % FH
    if (ext(x, z, W, D)) {
      // Red cross on front facade (z=0)
      const isFrontCross =
        z === 0 &&
        ((Math.abs(x - midX) <= 1 && y >= 4 && y <= 10) ||
          (y >= 6 && y <= 8 && Math.abs(x - midX) <= 3))
      if (isFrontCross) return { type: "wall", color: RED }
      if (fy === 0 || fy === FH - 1) return { type: "wall", color: TRIM }
      if (isWin(x, y, z, W, D, FH, [1, 2], 4)) return { type: "window", color: GLASS_HEX }
      return { type: "wall", color: WALL }
    }
    return { type: fy === 0 ? "floor" : "wall", color: fy === 0 ? 0x9999aa : WALL }
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
// generateFoodBank, and generateRestaurant use it for palette variety, the
// rest ignore the argument, which TS allows for a function with fewer
// declared params than the Record's value type expects.
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
