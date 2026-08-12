/**
 * One-off codegen: generates the static building layout for all 158 buildings,
 * the park/lake zones, and the road network, writing them to
 * src/data/cityLayout.ts, src/data/cityDecor.ts, and src/data/cityRoads.ts.
 * Run via (from the repo root):
 *   node --experimental-strip-types src/scripts/generateCityLayout.ts
 * Re-running with the same seed reproduces the exact same output
 * (deterministic RNG) — only rerun this if the design itself is being
 * deliberately revisited, since position is a fixed design decision per
 * plans/qr-backend-todo.md, not runtime state.
 *
 * Layout style (user decision, 2026-08-11): organic (not grid-snapped),
 * mixed categories (not zoned/clustered by category). Revised same day after
 * user feedback on the first pass ("schools clustered in the middle, houses
 * all pushed to the outside, 4 food banks bunched on one side") — root cause
 * was placing largest-footprint-first with a radius that only grew as items
 * got placed, so same-variant buildings (processed back-to-back) landed
 * together while the radius was still small/stable, and houses (smallest,
 * processed last) only ever saw the final, mostly-full, grown-out disc. Fixed
 * by interleaving placement order across variants (buildInterleavedJobs).
 *
 * Phase 3 (2026-08-11): carves out RESERVED_ZONES (parks/lakes, user's
 * explicit sizing/placement request) as no-build circles.
 *
 * Phase 3 road revision #2 (2026-08-11, same day): user supplied a hand-drawn
 * reference showing a real interconnected block network — nearly every
 * building fronting a road, the city divided into cells, rounded corners —
 * much denser than the "6 independent curved avenues" first revision (which
 * itself replaced an even denser MST-over-buildings graph the user found
 * "too much like a network"). Getting that block-grid look requires designing
 * the blocks and the buildings inside them together, not retrofitting roads
 * around already-placed buildings — so this version generates roads FIRST via
 * recursive rectangular subdivision (BSP: repeatedly split the city area into
 * two smaller rectangles, alternating axis by aspect ratio, until each leaf is
 * block-sized), uses every kept leaf's own 4 edges as road segments (shared
 * edges between two kept blocks naturally dedupe to one road), then allocates
 * the 158 buildings across blocks by size (greedy: largest building first,
 * placed into whichever eligible block — big enough in both dimensions —
 * currently has the most free area) and places each block's buildings inside
 * it via small-scale rejection sampling. Building positions are NOT the same
 * as the previous two Phase 3 passes — this is a real regeneration, not a
 * rendering-only change (user explicitly signed off on that tradeoff).
 *
 * Known simplification: road corners are sharp (not rounded like the
 * reference sketch) — filleting BSP-grid corners is extra geometry work not
 * done in this pass; revisit if it matters once this version's been reviewed.
 *
 * Parks/lakes shape overhaul (2026-08-11): parks were flat circles unrelated
 * to the block grid; user sent a reference showing parks shaped like real
 * merged city blocks (following road boundaries) and lakes as organic pond
 * blobs, with one lake nested inside a park. A park's shape is the union of
 * the BSP tiles mostly inside its own zone circle (parkTilesFor,
 * rectOverlapFraction) — not simply every tile the exclusion check touches
 * (rectIntersectsAnyZone stays deliberately permissive for the actual
 * building/road exclusion, but rendering only the well-covered tiles as
 * green avoids two parks visually fusing along a barely-shared tile). Lakes
 * get a Catmull-free "noisy circle" outline (sampleBlobPolygon) instead of a
 * perfect CircleGeometry.
 *
 * Follow-up same day: the first version of this merged central_park and
 * central_lake into one bigger zone so the lake could be "derived" as always
 * sitting inside the park — that over-excluded BSP tiles versus the original
 * two-separate-circles footprint and silently dropped a block of buildings.
 * Reverted to two independent zones (see RESERVED_ZONES); parkTilesFor now
 * pulls a nearby paired zone's tiles into the same rendered polygon instead
 * (zonesAreAdjacent) — same "lake in the park" look, without needing the
 * lake's position to depend on the park's tile layout.
 */

import { writeFileSync } from "node:fs"
import { join } from "node:path"

type Category = "residential" | "hospital" | "food" | "school"

interface BuildingSpec {
  variant: string
  category: Category
  count: number
  totalBlocks: number
  /** Footprint in world/voxel units, matching each variant's real generator
   *  (src/components/city/buildingGenerators.ts's local W/D consts; house's
   *  14x12 measured from house-blueprint.json's x/z extent). */
  width: number
  depth: number
}

// Mirrors server/src/scripts/seed.ts's BUILDINGS array (same variants/counts/
// totalBlocks, same insertion order) plus each variant's real footprint size.
const BUILDING_SPECS: BuildingSpec[] = [
  { variant: "house",           category: "residential", count: 75, totalBlocks: 1080, width: 14, depth: 12 },
  { variant: "short_apartment", category: "residential", count: 23, totalBlocks: 4000, width: 20, depth: 10 },
  { variant: "tall_apartment",  category: "residential", count: 12, totalBlocks: 8000, width: 16, depth: 10 },
  { variant: "food_bank",       category: "food",        count: 11, totalBlocks: 4000, width: 40, depth: 10 },
  { variant: "restaurant",      category: "food",        count: 14, totalBlocks: 5000, width: 22, depth: 11 },
  { variant: "school",          category: "school",      count: 13, totalBlocks: 5000, width: 50, depth: 10 },
  { variant: "hospital_small",  category: "hospital",    count: 5,  totalBlocks: 4000, width: 20, depth: 10 },
  { variant: "hospital_medium", category: "hospital",    count: 4,  totalBlocks: 6000, width: 18, depth: 18 },
  { variant: "hospital_large",  category: "hospital",    count: 1,  totalBlocks: 8000, width: 16, depth: 16 },
]

// Minimum clearance reserved around every building's footprint, around every
// park/lake zone edge, and between a building and its own block's edge (i.e.
// the road running along that edge).
const ROAD_GAP = 8

const SEED = 20260811

interface ReservedZone {
  id: string
  kind: "park" | "lake"
  x: number
  z: number
  radius: number
}

// User's explicit Phase 3 request (2026-08-11): one decently-sized park+lake
// together near the middle (not too big), two smaller parks on the outskirts
// kept apart from each other, one smaller-than-the-first lake on the outskirts
// by itself. Positioned by hand (not algorithmically) since this is a design
// choice, same as the building-counts table — angularly spread ~90-150° apart
// so the three outskirts features don't end up near one another either.
//
// Reverted 2026-08-11 (parks/lakes follow-up): central_park and central_lake
// were briefly merged into one bigger central_park zone so the lake could be
// "derived" as sitting inside the park, but that merge over-excluded BSP
// tiles compared to the original two-separate-circles footprint, silently
// removing a whole block of buildings+roads from the generated city. Reverted
// central_park/central_lake back to two independent zones (values recovered
// by pixel-measuring the pre-merge screenshot against the 3 zones that were
// never touched — see the "park-tile over-claiming" status entries in
// plans/qr-backend-todo.md for the full story) — this restores the exact
// original building layout. The "lake in the park" look now comes from
// parkTilesFor pulling in a nearby lake zone's tiles too (see
// zonesAreAdjacent), not from deriving the lake's position from the park.
//
// Reverted again same day: a follow-up pass enlarged park_north/park_south/
// lake_east to make parks look bigger and lakes match a reference image, but
// that excluded even more buildings than before — user asked to get the
// exact original building layout back first and deal with park/lake
// aesthetics separately. All 5 values below are back to the exact recovered
// originals (pixel-measured from the pre-merge screenshot), matching the
// building layout in that screenshot exactly.
const RESERVED_ZONES: ReservedZone[] = [
  { id: "central_park", kind: "park", x: -25, z: 0, radius: 28 },
  { id: "central_lake", kind: "lake", x: 25, z: 0, radius: 20 },
  { id: "park_north",   kind: "park", x: -40, z: 175, radius: 20 },
  { id: "park_south",   kind: "park", x: -70, z: -165, radius: 18 },
  { id: "lake_east",    kind: "lake", x: 185, z: 40, radius: 15 },
]

