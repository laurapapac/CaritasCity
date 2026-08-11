export type Block = { x: number; y: number; z: number; type: string; color?: number | string }

const GLASS = 0x90c8d8

// ── Imported-style helpers (hollow shell+slab approach) ────────────────────────

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

const IMPORTED_GLASS = new Set([0x9fe4f5, 0x5aa8cc])

type Setter = (x: number, y: number, z: number, c: number) => void

function makeBlocks(fn: (s: Setter) => void): Block[] {
  const map = new Map<string, number>()
  fn((x, y, z, c) => map.set(`${x},${y},${z}`, c))
  return Array.from(map.entries()).map(([k, c]) => {
    const [x, y, z] = k.split(",").map(Number)
    // Glass colors from the imported palette → transparent window type
    return IMPORTED_GLASS.has(c)
      ? { x, y, z, type: "window" }
      : { x, y, z, type: "wall", color: c as number }
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

// ── Solid-fill helpers (used by original generators) ──────────────────────────

// Fills a W×D×H solid volume, centered at origin
function solid(
  W: number,
  D: number,
  H: number,
  fn: (x: number, y: number, z: number) => { type: string; color: number },
): Block[] {
  const out: Block[] = []
  const ox = -Math.floor(W / 2)
  const oz = -Math.floor(D / 2)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let z = 0; z < D; z++) {
        const r = fn(x, y, z)
        out.push({ x: x + ox, y, z: z + oz, type: r.type, color: r.color })
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
  // non-corner z-face (z fixed, x varies)
  if ((z === 0 || z === D - 1) && x > 0 && x < W - 1) return winPos(x, W, period)
  // non-corner x-face (x fixed, z varies)
  if ((x === 0 || x === W - 1) && z > 0 && z < D - 1) return winPos(z, D, period)
  return false
}

// ── Short Apartment  20×10×20 = 4,000 ────────────────────────────────────────

export function generateShortApartment(): Block[] {
  const W = 20, D = 10, H = 20, FH = 4
  const WALL = 0xc05030, ROOF = 0x4a4a6a, FOUND = 0x7a8090, TRIM = 0x8a3a28
  return solid(W, D, H, (x, y, z) => {
    if (y === H - 1) return { type: "roof", color: ROOF }
    if (y === 0) return { type: "stone", color: FOUND }
    const fy = y % FH
    if (ext(x, z, W, D)) {
      if (fy === 0 || fy === FH - 1) return { type: "wall", color: TRIM }
      if (isWin(x, y, z, W, D, FH, [1, 2])) return { type: "window", color: GLASS }
      return { type: "wall", color: WALL }
    }
    return { type: fy === 0 ? "floor" : "wall", color: fy === 0 ? 0x9a8878 : WALL }
  })
}

// ── Tall Apartment  16×10×50 = 8,000 ─────────────────────────────────────────

export function generateTallApartment(): Block[] {
  const W = 16, D = 10, H = 50, FH = 5
  const WALL = 0x8898aa, ROOF = 0x334455, FOUND = 0x666677, TRIM = 0x6688aa
  return solid(W, D, H, (x, y, z) => {
    if (y === H - 1) return { type: "roof", color: ROOF }
    if (y === 0) return { type: "stone", color: FOUND }
    const fy = y % FH
    if (ext(x, z, W, D)) {
      if (fy === 0 || fy === FH - 1) return { type: "wall", color: TRIM }
      if (isWin(x, y, z, W, D, FH, [1, 2, 3], 2)) return { type: "window", color: GLASS }
      return { type: "wall", color: WALL }
    }
    return { type: fy === 0 ? "floor" : "wall", color: fy === 0 ? 0x777888 : WALL }
  })
}

// ── Food Bank  40×10×10 = 4,000 ──────────────────────────────────────────────

export function generateFoodBank(): Block[] {
  const W = 40, D = 10, H = 10
  const WALL = 0xc8a870, ROOF = 0x8b6c42, FOUND = 0x8a7a5a
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
        return { type: "window", color: GLASS }
      // Side wall windows
      if ((x === 0 || x === W - 1) && y >= 4 && y <= 6 && z > 0 && z < D - 1 && z % 3 === 1)
        return { type: "window", color: GLASS }
      return { type: "wall", color: WALL }
    }
    return { type: "wall", color: 0xb89860 }
  })
}