// ── Roads: recursive block subdivision (BSP), not a curve or a graph over
// buildings — see the "road revision #2" module doc comment above. ─────────

const ROAD_WIDTH = 4
const TREE_SPACING = 20
const TREE_MARGIN = 8 // no trees within this distance of either road-segment endpoint
const TREE_OFFSET = ROAD_WIDTH / 2 + 2 // how far off the road centerline, to each side

// Bounding square BSP starts from, and how far from center a leaf's center
// has to be to get kept — the "circular-ish" filter that gives the whole city
// an organic (not square) outline, same idea as the earlier disc-based passes.
const ROOT_HALF_SIZE = 280
const CITY_RADIUS = 280
// Stop subdividing a block once it's this small in area, or this many splits
// deep — together these determine roughly how many buildings end up per
// block. Tuned by running the script and checking the logged block count /
// buildings-per-block, same "iterate by feel" approach as the rest of this
// file's constants.
const MIN_BLOCK_AREA = 5500
const MAX_SPLIT_DEPTH = 6

class RNG {
  private s: number
  constructor(seed: number) { this.s = ((seed ^ 0x9e3779b9) >>> 0) || 1 }
  next(): number {
    let s = this.s
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    this.s = s >>> 0
    return this.s / 0x100000000
  }
}

interface Point { x: number; z: number }
interface Rect { x0: number; z0: number; x1: number; z1: number }
interface RoadSegment { x1: number; z1: number; x2: number; z2: number }

// Closest-point rectangle-vs-circle test, used for reserved park/lake zones.
function overlapsCircle(x: number, z: number, width: number, depth: number, circle: Point & { radius: number }): boolean {
  const halfW = width / 2, halfD = depth / 2
  const closestX = Math.max(x - halfW, Math.min(circle.x, x + halfW))
  const closestZ = Math.max(z - halfD, Math.min(circle.z, z + halfD))
  const dx = circle.x - closestX, dz = circle.z - closestZ
  const total = circle.radius + ROAD_GAP
  return dx * dx + dz * dz < total * total
}

function overlapsAnyZone(x: number, z: number, width: number, depth: number): boolean {
  return RESERVED_ZONES.some((zone) => overlapsCircle(x, z, width, depth, zone))
}

// Pure geometric rect-vs-circle overlap (no ROAD_GAP padding) — used to keep
// whole blocks out of the buildable pool when a park/lake zone eats into
// them, rather than trying to shelf-pack buildings around an irregular
// zone-shaped hole inside a block. Also doubles as each park's own shape: see
// parkTilesFor below, which reuses this same per-zone test to find exactly
// the leaves a given zone claims.
function rectIntersectsZone(rect: Rect, zone: ReservedZone): boolean {
  const closestX = Math.max(rect.x0, Math.min(zone.x, rect.x1))
  const closestZ = Math.max(rect.z0, Math.min(zone.z, rect.z1))
  const dx = zone.x - closestX, dz = zone.z - closestZ
  return dx * dx + dz * dz < zone.radius * zone.radius
}

function rectIntersectsAnyZone(rect: Rect): boolean {
  return RESERVED_ZONES.some((zone) => rectIntersectsZone(rect, zone))
}

// Fraction of a rect's area that falls inside a zone's circle, estimated by
// sampling a grid of points across the rect. BSP tiles are often much larger
// than a park's own radius, so a plain "does any part of the rect touch the
// circle" test (rectIntersectsZone) massively over-claims: a tile 90% outside
// the circle still counts as 100% park. That over-claiming is what previously
// caused central_park and park_north to render as one fused blob (back when
// central_park's radius was bloated to 45 to also cover the lake) — this
// fraction test is the fix.
function rectOverlapFraction(rect: Rect, zone: ReservedZone, samplesPerAxis = 6): number {
  let inside = 0
  const total = samplesPerAxis * samplesPerAxis
  for (let i = 0; i < samplesPerAxis; i++) {
    const px = rect.x0 + ((i + 0.5) / samplesPerAxis) * (rect.x1 - rect.x0)
    for (let j = 0; j < samplesPerAxis; j++) {
      const pz = rect.z0 + ((j + 0.5) / samplesPerAxis) * (rect.z1 - rect.z0)
      const dx = zone.x - px, dz = zone.z - pz
      if (dx * dx + dz * dz <= zone.radius * zone.radius) inside++
    }
  }
  return inside / total
}

// Two zones read as one merged "park+lake" feature (matching the reference
// image, where the lake sits inside the same green polygon as its
// neighboring park) when their circles nearly touch or overlap — a distance
// heuristic, not a hardcoded id pairing, so it only catches zones actually
// meant to be visually paired (central_park/central_lake, ~2 units of gap
// between their edges) and never the far-apart outskirts zones.
const ZONE_PAIRING_MARGIN = 20

function zonesAreAdjacent(a: ReservedZone, b: ReservedZone): boolean {
  const gap = Math.hypot(a.x - b.x, a.z - b.z) - a.radius - b.radius
  return gap < ZONE_PAIRING_MARGIN
}

// Shared-edge test used both to decide which park tiles can merge seamlessly
// (insetParkTiles) and to flood-fill a park's full connected reserved-
// territory (parkTilesFor below) — two rects "touch" only if they share a
// substantial run of one edge (MIN_SHARED_EDGE), not just a corner graze.
const MIN_SHARED_EDGE = 5

function tilesAreAdjacent(a: Rect, b: Rect): boolean {
  if (Math.abs(a.x1 - b.x0) < 0.5 || Math.abs(a.x0 - b.x1) < 0.5) {
    return Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > MIN_SHARED_EDGE
  }
  if (Math.abs(a.z1 - b.z0) < 0.5 || Math.abs(a.z0 - b.z1) < 0.5) {
    return Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > MIN_SHARED_EDGE
  }
  return false
}

// A park's rendered shape is its FULL connected island of reserved territory
// — every kept leaf that rectIntersectsAnyZone already permanently excludes
// from buildings, reachable by walking leaf-to-leaf adjacency from the
// zone's own best-overlapping tile (rectOverlapFraction picks that seed, so
// a park's circle never reaches across a real gap into an unrelated zone's
// island — see zonesAreAdjacent/ZONE_PAIRING_MARGIN for why two DIFFERENT
// parks' islands can still merge on purpose when explicitly paired, e.g.
// central_park+central_lake). Earlier versions only rendered the single
// best-fraction tile (or every tile clearing a fraction threshold), which
// under-claimed real neighboring reserved leaves whenever a zone's circle
// happened to cover more of one leaf than another even though BOTH are
// equally, permanently building-free — this flood-fill includes all of them,
// matching "fill the space between the roads that circle it" (2026-08-11
// follow-up) exactly, since a leaf that's excluded from buildableLeaves is
// also excluded from ever contributing its own road edges (leavesToRoads),
// so its unclaimed portion was already invisible dead space, not a road.
function parkTilesFor(zone: ReservedZone, keptLeaves: Rect[]): Rect[] {
  const group = [zone, ...RESERVED_ZONES.filter((z) => z !== zone && zonesAreAdjacent(zone, z))]
  const candidates = keptLeaves
    .map((rect) => ({ rect, frac: Math.max(...group.map((z) => rectOverlapFraction(rect, z))) }))
    .filter((c) => c.frac > 0)
    .sort((a, b) => b.frac - a.frac)
  if (candidates.length === 0) return []

  const zoneExcludedLeaves = keptLeaves.filter((r) => rectIntersectsAnyZone(r))
  const included = [candidates[0].rect]
  let grew = true
  while (grew) {
    grew = false
    for (const leaf of zoneExcludedLeaves) {
      if (included.includes(leaf)) continue
      if (included.some((t) => tilesAreAdjacent(t, leaf))) {
        included.push(leaf)
        grew = true
      }
    }
  }
  return included
}

// Roads run centered on every BSP leaf boundary (ROAD_WIDTH wide), so
// rendering a park tile at its raw leaf bounds always paints ROAD_WIDTH/2 of
// green over the road on every edge that borders one. A whole-edge "inset or
// not" decision isn't enough though — a single tile edge can border MORE
// THAN ONE neighboring leaf (BSP leaves aren't uniformly sized), so part of
// an edge can be a real road while the rest is a seamless join with another
// tile in the same park. classifyEdgeIntervals finds the exact sub-ranges of
// each edge that border a same-park tile (no inset — avoids a seam down the
// middle of a merged park) vs. everything else (inset — a real leaf with a
// road, a different/unpaired zone, or nothing at all past the city's edge,
// which needs no inset either since there's no road there, but insetting it
// anyway is harmless/no different visually). insetParkTiles then slices each
// tile at every such interval boundary (on both axes, so a tile with mixed
// intervals on two different sides still comes out right) and computes the
// inset per resulting piece — a piece's cut edges that aren't part of the
// original tile boundary (introduced purely by this slicing) never get
// inset, since they're not real edges at all.
const PARK_ROAD_INSET = ROAD_WIDTH / 2 + 1

interface Interval { lo: number; hi: number; inset: boolean }

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.lo - b.lo)
  const out: Interval[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && last.inset === iv.inset && iv.lo <= last.hi + 0.5) {
      last.hi = Math.max(last.hi, iv.hi)
    } else {
      out.push({ ...iv })
    }
  }
  return out
}

function classifyEdgeIntervals(tile: Rect, side: "x0" | "x1" | "z0" | "z1", ownTiles: Rect[], keptLeaves: Rect[]): Interval[] {
  const isXSide = side === "x0" || side === "x1"
  const lo = isXSide ? tile.z0 : tile.x0
  const hi = isXSide ? tile.z1 : tile.x1
  const fixed = tile[side]

  const raw: Interval[] = []
  for (const leaf of keptLeaves) {
    if (leaf === tile) continue
    const touches =
      side === "x0" ? Math.abs(leaf.x1 - fixed) < 0.5 :
      side === "x1" ? Math.abs(leaf.x0 - fixed) < 0.5 :
      side === "z0" ? Math.abs(leaf.z1 - fixed) < 0.5 :
                       Math.abs(leaf.z0 - fixed) < 0.5
    if (!touches) continue
    const nlo = isXSide ? leaf.z0 : leaf.x0
    const nhi = isXSide ? leaf.z1 : leaf.x1
    const olo = Math.max(lo, nlo), ohi = Math.min(hi, nhi)
    if (ohi - olo > MIN_SHARED_EDGE) raw.push({ lo: olo, hi: ohi, inset: !ownTiles.includes(leaf) })
  }

  const merged = mergeIntervals(raw)
  const filled: Interval[] = []
  let cursor = lo
  for (const iv of merged) {
    if (iv.lo > cursor + 0.5) filled.push({ lo: cursor, hi: iv.lo, inset: false })
    filled.push(iv)
    cursor = iv.hi
  }
  if (cursor < hi - 0.5) filled.push({ lo: cursor, hi, inset: false })
  return mergeIntervals(filled)
}

function insetParkTiles(tiles: Rect[], keptLeaves: Rect[]): Rect[] {
  const result: Rect[] = []
  for (const tile of tiles) {
    const x0c = classifyEdgeIntervals(tile, "x0", tiles, keptLeaves)
    const x1c = classifyEdgeIntervals(tile, "x1", tiles, keptLeaves)
    const z0c = classifyEdgeIntervals(tile, "z0", tiles, keptLeaves)
    const z1c = classifyEdgeIntervals(tile, "z1", tiles, keptLeaves)

    const zPoints = new Set([tile.z0, tile.z1])
    for (const iv of [...x0c, ...x1c]) { zPoints.add(iv.lo); zPoints.add(iv.hi) }
    const xPoints = new Set([tile.x0, tile.x1])
    for (const iv of [...z0c, ...z1c]) { xPoints.add(iv.lo); xPoints.add(iv.hi) }

    const zSorted = [...zPoints].sort((a, b) => a - b)
    const xSorted = [...xPoints].sort((a, b) => a - b)

    const insetAt = (intervals: Interval[], mid: number) =>
      intervals.find((iv) => mid >= iv.lo - 0.5 && mid <= iv.hi + 0.5)?.inset ?? false

    for (let xi = 0; xi < xSorted.length - 1; xi++) {
      for (let zi = 0; zi < zSorted.length - 1; zi++) {
        const px0 = xSorted[xi], px1 = xSorted[xi + 1]
        const pz0 = zSorted[zi], pz1 = zSorted[zi + 1]
        if (px1 - px0 < 0.5 || pz1 - pz0 < 0.5) continue
        const midX = (px0 + px1) / 2, midZ = (pz0 + pz1) / 2
        const insetX0 = Math.abs(px0 - tile.x0) < 0.5 && insetAt(x0c, midZ)
        const insetX1 = Math.abs(px1 - tile.x1) < 0.5 && insetAt(x1c, midZ)
        const insetZ0 = Math.abs(pz0 - tile.z0) < 0.5 && insetAt(z0c, midX)
        const insetZ1 = Math.abs(pz1 - tile.z1) < 0.5 && insetAt(z1c, midX)
        result.push({
          x0: px0 + (insetX0 ? PARK_ROAD_INSET : 0),
          x1: px1 - (insetX1 ? PARK_ROAD_INSET : 0),
          z0: pz0 + (insetZ0 ? PARK_ROAD_INSET : 0),
          z1: pz1 - (insetZ1 ? PARK_ROAD_INSET : 0),
        })
      }
    }
  }
  return result
}

// An organic pond outline: a circle whose radius is perturbed by two
// low-frequency sine waves (different integer frequencies + a seeded phase
// per lake, so every lake gets its own irregular-but-smooth silhouette
// without needing a real noise function). No sharp jumps between neighboring
// vertices since sine is continuous — reads as a natural blob, not a
// polygon with random spikes.
function sampleBlobPolygon(rng: RNG, cx: number, cz: number, baseRadius: number, segments = 20): Point[] {
  const freq1 = 2 + Math.floor(rng.next() * 2) // 2-3
  const freq2 = 5 + Math.floor(rng.next() * 3) // 5-7
  const phase1 = rng.next() * Math.PI * 2
  const phase2 = rng.next() * Math.PI * 2
  const points: Point[] = []
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const wobble = 1 + 0.22 * Math.sin(freq1 * theta + phase1) + 0.12 * Math.sin(freq2 * theta + phase2)
    const r = baseRadius * wobble
    points.push({ x: Math.round((cx + r * Math.cos(theta)) * 10) / 10, z: Math.round((cz + r * Math.sin(theta)) * 10) / 10 })
  }
  return points
}

// Recursively splits `rect` in two along its longer axis (so blocks stay
// roughly proportioned, not skinny slivers), at a randomized 38-62% fraction,
// until a leaf is small enough or deep enough to stop. Returns every leaf
// rectangle (including ones that will later be discarded for falling outside
// CITY_RADIUS — that filtering happens afterward, in keepBlock/leavesToRoads).
// How elongated a leaf is allowed to be (longer side / shorter side) before
// it's forced to keep splitting regardless of area — a narrow sliver block
// (e.g. 36x84) is geometrically hard to pack even when its total area is
// generous, since buildings compete for the one short dimension. Allowed a
// few splits past MAX_SPLIT_DEPTH specifically to fix this (MAX_SPLIT_DEPTH
// alone stops recursion too early for that purpose).
const MAX_ASPECT_RATIO = 1.8
const HARD_MAX_DEPTH = MAX_SPLIT_DEPTH + 3
// A split is rejected outright (rect kept whole) if it would produce a child
// below this — a parent just above MIN_BLOCK_AREA can still split into an
// unbalanced 38/62 pair with one child well below it otherwise (e.g. a
// 6500-area parent → a 2470-area child), which is how an earlier version of
// this produced a leaf too small to fit even two houses side by side. Set
// well below MIN_BLOCK_AREA itself so it only ever intervenes on that
// specific unbalanced-split edge case, not on ordinary splitting.
const ABSOLUTE_MIN_LEAF_AREA = 2000