// ── Restaurant  22×11×(6 floors × fh4) = 5,000 ───────────────────────────────
// Visual: warm brick, large storefront glazing, red awning, chimney, rooftop sign

export function generateRestaurant(): Block[] {
  return makeBlocks(s => {
    const [W, D, floors, fh] = [22, 11, 6, 4]
    ifill(s, 0, 0, 0, W, 2, D, P.sandDark)
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      ishell(s, 0, y0, 0, W, fh, D, P.brick, 2)
      islab(s, 2, y0, 2, W - 4, D - 4, P.woodDark)
      if (f === 0) {
        ifill(s, 2, y0, 0, W - 4, fh - 1, 2, P.glassDark)
        for (let x = 2; x < W - 2; x += 4) ifill(s, x, y0, 0, 1, fh - 1, 2, P.woodDark)
      } else {
        iwinRow(s, 0, y0 + 1, 0, W, D, P.glass, 4, 1)
      }
    }
    // Red awning
    ifill(s, -1, 2 + fh - 1, -2, W + 2, 1, 3, P.red)
    ifill(s, -1, 2 + fh, -2, W + 2, 1, 3, P.redLight)
    // Chimney + cap
    ifill(s, W - 3, 2 + floors * fh, D - 3, 2, 5, 2, P.brickDark)
    ifill(s, W - 4, 2 + floors * fh + 5, D - 4, 4, 1, 1, P.brickDark)
    // Rooftop sign
    ifill(s, 3, 2 + floors * fh, 0, W - 6, 3, 2, P.wood)
    ifill(s, 4, 2 + floors * fh + 1, 0, W - 8, 2, 1, P.yellow)
    // Floor trim
    for (let f = 0; f < floors; f++) ifill(s, 0, 2 + f * fh + fh - 1, 0, W, 1, D, P.woodDark)
  })
}

// ── School  50×10×10 = 5,000 ─────────────────────────────────────────────────

export function generateSchool(): Block[] {
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
        return { type: "window", color: GLASS }
      if (fy === 0 || fy === FH - 1) return { type: "wall", color: TRIM }
      // Wide classroom windows on front and back
      if ((z === 0 || z === D - 1) && x > 0 && x < W - 1 && (x - 2) % 4 === 0)
        return { type: "window", color: GLASS }
      // Side windows
      if ((x === 0 || x === W - 1) && z > 0 && z < D - 1 && z % 2 === 1)
        return { type: "window", color: GLASS }
      return { type: "wall", color: WALL }
    }
    return { type: fy === 0 ? "floor" : "wall", color: fy === 0 ? 0x9a8040 : WALL }
  })
}

// ── Small Hospital  20×10×20 = 4,000 ─────────────────────────────────────────

export function generateSmallHospital(): Block[] {
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
      if (isWin(x, y, z, W, D, FH, [1, 2], 4)) return { type: "window", color: GLASS }
      return { type: "wall", color: WALL }
    }
    return { type: fy === 0 ? "floor" : "wall", color: fy === 0 ? 0x9999aa : WALL }
  })
}

// ── Medium Hospital  18×18×(6 floors × fh3) + tower = 6,000 ──────────────────
// Visual: white shell + central protruding tower, roof cross, ambulance bay

export function generateMediumHospital(): Block[] {
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

// ── Large Hospital  16×16×(9 floors × fh3) + two towers = 8,000 ──────────────
// Visual: white main body, left + right staggered towers, helipad, antenna

export function generateLargeHospital(): Block[] {
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

export const BUILDINGS = [
  { id: "short-apt",   label: "Short Apartment", blocks: 4_000, generate: generateShortApartment },
  { id: "tall-apt",    label: "Tall Apartment",  blocks: 8_000, generate: generateTallApartment  },
  { id: "food-bank",   label: "Food Bank",        blocks: 4_000, generate: generateFoodBank       },
  { id: "restaurant",  label: "Restaurant",       blocks: 5_000, generate: generateRestaurant     },
  { id: "school",      label: "School",           blocks: 5_000, generate: generateSchool         },
  { id: "small-hosp",  label: "Small Hospital",   blocks: 4_000, generate: generateSmallHospital  },
  { id: "med-hosp",    label: "Medium Hospital",  blocks: 6_000, generate: generateMediumHospital },
  { id: "large-hosp",  label: "Large Hospital",   blocks: 8_000, generate: generateLargeHospital  },
] as const