function bspSplit(rect: Rect, rng: RNG, depth = 0): Rect[] {
  const width = rect.x1 - rect.x0
  const height = rect.z1 - rect.z0
  const area = width * height
  const aspect = Math.max(width, height) / Math.min(width, height)

  if (depth >= HARD_MAX_DEPTH) return [rect]
  const normalStop = area < MIN_BLOCK_AREA || depth >= MAX_SPLIT_DEPTH
  const badAspect = aspect > MAX_ASPECT_RATIO
  if (normalStop && !badAspect) return [rect]

  const frac = 0.38 + rng.next() * 0.24
  const splitVertical = width >= height
  const splitAt = splitVertical ? rect.x0 + width * frac : rect.z0 + height * frac
  const areaA = splitVertical ? (splitAt - rect.x0) * height : width * (splitAt - rect.z0)
  const areaB = area - areaA
  if (areaA < ABSOLUTE_MIN_LEAF_AREA || areaB < ABSOLUTE_MIN_LEAF_AREA) return [rect]

  if (splitVertical) {
    const splitX = splitAt
    return [
      ...bspSplit({ ...rect, x1: splitX }, rng, depth + 1),
      ...bspSplit({ ...rect, x0: splitX }, rng, depth + 1),
    ]
  } else {
    const splitZ = splitAt
    return [
      ...bspSplit({ ...rect, z1: splitZ }, rng, depth + 1),
      ...bspSplit({ ...rect, z0: splitZ }, rng, depth + 1),
    ]
  }
}

function rectCenter(r: Rect): Point {
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }
}

function keepBlock(r: Rect): boolean {
  const c = rectCenter(r)
  return Math.hypot(c.x, c.z) <= CITY_RADIUS
}

// Every KEPT, non-zone-overlapping leaf contributes its own 4 edges as road
// segments; edges shared with a neighboring qualifying leaf naturally collide
// on the same key and dedupe to one road. A leaf that a park/lake zone
// overlaps contributes none of its own edges — but its non-overlapping
// NEIGHBORS still contribute theirs, including the edge they share with the
// excluded leaf, so the zone ends up bounded by a road on whichever sides
// border real blocks, with no road cutting through its interior. (Excluding
// leaves bordering the *disc radius* instead of a zone works the same way,
// by the same mechanism — that's what forms the outer boundary road.)
function leavesToRoads(leaves: Rect[]): RoadSegment[] {
  const segs = new Map<string, RoadSegment>()
  const key = (a: Point, b: Point) => {
    const ka = `${a.x.toFixed(1)},${a.z.toFixed(1)}`
    const kb = `${b.x.toFixed(1)},${b.z.toFixed(1)}`
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
  }
  for (const r of leaves) {
    if (!keepBlock(r) || rectIntersectsAnyZone(r)) continue
    const corners = {
      bl: { x: r.x0, z: r.z0 }, br: { x: r.x1, z: r.z0 },
      tl: { x: r.x0, z: r.z1 }, tr: { x: r.x1, z: r.z1 },
    }
    const edges: [Point, Point][] = [
      [corners.bl, corners.br], [corners.tl, corners.tr],
      [corners.bl, corners.tl], [corners.br, corners.tr],
    ]
    for (const [a, b] of edges) {
      const k = key(a, b)
      if (!segs.has(k)) segs.set(k, { x1: a.x, z1: a.z, x2: b.x, z2: b.z })
    }
  }
  return [...segs.values()]
}

interface PlacedBuilding {
  buildingId: string
  variant: string
  category: Category
  totalBlocks: number
  width: number
  depth: number
  x: number
  z: number
}

function overlaps(a: PlacedBuilding, x: number, z: number, width: number, depth: number): boolean {
  const halfAW = a.width / 2 + ROAD_GAP / 2
  const halfAD = a.depth / 2 + ROAD_GAP / 2
  const halfBW = width / 2 + ROAD_GAP / 2
  const halfBD = depth / 2 + ROAD_GAP / 2
  return Math.abs(a.x - x) < halfAW + halfBW && Math.abs(a.z - z) < halfAD + halfBD
}

type Job = Omit<PlacedBuilding, "x" | "z">

// Round-robin across variants (largest-count variants keep reappearing after
// smaller ones run out) so the flat job list used for greedy block assignment
// is already well-mixed by category before being split across blocks.
function buildInterleavedJobs(rng: RNG): Job[] {
  const remaining = BUILDING_SPECS.map((s) => ({ spec: s, left: s.count }))
  const jobs: Job[] = []
  const order = [...remaining].sort(() => rng.next() - 0.5)
  while (order.some((r) => r.left > 0)) {
    for (const r of order) {
      if (r.left <= 0) continue
      const i = r.spec.count - r.left
      jobs.push({
        buildingId: `${r.spec.variant}_${i}`,
        variant: r.spec.variant,
        category: r.spec.category,
        totalBlocks: r.spec.totalBlocks,
        width: r.spec.width,
        depth: r.spec.depth,
      })
      r.left--
    }
  }
  return jobs
}

interface BlockState {
  rect: Rect
  usableWidth: number
  usableDepth: number
  jobCount: number
  // Incremental shelf-packing cursor — see tryShelfPlace. Starts at the
  // block's own inset (ROAD_GAP/2 from every edge, clearing the road running
  // along it) and only ever advances, one committed building at a time.
  cursorX: number
  rowZ: number
  rowDepth: number
}

// A hard per-block count cap, independent of area — shelf packing wastes
// real space once a block mixes several very different widths (a food_bank
// at 40 wide forces its own near-empty row in anything but a very wide
// block), so this bounds how badly that can compound in one block regardless
// of what the area math suggests should still fit.
const MAX_BUILDINGS_PER_BLOCK = 6

// Simulates placing `job` next in `block`'s shelf-packing sequence (same
// left-to-right, new-row-when-full logic as a standalone packer would use)
// and, if it fits, commits the block's cursor state and returns the placed
// building. Returns null (no mutation) if it doesn't fit — the caller tries
// the next-best block instead. This replaced a two-phase design (greedy area-
// based assignment, then a separate shelf-packing pass per block) that kept
// producing blocks whose assigned buildings looked fine by total area but
// didn't actually shelf-pack (e.g. a wide food_bank forcing an extra
// near-empty row the area budget hadn't accounted for). Simulating the real
// packing operation AT assignment time removes that whole class of mismatch
// — a job is only ever assigned to a block it's already been proven to fit.
// PLACEMENT_GAP (not ROAD_GAP) drives the actual spacing decisions below —
// verifyNoOverlaps checks the final ROUNDED coordinates against exactly
// ROAD_GAP, but a placement computed to leave exactly ROAD_GAP of clearance
// in continuous space can lose up to ~1 unit of it to independent rounding
// on each building's x/z (Math.round on two buildings placed exactly
// ROAD_GAP apart can round them up to ~1 unit closer together) — this is
// exactly how restaurant_0/house_35 ended up 0.5 units short of ROAD_GAP
// apart the first time this ran. Placing with 2 extra units of margin leaves
// enough slack that rounding can never eat into the real ROAD_GAP guarantee.
const PLACEMENT_GAP = ROAD_GAP + 2

function tryShelfPlace(block: BlockState, job: Job): PlacedBuilding | null {
  const x0 = block.rect.x0 + PLACEMENT_GAP / 2, x1 = block.rect.x1 - PLACEMENT_GAP / 2
  const z1 = block.rect.z1 - PLACEMENT_GAP / 2

  let { cursorX, rowZ, rowDepth } = block
  if (cursorX > x0 && cursorX + job.width > x1) {
    rowZ += rowDepth + PLACEMENT_GAP
    cursorX = x0
    rowDepth = 0
  }

  const cx = cursorX + job.width / 2
  const cz = rowZ + job.depth / 2
  if (cx + job.width / 2 > x1 || cz + job.depth / 2 > z1) return null
  if (overlapsAnyZone(cx, cz, job.width, job.depth)) return null

  block.cursorX = cursorX + job.width + PLACEMENT_GAP
  block.rowZ = rowZ
  block.rowDepth = Math.max(rowDepth, job.depth)
  block.jobCount++

  return { ...job, x: Math.round(cx), z: Math.round(cz) }
}

// The clear strip above a block's last packed shelf row — everything from
// there up to the block's own inset top edge. Used to scatter filler decor
// (bushes, lamp posts, benches, plazas) into space buildings never claimed,
// without moving or resizing any building. Simplification: only counts the
// open strip above the last row, not the (usually much smaller) width
// leftover to the right of a partially-filled last row — same "good enough,
// iterate by feel" tolerance as the rest of this file's placement heuristics.
function blockLeftoverRect(block: BlockState): Rect | null {
  const x0 = block.rect.x0 + PLACEMENT_GAP / 2
  const x1 = block.rect.x1 - PLACEMENT_GAP / 2
  const topOfLastRow = block.rowDepth > 0
    ? block.rowZ + block.rowDepth + PLACEMENT_GAP
    : block.rect.z0 + PLACEMENT_GAP / 2
  const z1 = block.rect.z1 - PLACEMENT_GAP / 2
  if (topOfLastRow >= z1) return null
  return { x0, z0: topOfLastRow, x1, z1 }
}

// Largest building first (global order), tried against eligible blocks —
// dimensionally big enough, under the per-block cap — preferring whichever
// currently holds the fewest buildings (spreads load across blocks instead
// of stuffing the first eligible one), falling through to the next-fullest
// candidate if the preferred one's actual shelf state doesn't have room.
function assignAndPlace(jobs: Job[], blocks: BlockState[]): PlacedBuilding[] {
  // Largest footprint first (global order) so oversized buildings get first
  // pick of blocks while more are still empty — but every building sharing a
  // variant has the EXACT same width/depth, so sorting purely by area
  // collapses all of them into one contiguous run (e.g. all 13 schools back
  // to back). Combined with "prefer the least-full block" that run then fills
  // whichever blocks happen to sit early in the array in sequence — the same
  // geographic-clustering bug Phase 2's disc-based placement had before it
  // was fixed there, just reappearing here in the block-based version. Fixed
  // the same way in spirit: track where each variant has already landed, and
  // prefer the block FARTHEST from the nearest existing instance of that
  // variant — the "fewest jobs" rule only breaks ties between equally-spread
  // candidates now, instead of being the primary sort key.
  const sorted = [...jobs].sort((a, b) => b.width * b.depth - a.width * a.depth)
  const placed: PlacedBuilding[] = []
  const variantBlockCenters = new Map<string, Point[]>()

  for (const job of sorted) {
    const usedCenters = variantBlockCenters.get(job.variant) ?? []

    const eligible = blocks
      .filter((b) => b.jobCount < MAX_BUILDINGS_PER_BLOCK && job.width <= b.usableWidth && job.depth <= b.usableDepth)
      .map((block) => {
        const center = rectCenter(block.rect)
        const minDistToSameVariant = usedCenters.length === 0
          ? Infinity
          : Math.min(...usedCenters.map((c) => Math.hypot(c.x - center.x, c.z - center.z)))
        return { block, center, minDistToSameVariant }
      })
      .sort((a, b) => {
        if (a.minDistToSameVariant !== b.minDistToSameVariant) return b.minDistToSameVariant - a.minDistToSameVariant
        return a.block.jobCount - b.block.jobCount
      })

    let result: PlacedBuilding | null = null
    let chosenCenter: Point | null = null
    for (const candidate of eligible) {
      result = tryShelfPlace(candidate.block, job)
      if (result) { chosenCenter = candidate.center; break }
    }

    if (!result || !chosenCenter) {
      throw new Error(
        `No block could fit ${job.buildingId} (${job.width}x${job.depth}) — ` +
        `${eligible.length} block(s) were dimensionally eligible but none had shelf room left`
      )
    }
    placed.push(result)
    usedCenters.push(chosenCenter)
    variantBlockCenters.set(job.variant, usedCenters)
  }

  return placed
}

function verifyNoOverlaps(placed: PlacedBuilding[]): void {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (overlaps(placed[i], placed[j].x, placed[j].z, placed[j].width, placed[j].depth)) {
        const a = placed[i], b = placed[j]
        throw new Error(
          `Overlap: ${a.buildingId} (${a.width}x${a.depth} @ ${a.x},${a.z}) and ` +
          `${b.buildingId} (${b.width}x${b.depth} @ ${b.x},${b.z})`
        )
      }
    }
    if (overlapsAnyZone(placed[i].x, placed[i].z, placed[i].width, placed[i].depth)) {
      throw new Error(`Building ${placed[i].buildingId} overlaps a reserved zone`)
    }
  }
}

const ZONE_BUFFER_SQ_UNITS_PER_TREE = 100

// Every leaf that overlaps a reserved zone is excluded from both the
// buildable pool AND road generation (see buildableLeaves/leavesToRoads) —
// which leaves it as bare, undecorated ground everywhere outside the zone's
// own circle (its own radius is usually smaller than the leaf it sits in).
// User feedback (2026-08-11, screenshot with hand-drawn marks): those gaps
// read as genuinely empty. Scatters trees into that leftover space, same
// technique as generateParkTreesInTiles but over the leaf's rectangle and
// skipping points inside any zone's own circle (+3 margin) so trees don't
// crowd the park/lake edge.
// Matches DevCityPreview.tsx's CHURCH_POSITION — that building is hand-placed
// outside this script entirely (see its own comment for why), but this
// script still needs to know roughly where it sits so zone-buffer trees don't
// crowd it. Keep these two values in sync if the church ever moves.
const CHURCH_POSITION: Point = { x: 0, z: 165 }
const CHURCH_TREE_CLEARANCE = 24

// True for the one leaf the hand-placed church sits in — excluded from
// generateZoneBufferTrees entirely (2026-08-12, user reference image with a
// hand-drawn rectangle around the church's block: remove every tree in that
// block except the ones lining its roads). Road trees are untouched — they
// come from generateRoadTrees over the real road segments bordering this
// leaf, a completely separate generator this function never feeds into.
function leafContainsChurch(r: Rect): boolean {
  return CHURCH_POSITION.x >= r.x0 && CHURCH_POSITION.x <= r.x1 &&
         CHURCH_POSITION.z >= r.z0 && CHURCH_POSITION.z <= r.z1
}

function generateZoneBufferTrees(rng: RNG, keptLeaves: Rect[]): Point[] {
  const trees: Point[] = []
  const bufferLeaves = keptLeaves.filter((r) => rectIntersectsAnyZone(r) && !leafContainsChurch(r))
  for (const rect of bufferLeaves) {
    const x0 = rect.x0 + 2, x1 = rect.x1 - 2
    const z0 = rect.z0 + 2, z1 = rect.z1 - 2
    const width = x1 - x0, depth = z1 - z0
    if (width <= 0 || depth <= 0) continue
    const count = Math.round((width * depth) / ZONE_BUFFER_SQ_UNITS_PER_TREE)
    for (let i = 0; i < count; i++) {
      const x = x0 + rng.next() * width
      const z = z0 + rng.next() * depth
      const insideAZone = RESERVED_ZONES.some((zone) => {
        const dx = zone.x - x, dz = zone.z - z
        const clearance = zone.radius + 3
        return dx * dx + dz * dz < clearance * clearance
      })
      if (insideAZone) continue
      const dx = CHURCH_POSITION.x - x, dz = CHURCH_POSITION.z - z
      if (dx * dx + dz * dz < CHURCH_TREE_CLEARANCE * CHURCH_TREE_CLEARANCE) continue
      trees.push({ x: Math.round(x), z: Math.round(z) })
    }
  }
  return trees
}

// Walks each (straight) road segment, dropping a pair of trees every
// TREE_SPACING units, skipping the first/last TREE_MARGIN so trees don't
// crowd an intersection.
function generateRoadTrees(roads: RoadSegment[]): Point[] {
  const trees: Point[] = []
  for (const seg of roads) {
    const dx = seg.x2 - seg.x1, dz = seg.z2 - seg.z1
    const length = Math.hypot(dx, dz)
    if (length <= TREE_MARGIN * 2) continue
    const ux = dx / length, uz = dz / length
    const px = -uz, pz = ux

    for (let t = TREE_MARGIN; t <= length - TREE_MARGIN; t += TREE_SPACING) {
      const cx = seg.x1 + ux * t, cz = seg.z1 + uz * t
      trees.push({ x: Math.round(cx + px * TREE_OFFSET), z: Math.round(cz + pz * TREE_OFFSET) })
      trees.push({ x: Math.round(cx - px * TREE_OFFSET), z: Math.round(cz - pz * TREE_OFFSET) })
    }
  }
  return trees
}

// ── Block-interior filler decor ──────────────────────────────────────────
// Fills the leftover space blockLeftoverRect finds (above a block's last
// packed shelf row) with bushes/lamp posts/benches/plazas — purely additive,
// never touches building positions. User's explicit request (2026-08-11):
// more trees & bushes, street lamps, benches, small plazas/courtyards.

interface OrientedPoint extends Point { angle: number }

const MIN_BUSH_AREA = 40
const SQ_UNITS_PER_BUSH = 60
const MAX_BUSHES_PER_BLOCK = 8

// Uniform scatter inside each block's leftover rect — same idea as
// generateParkTrees, just over a rectangle instead of a disc.
function generateBushes(rng: RNG, blocks: BlockState[]): Point[] {
  const bushes: Point[] = []
  for (const block of blocks) {
    const rect = blockLeftoverRect(block)
    if (!rect) continue
    const width = rect.x1 - rect.x0, depth = rect.z1 - rect.z0
    const area = width * depth
    if (area < MIN_BUSH_AREA) continue
    const count = Math.min(MAX_BUSHES_PER_BLOCK, Math.round(area / SQ_UNITS_PER_BUSH))
    for (let i = 0; i < count; i++) {
      bushes.push({
        x: Math.round(rect.x0 + rng.next() * width),
        z: Math.round(rect.z0 + rng.next() * depth),
      })
    }
  }
  return bushes
}

const LAMP_SPACING = 15

// One row of lamp posts along the leftover rect's long axis — reads as
// "lighting the open strip" rather than randomly strewn. Skips rects too
// short to space even one interval of lamps along.
function generateLampPosts(rng: RNG, blocks: BlockState[]): OrientedPoint[] {
  const lamps: OrientedPoint[] = []
  for (const block of blocks) {
    const rect = blockLeftoverRect(block)
    if (!rect) continue
    const width = rect.x1 - rect.x0, depth = rect.z1 - rect.z0
    const alongX = width >= depth
    const long = alongX ? width : depth
    if (long < LAMP_SPACING) continue
    const cross = alongX ? rect.z0 + depth / 2 : rect.x0 + width / 2
    for (let t = LAMP_SPACING / 2; t < long; t += LAMP_SPACING) {
      const point = alongX ? { x: rect.x0 + t, z: cross } : { x: cross, z: rect.z0 + t }
      lamps.push({ x: Math.round(point.x), z: Math.round(point.z), angle: rng.next() * Math.PI * 2 })
    }
  }
  return lamps
}

const MIN_BENCH_AREA = 30
const MAX_BENCHES_PER_BLOCK = 2

// Up to MAX_BENCHES_PER_BLOCK per qualifying leftover rect, facing toward the
// block's own center (toward its buildings) so they read as intentionally
// placed rather than randomly oriented.
function generateBenches(rng: RNG, blocks: BlockState[]): OrientedPoint[] {
  const benches: OrientedPoint[] = []
  for (const block of blocks) {
    const rect = blockLeftoverRect(block)
    if (!rect) continue
    const width = rect.x1 - rect.x0, depth = rect.z1 - rect.z0
    if (width * depth < MIN_BENCH_AREA) continue
    const center = rectCenter(block.rect)
    const count = Math.min(MAX_BENCHES_PER_BLOCK, 1 + Math.floor(rng.next() * MAX_BENCHES_PER_BLOCK))
    for (let i = 0; i < count; i++) {
      const x = rect.x0 + rng.next() * width
      const z = rect.z0 + rng.next() * depth
      benches.push({ x: Math.round(x), z: Math.round(z), angle: Math.atan2(center.x - x, center.z - z) })
    }
  }
  return benches
}

const MIN_PLAZA_AREA = 900
const MAX_PLAZAS = 6

// Only the largest, most genuinely-open leftover rects become plazas — kept
// rare (capped, like RESERVED_ZONES) so they read as deliberate gathering
// spaces rather than filler repeated on every block.
function generatePlazas(blocks: BlockState[]): (Point & { id: string; radius: number })[] {
  const candidates = blocks
    .filter((b) => b.jobCount > 0)
    .map((block) => ({ block, rect: blockLeftoverRect(block) }))
    .filter((c): c is { block: BlockState; rect: Rect } => c.rect !== null)
    .map((c) => ({ ...c, area: (c.rect.x1 - c.rect.x0) * (c.rect.z1 - c.rect.z0) }))
    .filter((c) => c.area >= MIN_PLAZA_AREA)
    .sort((a, b) => b.area - a.area)
    .slice(0, MAX_PLAZAS)

  return candidates.map(({ rect }, i) => {
    const width = rect.x1 - rect.x0, depth = rect.z1 - rect.z0
    return {
      id: `plaza_${i}`,
      x: Math.round(rect.x0 + width / 2),
      z: Math.round(rect.z0 + depth / 2),
      radius: Math.round((Math.min(width, depth) / 2) * 0.8),
    }
  })
}

interface Circle { x: number; z: number; radius: number }

// Scatter trees across a park's own tile union instead of a disc — matches
// the park's actual (now block-shaped, not circular) silhouette so trees
// never land outside the visible green area. `avoid` optionally keeps trees
// clear of any lake zone sharing one of the same tiles.
function generateParkTreesInTiles(rng: RNG, tiles: Rect[], avoid: Circle[] = []): Point[] {
  const trees: Point[] = []
  const SQ_UNITS_PER_TREE = 150
  for (const rect of tiles) {
    const width = rect.x1 - rect.x0, depth = rect.z1 - rect.z0
    const count = Math.max(2, Math.round((width * depth) / SQ_UNITS_PER_TREE))
    for (let i = 0; i < count; i++) {
      const x = rect.x0 + rng.next() * width
      const z = rect.z0 + rng.next() * depth
      const blocked = avoid.some((a) => {
        const dx = a.x - x, dz = a.z - z, clearance = a.radius + 3
        return dx * dx + dz * dz < clearance * clearance
      })
      if (blocked) continue
      trees.push({ x: Math.round(x), z: Math.round(z) })
    }
  }
  return trees
}

// A handful of benches scattered across a park's tiles (rejection-sampled,
// avoiding any lake zone sharing the same tiles), facing the park's overall
// center so they read as "gathered around the green" rather than randomly
// oriented. Bench count scales gently with the park's total tile area.
function generateParkBenches(rng: RNG, tiles: Rect[], avoid: Circle[]): OrientedPoint[] {
  const benches: OrientedPoint[] = []
  if (tiles.length === 0) return benches
  const totalArea = tiles.reduce((s, t) => s + (t.x1 - t.x0) * (t.z1 - t.z0), 0)
  const targetCount = Math.max(4, Math.min(8, Math.round(totalArea / 400)))
  const center = {
    x: tiles.reduce((s, t) => s + (t.x0 + t.x1) / 2, 0) / tiles.length,
    z: tiles.reduce((s, t) => s + (t.z0 + t.z1) / 2, 0) / tiles.length,
  }

  let attempts = 0
  while (benches.length < targetCount && attempts < targetCount * 25) {
    attempts++
    const tile = tiles[Math.floor(rng.next() * tiles.length)]
    const x = tile.x0 + rng.next() * (tile.x1 - tile.x0)
    const z = tile.z0 + rng.next() * (tile.z1 - tile.z0)
    const blocked = avoid.some((a) => {
      const dx = a.x - x, dz = a.z - z, clearance = a.radius + 3
      return dx * dx + dz * dz < clearance * clearance
    })
    if (blocked) continue
    benches.push({ x: Math.round(x), z: Math.round(z), angle: Math.atan2(center.x - x, center.z - z) })
  }
  return benches
}

// ── Run ───────────────────────────────────────────────────────────────────

const rng = new RNG(SEED)

const leaves = bspSplit({ x0: -ROOT_HALF_SIZE, z0: -ROOT_HALF_SIZE, x1: ROOT_HALF_SIZE, z1: ROOT_HALF_SIZE }, rng)
const keptLeaves = leaves.filter(keepBlock)
const roadSegments = leavesToRoads(leaves)
// Blocks a park/lake zone eats into are excluded from the buildable pool
// entirely — that space belongs to the zone, not shelf-packed around it.
const buildableLeaves = keptLeaves.filter((r) => !rectIntersectsAnyZone(r))

// ── Park + lake shapes (see RESERVED_ZONES / parkTilesFor doc comments) ─────

const parkZones = RESERVED_ZONES.filter((z) => z.kind === "park")
const lakeZones = RESERVED_ZONES.filter((z) => z.kind === "lake")

const parkTilesById = new Map<string, Rect[]>()
for (const zone of parkZones) parkTilesById.set(zone.id, parkTilesFor(zone, keptLeaves))

// Inset every park tile away from the roads running along its BSP leaf edges
// (see insetParkTiles's doc comment) — rendering-only, computed after the
// tile SETS above are finalized so the shared-edge detection sees the full
// (including park_north's extra leaf) picture.
for (const [id, tiles] of parkTilesById) parkTilesById.set(id, insetParkTiles(tiles, keptLeaves))

// Keep the church clear of park_north's rendered polygon (2026-08-12, user
// reference images with hand-drawn annotations, iterated three times same
// day). park_north's flood-fill (parkTilesFor) picked up the BSP leaf the
// hand-placed church sits in — and the leaf chained on past it further east
// — since all of that was already zone-excluded territory (over-claimed by
// park_north's circle, same permissive rectIntersectsAnyZone pattern noted
// throughout this file), even though the church itself sits well outside
// park_north's actual circle. First two passes tried clipping/dropping the
// wrong side of the church; user's final call: restore the original west
// cluster exactly as it was and drop the whole east extension (the leaves
// past the church) instead. The two clusters share one exact BSP leaf
// boundary (x ≈ -26.64, where the west cluster's easternmost tiles border
// the leaf the east extension continues from) — keeping only tiles fully
// west of that boundary removes the entire east extension (church's leaf
// included) with no partial clipping needed, and leaves the west cluster
// byte-for-byte untouched (it was never west of any cut to begin with).
// Purely a rendering choice either way — every tile here stays
// zone-excluded from buildings/roads regardless (unaffected).
const PARK_NORTH_WEST_CLUSTER_MAX_X = -26
function dropParkNorthEastExtension(tiles: Rect[]): Rect[] {
  return tiles.filter((t) => Math.max(t.x0, t.x1) <= PARK_NORTH_WEST_CLUSTER_MAX_X)
}
parkTilesById.set("park_north", dropParkNorthEastExtension(parkTilesById.get("park_north")!))

// Lake visual size/position (2026-08-11 follow-up: "make the lake slightly
// bigger and slightly closer to the center of the park") is intentionally
// decoupled from its RESERVED_ZONES radius/position — bumping the zone's
// real radius would exclude different BSP tiles and shift buildings, which
// the user explicitly asked not to touch. Overriding only the rendered blob,
// nudged toward its own containing tile's centroid, stays entirely inside
// already-excluded park territory (no building/road ever placed there) so
// it's a purely visual change. Only central_lake gets an override; lake_east
// renders at its literal zone size/position, unchanged.
const LAKE_VISUAL_OVERRIDES: Record<string, { radius: number; center: Point }> = {
  central_lake: { radius: 22, center: { x: 20, z: 1 } },
}

// Same visual-vs-zone split as LAKE_VISUAL_OVERRIDES — anything that needs to
// avoid overlapping a lake (park benches, park trees) should avoid where the
// lake is actually RENDERED, not its smaller/differently-positioned real
// RESERVED_ZONES circle.
function visualLakeCircle(zone: ReservedZone): Circle {
  const override = LAKE_VISUAL_OVERRIDES[zone.id]
  return override ? { x: override.center.x, z: override.center.z, radius: override.radius } : { x: zone.x, z: zone.z, radius: zone.radius }
}

const lakeShapes = lakeZones.map((zone) => {
  const override = LAKE_VISUAL_OVERRIDES[zone.id]
  const cx = override?.center.x ?? zone.x
  const cz = override?.center.z ?? zone.z
  const radius = override?.radius ?? zone.radius
  return {
    id: zone.id,
    points: sampleBlobPolygon(new RNG(SEED + 8 + zone.id.length), cx, cz, radius),
  }
})

console.log(`Parks: ${parkZones.map((z) => `${z.id}=${parkTilesById.get(z.id)?.length ?? 0} tiles`).join(", ")}`)
console.log(`Lakes: ${lakeZones.map((z) => `${z.id} r${z.radius}`).join(", ")}`)

// A handful of benches per park (user request, 2026-08-11), avoiding any lake
// zone paired into this park's tile footprint (zonesAreAdjacent) so benches
// never land inside the water.
const parkBenches = parkZones.flatMap((zone) => {
  const tiles = parkTilesById.get(zone.id) ?? []
  const pairedLakes = lakeZones.filter((lake) => zonesAreAdjacent(zone, lake)).map(visualLakeCircle)
  return generateParkBenches(new RNG(SEED + 9 + zone.id.length), tiles, pairedLakes)
})

console.log(`Park benches: ${parkBenches.length}`)

const blocks: BlockState[] = buildableLeaves.map((rect) => ({
  rect,
  usableWidth: rect.x1 - rect.x0 - PLACEMENT_GAP,
  usableDepth: rect.z1 - rect.z0 - PLACEMENT_GAP,
  jobCount: 0,
  cursorX: rect.x0 + PLACEMENT_GAP / 2,
  rowZ: rect.z0 + PLACEMENT_GAP / 2,
  rowDepth: 0,
}))

console.log(`BSP: ${leaves.length} leaves, ${keptLeaves.length} kept (within radius ${CITY_RADIUS}), ` +
  `${buildableLeaves.length} buildable (${keptLeaves.length - buildableLeaves.length} excluded — park/lake overlap), ` +
  `${roadSegments.length} road segments`)

const jobs = buildInterleavedJobs(rng)
const placed: PlacedBuilding[] = assignAndPlace(jobs, blocks)

const blockSizes = blocks.map((b) => b.jobCount).sort((a, b) => a - b)
console.log(`Buildings per block: min ${blockSizes[0]}, max ${blockSizes[blockSizes.length - 1]}, ` +
  `median ${blockSizes[Math.floor(blockSizes.length / 2)]}`)

const bushes = generateBushes(new RNG(SEED + 2), blocks)
const lampPosts = generateLampPosts(new RNG(SEED + 3), blocks)
const benches = generateBenches(new RNG(SEED + 4), blocks)
const plazas = generatePlazas(blocks)
console.log(`Furniture: ${bushes.length} bushes, ${lampPosts.length} lamp posts, ` +
  `${benches.length} benches, ${plazas.length} plazas`)

verifyNoOverlaps(placed)

const totalCount = placed.length
const expectedCount = BUILDING_SPECS.reduce((sum, s) => sum + s.count, 0)
if (totalCount !== expectedCount) {
  throw new Error(`Expected ${expectedCount} buildings, placed ${totalCount}`)
}

let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
for (const p of placed) {
  minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
  minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
}
console.log(`Placed ${totalCount} buildings, no overlaps with each other or reserved zones.`)
console.log(`Extent: x [${minX}, ${maxX}], z [${minZ}, ${maxZ}]`)

const outEntries = placed.map(({ buildingId, variant, category, totalBlocks, x, z }) => ({
  buildingId, variant, category, totalBlocks, x, z,
}))

const layoutOutput = `/**
 * Static building layout — 158 buildings placed inside a recursively
 * subdivided block grid (see src/scripts/generateCityLayout.ts's "road
 * revision #2" doc comment for why). Position is a fixed design decision,
 * not runtime state — regenerate only if the layout design itself is being
 * revisited.
 */

export type BuildingCategory = "residential" | "hospital" | "food" | "school";

export interface CityLayoutEntry {
  /** Stable key: \`\${variant}_\${i}\`, i 0-indexed within variant — matches
   *  server/src/scripts/seed.ts's (variant, order_index) natural key. */
  buildingId: string;
  variant: string;
  category: BuildingCategory;
  totalBlocks: number;
  x: number;
  z: number;
}

export const CITY_LAYOUT: CityLayoutEntry[] = ${JSON.stringify(outEntries, null, 2)};
`

const layoutPath = join(process.cwd(), "src/data/cityLayout.ts")
writeFileSync(layoutPath, layoutOutput)
console.log(`Wrote ${layoutPath}`)

// ── Decor: parks, lakes, park-interior trees ─────────────────────────────

const zoneBufferTrees = generateZoneBufferTrees(new RNG(SEED + 6), keptLeaves)
const parkTreesFromTiles = parkZones.flatMap((zone) => {
  const tiles = parkTilesById.get(zone.id) ?? []
  const pairedLakes = lakeZones.filter((lake) => zonesAreAdjacent(zone, lake)).map(visualLakeCircle)
  return generateParkTreesInTiles(new RNG(SEED + 1 + zone.id.length), tiles, pairedLakes)
})
const parkTrees = [...parkTreesFromTiles, ...zoneBufferTrees]
console.log(`Parks: ${parkZones.length}, lakes: ${lakeShapes.length}, park trees: ${parkTrees.length} ` +
  `(${zoneBufferTrees.length} filling zone-buffer gaps)`)

const parkShapesOut = parkZones.map((zone) => ({
  id: zone.id,
  tiles: (parkTilesById.get(zone.id) ?? []).map(({ x0, z0, x1, z1 }) => ({ x0, z0, x1, z1 })),
}))

const decorOutput = `/**
 * Static environment decor: parks + lakes + block-interior bushes (roads
 * live in cityRoads.ts, other street furniture in cityFurniture.ts).
 * Generated by src/scripts/generateCityLayout.ts alongside cityLayout.ts,
 * same "fixed design decision, not runtime state" treatment.
 *
 * Parks/lakes shape overhaul (2026-08-11, user request + reference image):
 * parks are no longer discs — each is the union of the BSP block tiles its
 * RESERVED_ZONES circle (or a paired lake's circle, see zonesAreAdjacent)
 * overlaps (parkTilesFor in generateCityLayout.ts), so a park's rendered
 * silhouette follows the block grid like the user's reference. Lakes are
 * organic blobs (sampleBlobPolygon: a circle perturbed by two sine waves of
 * different frequency/phase), not circles either. central_lake and
 * central_park are independent RESERVED_ZONES entries (not a derived/nested
 * pair — an earlier version tried that and over-excluded a block of
 * buildings, see plans/qr-backend-todo.md), positioned close enough that
 * parkTilesFor pulls the lake's tiles into central_park's rendered polygon,
 * matching the reference image's lake-inside-park framing without needing
 * the lake's own position to be derived from anything.
 */

export interface ParkShape {
  id: string;
  tiles: { x0: number; z0: number; x1: number; z1: number }[];
}

export interface LakeShape {
  id: string;
  points: { x: number; z: number }[];
}

export interface TreeMarker {
  x: number;
  z: number;
}

export const PARKS: ParkShape[] = ${JSON.stringify(parkShapesOut, null, 2)};

export const LAKES: LakeShape[] = ${JSON.stringify(lakeShapes, null, 2)};

export const PARK_TREES: TreeMarker[] = ${JSON.stringify(parkTrees, null, 2)};

export const BUSHES: TreeMarker[] = ${JSON.stringify(bushes, null, 2)};
`

const decorPath = join(process.cwd(), "src/data/cityDecor.ts")
writeFileSync(decorPath, decorOutput)
console.log(`Wrote ${decorPath}`)

// ── Roads: block-grid edges (see module doc comment) ────────────────────

const roadTrees = generateRoadTrees(roadSegments)
console.log(`Roads: ${roadSegments.length} segments, ${roadTrees.length} roadside trees`)

const roadsOutput = `/**
 * Static road network: every edge of every kept BSP block (see
 * src/scripts/generateCityLayout.ts's "road revision #2" doc comment) plus
 * roadside trees. Generated by src/scripts/generateCityLayout.ts. Position is
 * a fixed design decision, not runtime state.
 */

export interface RoadSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface TreeMarker {
  x: number;
  z: number;
}

export const ROAD_WIDTH = ${ROAD_WIDTH};

export const ROADS: RoadSegment[] = ${JSON.stringify(roadSegments, null, 2)};

export const ROAD_TREES: TreeMarker[] = ${JSON.stringify(roadTrees, null, 2)};
`

const roadsPath = join(process.cwd(), "src/data/cityRoads.ts")
writeFileSync(roadsPath, roadsOutput)
console.log(`Wrote ${roadsPath}`)

// ── Street furniture: lamp posts, benches, plazas (see the block-interior
// filler decor section above) ────────────────────────────────────────────

const allBenches = [...benches, ...parkBenches]

const furnitureOutput = `/**
 * Static street furniture: lamp posts, benches, plazas/courtyards — scattered
 * into each block's leftover shelf-packing space (blockLeftoverRect in
 * src/scripts/generateCityLayout.ts) plus a handful of benches per park (user
 * request, 2026-08-11). Bushes/trees live in cityDecor.ts instead (foliage,
 * not architecture). Generated by src/scripts/generateCityLayout.ts, same
 * "fixed design decision, not runtime state" treatment.
 *
 * No fountains (2026-08-11 follow-up) — added, then removed at the user's
 * request in the same park/lake follow-up round.
 */

export interface OrientedMarker {
  x: number;
  z: number;
  angle: number;
}

export interface DecorZone {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export const LAMP_POSTS: OrientedMarker[] = ${JSON.stringify(lampPosts, null, 2)};

export const BENCHES: OrientedMarker[] = ${JSON.stringify(allBenches, null, 2)};

export const PLAZAS: DecorZone[] = ${JSON.stringify(plazas, null, 2)};
`

const furniturePath = join(process.cwd(), "src/data/cityFurniture.ts")
writeFileSync(furniturePath, furnitureOutput)
console.log(`Wrote ${furniturePath}`)
