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
import { SimplexNoise } from "three/addons/math/SimplexNoise.js"

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
        // Effective inset boundary lines, computed straight from the tile's
        // own true edges — NOT "does this band's raw edge exactly match the
        // tile's original corner." A mismatched neighbor on an unrelated
        // side (e.g. classifyEdgeIntervals's z0/z1 pass, for this tile's
        // south edge) can introduce an extra x-cut a fraction of a unit
        // inside the true x0 boundary, splitting the west edge into two
        // bands; only the first ever touched the literal original x0, so
        // the second silently skipped its inset entirely and rendered at
        // the raw, un-inset boundary — on top of the road it was supposed
        // to clear (2026-08-12, user-spotted overlap, still present after
        // the first fix here only dropped the degenerate first band).
        // Clipping every band against the same effective line — regardless
        // of how many internal cut points fragment the true edge — fixes
        // both that and the original reversed-rect case in one pass: a
        // band entirely inside the inset margin now clips to nothing
        // (dropped below) instead of either overshooting or being skipped.
        const effX0 = tile.x0 + (insetAt(x0c, midZ) ? PARK_ROAD_INSET : 0)
        const effX1 = tile.x1 - (insetAt(x1c, midZ) ? PARK_ROAD_INSET : 0)
        const effZ0 = tile.z0 + (insetAt(z0c, midX) ? PARK_ROAD_INSET : 0)
        const effZ1 = tile.z1 - (insetAt(z1c, midX) ? PARK_ROAD_INSET : 0)
        const rx0 = Math.max(px0, effX0)
        const rx1 = Math.min(px1, effX1)
        const rz0 = Math.max(pz0, effZ0)
        const rz1 = Math.min(pz1, effZ1)
        if (rx1 <= rx0 || rz1 <= rz0) continue
        result.push({ x0: rx0, x1: rx1, z0: rz0, z1: rz1 })
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

// Same wobbly-outline idea as sampleBlobPolygon, but elliptical (independent
// x/z radii) and rotated — for a lake meant to read as an elongated, angled
// shape filling most of a rectangular block (2026-08-12, user reference
// image) rather than a wobbly circle. Wobble amplitude is toned down from
// sampleBlobPolygon's (18%/10% vs 22%/12%) since the ellipse+rotation
// combination already has less margin to the block's edges to work with —
// see the lake_east sizing comment below for the worst-case-extent math this
// assumes.
function sampleEllipticalBlob(
  rng: RNG, cx: number, cz: number, radiusX: number, radiusZ: number, rotation: number, segments = 24
): Point[] {
  const freq1 = 2 + Math.floor(rng.next() * 2)
  const freq2 = 5 + Math.floor(rng.next() * 3)
  const phase1 = rng.next() * Math.PI * 2
  const phase2 = rng.next() * Math.PI * 2
  const cos = Math.cos(rotation), sin = Math.sin(rotation)
  const points: Point[] = []
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const wobble = 1 + 0.18 * Math.sin(freq1 * theta + phase1) + 0.10 * Math.sin(freq2 * theta + phase2)
    const ex = radiusX * wobble * Math.cos(theta)
    const ez = radiusZ * wobble * Math.sin(theta)
    const rx = ex * cos - ez * sin
    const rz = ex * sin + ez * cos
    points.push({ x: Math.round((cx + rx) * 10) / 10, z: Math.round((cz + rz) * 10) / 10 })
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

// True when `point` falls inside leaf `r` — used to find the one BSP leaf a
// given hand-placed landmark or lake sits in, so its interior can be
// excluded from generateZoneBufferTrees below (2026-08-12: first for the
// church's own leaf — user reference image with a hand-drawn rectangle
// around its block, wanting every tree gone except the ones lining its
// roads — then the same treatment for lake_east's leaf). Road trees are
// untouched either way — they come from generateRoadTrees over the real
// road segments bordering a leaf, a completely separate generator this
// function never feeds into.
function leafContainsPoint(r: Rect, point: Point): boolean {
  return point.x >= r.x0 && point.x <= r.x1 && point.z >= r.z0 && point.z <= r.z1
}

function generateZoneBufferTrees(rng: RNG, keptLeaves: Rect[], excludeLeaves: Rect[]): Point[] {
  const trees: Point[] = []
  const bufferLeaves = keptLeaves.filter((r) => rectIntersectsAnyZone(r) && !excludeLeaves.includes(r))
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

// User request (2026-08-12, reference image of the church's block): a street
// lamp "between every two" of the road trees lining that block, on top of
// the block-interior lamps generateLampPosts already places elsewhere —
// later reused the same way for lake_east's block. A zone-excluded leaf
// (see leafContainsPoint) contributes none of its own road edges — every
// real road bordering it comes entirely from its non-excluded neighbors.
// Rather than re-deriving that adjacency, this walks the real,
// already-computed road segments and keeps only the ones lying exactly on
// the leaf's own boundary.
const LEAF_LAMP_GROUP_SIZE = 2

function segmentBordersLeaf(seg: RoadSegment, leaf: Rect): boolean {
  const EPS = 1
  const vertical = Math.abs(seg.x1 - seg.x2) < EPS
  const horizontal = Math.abs(seg.z1 - seg.z2) < EPS
  if (vertical && (Math.abs(seg.x1 - leaf.x0) < EPS || Math.abs(seg.x1 - leaf.x1) < EPS)) {
    const lo = Math.min(seg.z1, seg.z2), hi = Math.max(seg.z1, seg.z2)
    return lo < leaf.z1 - EPS && hi > leaf.z0 + EPS
  }
  if (horizontal && (Math.abs(seg.z1 - leaf.z0) < EPS || Math.abs(seg.z1 - leaf.z1) < EPS)) {
    const lo = Math.min(seg.x1, seg.x2), hi = Math.max(seg.x1, seg.x2)
    return lo < leaf.x1 - EPS && hi > leaf.x0 + EPS
  }
  return false
}

// Same walk-the-segment-at-TREE_SPACING-intervals technique as
// generateRoadTrees, but emits a lamp only every CHURCH_LAMP_GROUP_SIDE-th
// interval (in the gap after that many trees), on whichever side of the road
// faces into the leaf, and clipped to the leaf's own span (a shared segment
// can run past the leaf's corner into a wider neighbor's edge).
function generateLeafBorderLamps(leaf: Rect, roadSegments: RoadSegment[]): OrientedPoint[] {
  const lamps: OrientedPoint[] = []
  const center = { x: (leaf.x0 + leaf.x1) / 2, z: (leaf.z0 + leaf.z1) / 2 }
  for (const seg of roadSegments) {
    if (!segmentBordersLeaf(seg, leaf)) continue
    const dx = seg.x2 - seg.x1, dz = seg.z2 - seg.z1
    const length = Math.hypot(dx, dz)
    if (length <= TREE_MARGIN * 2) continue
    const ux = dx / length, uz = dz / length
    let px = -uz, pz = ux
    const midX = seg.x1 + ux * length / 2, midZ = seg.z1 + uz * length / 2
    if ((center.x - midX) * px + (center.z - midZ) * pz < 0) { px = -px; pz = -pz }

    let i = 0
    for (let t = TREE_MARGIN; t <= length - TREE_MARGIN; t += TREE_SPACING, i++) {
      if (i % LEAF_LAMP_GROUP_SIZE !== LEAF_LAMP_GROUP_SIZE - 1) continue
      const tMid = Math.min(t + TREE_SPACING / 2, length - TREE_MARGIN)
      const cx = seg.x1 + ux * tMid, cz = seg.z1 + uz * tMid
      if (cx < leaf.x0 - 1 || cx > leaf.x1 + 1 || cz < leaf.z0 - 1 || cz > leaf.z1 + 1) continue
      lamps.push({
        x: Math.round(cx + px * TREE_OFFSET),
        z: Math.round(cz + pz * TREE_OFFSET),
        angle: Math.atan2(-px, -pz),
      })
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
// it's a purely visual change.
const LAKE_VISUAL_OVERRIDES: Record<string, { radius: number; center: Point }> = {
  central_lake: { radius: 22, center: { x: 20, z: 1 } },
}

// lake_east's own BSP leaf (2026-08-12, user request: center the lake in its
// block and enlarge it, with a sandy "beach" filling the rest of the block
// between the water and each bordering road). Unlike park_north, lake_east's
// leaf is a single simple rectangle — every one of its 4 sides borders a
// real, non-zone-excluded neighbor (confirmed via a debug dump of keptLeaves
// during this session) — so its center/size can be derived directly from the
// leaf's own dimensions instead of hand-picked constants.
//
// Follow-up same day (reference image): a plain circular beach with a
// uniform ring didn't match — user wants the beach to fill the WHOLE
// rectangular block (not just a circle sized to the shorter side), and the
// lake enlarged into a bigger, elongated, ROTATED blob (not a wobbly circle)
// so the beach's visible width varies naturally around it, same as the
// reference. Beach is now a rect (like a park tile) inset from the leaf's
// edges by LAKE_EAST_ROAD_CLEARANCE; the lake uses sampleEllipticalBlob
// (independent x/z radii + a rotation) instead of sampleBlobPolygon.
const lakeEastZone = lakeZones.find((z) => z.id === "lake_east")
const lakeEastLeaf = lakeEastZone ? keptLeaves.find((r) => rectIntersectsZone(r, lakeEastZone)) : undefined
const LAKE_EAST_ROAD_CLEARANCE = 5 // gap between the beach rect's outer edge and the road
// Ellipse radii + rotation picked by hand (design decision, like the rest of
// this file's bespoke numbers), refined over several follow-ups (2026-08-12):
// widened (radiusX 30→34), rotated 24° "toward east" and both radii scaled
// 1.125x (34→38.25, 20→22.5), then rotation tried at 0° instead (user
// preferred it — reads more upright/axis-aligned) and kept. Checked against
// the beach rect's half-extents each time via the ACTUAL generated polygon
// bounds (not just the theoretical worst-case wobble formula, which turned
// out far more pessimistic than what the seeded RNG actually produces) —
// verify the same way (compare LAKES/BEACHES output bounds directly) if
// these numbers change again. Note if rotation is ever reintroduced: the
// wobble's specific seeded bumps land differently depending on rotation
// sign — +24° once pushed a bump past the beach's south edge where -24°
// (same visual tilt) cleared every side, so check both signs, not just one.
const LAKE_EAST_ELLIPSE = { radiusX: 34 * 1.125, radiusZ: 20 * 1.125, rotation: 0 }
// Lake center nudged south (smaller z) of the block's true center — a
// purely visual offset, independent of the beach (which still fills the
// whole block from the leaf's real center) since the two are computed
// separately below. Started at 4, reduced to 2 (user: "move it a tiny bit
// north" of where it was) — still slightly south of dead-center, just less.
const LAKE_EAST_SOUTH_OFFSET = 2
let lakeEastCenter: Point | undefined
let beachRect: Rect | undefined
if (lakeEastLeaf) {
  const blockCenter = {
    x: Math.round((lakeEastLeaf.x0 + lakeEastLeaf.x1) / 2),
    z: Math.round((lakeEastLeaf.z0 + lakeEastLeaf.z1) / 2),
  }
  lakeEastCenter = { x: blockCenter.x, z: blockCenter.z - LAKE_EAST_SOUTH_OFFSET }
  beachRect = {
    x0: lakeEastLeaf.x0 + LAKE_EAST_ROAD_CLEARANCE, x1: lakeEastLeaf.x1 - LAKE_EAST_ROAD_CLEARANCE,
    z0: lakeEastLeaf.z0 + LAKE_EAST_ROAD_CLEARANCE, z1: lakeEastLeaf.z1 - LAKE_EAST_ROAD_CLEARANCE,
  }
  // Kept in LAKE_VISUAL_OVERRIDES too (as a circle, radius = the ellipse's
  // larger axis) purely so visualLakeCircle's existing circular-avoidance
  // callers (park bench/tree placement near a *paired* park) have a
  // reasonable estimate — lake_east is never paired with any park in
  // practice (too far from every RESERVED_ZONES park circle), so this is
  // unused in this run but kept for API consistency.
  LAKE_VISUAL_OVERRIDES.lake_east = { radius: LAKE_EAST_ELLIPSE.radiusX, center: lakeEastCenter }
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
  if (zone.id === "lake_east" && lakeEastCenter) {
    return {
      id: zone.id,
      points: sampleEllipticalBlob(
        new RNG(SEED + 8 + zone.id.length), lakeEastCenter.x, lakeEastCenter.z,
        LAKE_EAST_ELLIPSE.radiusX, LAKE_EAST_ELLIPSE.radiusZ, LAKE_EAST_ELLIPSE.rotation
      ),
    }
  }
  const override = LAKE_VISUAL_OVERRIDES[zone.id]
  const cx = override?.center.x ?? zone.x
  const cz = override?.center.z ?? zone.z
  const radius = override?.radius ?? zone.radius
  return {
    id: zone.id,
    points: sampleBlobPolygon(new RNG(SEED + 8 + zone.id.length), cx, cz, radius),
  }
})

// Beach: a plain rect (like a park tile), filling the block minus road
// clearance, rendered under the lake — the lake's own (smaller, organic)
// shape, drawn on top, naturally covers the middle of it, leaving an evenly
// -uneven ring per the reference image. Light grey placeholder — texture is
// a later pass per the user's own note.
const beachShapes = beachRect ? [{ id: "lake_east", ...beachRect }] : []

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
const churchLeaf = keptLeaves.find((r) => leafContainsPoint(r, CHURCH_POSITION))
const churchLeafLamps = churchLeaf ? generateLeafBorderLamps(churchLeaf, roadSegments) : []
const lakeEastLeafLamps = lakeEastLeaf ? generateLeafBorderLamps(lakeEastLeaf, roadSegments) : []
const lampPosts = [...generateLampPosts(new RNG(SEED + 3), blocks), ...churchLeafLamps, ...lakeEastLeafLamps]
const benches = generateBenches(new RNG(SEED + 4), blocks)
const plazas = generatePlazas(blocks)
console.log(`Furniture: ${bushes.length} bushes, ${lampPosts.length} lamp posts ` +
  `(${churchLeafLamps.length} along the church's block, ${lakeEastLeafLamps.length} along lake_east's), ` +
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

const zoneBufferTrees = generateZoneBufferTrees(
  new RNG(SEED + 6), keptLeaves,
  [churchLeaf, lakeEastLeaf].filter((l): l is Rect => l !== undefined)
)
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

/** A plain rect (like a park tile), filling a lake's block minus road
 *  clearance, rendered under the lake so the lake's own smaller/organic
 *  shape covers its middle, leaving a ring — see the lake_east doc comment
 *  in generateCityLayout.ts (2026-08-12, lake_east only for now). */
export interface BeachShape {
  id: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface TreeMarker {
  x: number;
  z: number;
}

export const PARKS: ParkShape[] = ${JSON.stringify(parkShapesOut, null, 2)};

export const LAKES: LakeShape[] = ${JSON.stringify(lakeShapes, null, 2)};

export const BEACHES: BeachShape[] = ${JSON.stringify(beachShapes, null, 2)};

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

// ── World terrain: grass buffer, rolling hills, distant mountains
// (2026-08-13) ───────────────────────────────────────────────────────────
//
// A first attempt at hiding the ground plane's edge (a ring of tall,
// discrete voxel-cube "mountain" peaks placed close to the city, radius
// 280-390) was built, verified working, then fully reverted — the user
// found it made the city feel "closed off and claustrophobic." This
// redesign fixes that by making everything outside the city (a) start much
// further away, (b) stay low/gentle rather than tall/discrete, and (c) fade
// into atmosphere rather than reading as a nearby wall. See
// plans/qr-backend-todo.md's "mountain ring — tried and reverted" entry for
// the full story.
//
// Measured correction: CITY_RADIUS (280) is only the BSP leaf-CENTER keep
// filter (keepBlock) — real city geometry (building footprints, road-tree
// positions, road segment endpoints) extends further out. Measured directly
// against this run's own generated data (not assumed): road vertices reach
// ~343.6, bushes ~325.7, road trees ~334.6. CITY_EDGE (350) is used as the
// terrain floor instead of CITY_RADIUS for exactly this reason —
// measureCityEnvelope/verifyTerrainClearsCity below re-check this on every
// run so a future BSP/placement tweak can't silently let real geometry
// drift past the terrain's inner edge.
//
// All terrain RNG uses fresh RNG instances seeded off SEED+20 and up —
// NEVER the shared module-level `rng` (which drives building/road
// placement) or any of the SEED+1..9(+zone.id.length) instances already in
// use above. Terrain code must not perturb the existing building/road/decor
// output in any way; verified by an empty git diff on cityLayout.ts/
// cityRoads.ts/cityDecor.ts/cityFurniture.ts after regenerating.

const CITY_EDGE       = 350  // terrain floor — see measured-correction note above
const BUFFER_OUTER    = 640  // grass/park buffer:      CITY_EDGE → BUFFER_OUTER
const HILLS_INNER     = 640
const HILLS_RAMP_IN   = 840  // hill height reaches full weight by here
const HILLS_RAMP_OUT  = 920  // hill height starts fading out from here
const HILLS_OUTER     = 1150 // rolling hills:          HILLS_INNER → HILLS_OUTER
const MOUNTAIN_INNER  = 1350
const MOUNTAIN_OUTER  = 1550 // distant mountains:      MOUNTAIN_INNER → MOUNTAIN_OUTER
const GROUND_RADIUS   = 2000 // ground disc rim (fades to fog color — see decor.ts)

const FOG_NEAR = 800
const FOG_FAR  = 2400

const HILL_CELL   = 12 // world units per column footprint
const HILL_STEP   = 3  // world units per height level
const HILL_LEVELS = 5  // max levels → max height 15 (13:1 width:height per lobe — "rolling", not "peaked")

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// Samples noise along a small circle so the result varies smoothly with
// angle (not radius) — used to perturb the hills band's inner/outer edges
// per-angle so neither reads as a perfect circle ("irregular outer
// boundary" per the user's explicit ask).
function angularJitter(simplex: SimplexNoise, angle: number, amplitude: number): number {
  return simplex.noise(Math.cos(angle) * 3, Math.sin(angle) * 3) * amplitude
}

// 2-octave fractal noise, normalized to roughly [0,1]. The base octave's
// ~220-unit period is the load-bearing number here: it produces hill lobes
// ~200 units wide against a max height of 15 — a ~13:1 width:height ratio,
// which is what "rolling" means geometrically (the rejected ring's discrete
// peaks were close to 1:1).
function fbmHeight(simplex: SimplexNoise, x: number, z: number): number {
  const n1 = simplex.noise(x / 220, z / 220)
  const n2 = simplex.noise(x / 90 + 100, z / 90 + 100)
  return Math.min(1, Math.max(0, ((n1 + 0.35 * n2) / 1.35 + 1) / 2))
}

// Radial envelope (0 outside the band, ~1 in the middle) with per-angle
// jitter on both edges via angularJitter — multiplied into the noise height
// so hill columns fade in/out gradually and the band's edges are ragged,
// not circular.
function hillEnvelope(simplex: SimplexNoise, x: number, z: number): number {
  const r = Math.hypot(x, z)
  const angle = Math.atan2(z, x)
  const innerEdge   = HILLS_INNER    + angularJitter(simplex, angle, 60)
  const rampInEdge  = HILLS_RAMP_IN  + angularJitter(simplex, angle, 60)
  const rampOutEdge = HILLS_RAMP_OUT + angularJitter(simplex, angle + 4.5, 60)
  const outerEdge   = HILLS_OUTER    + angularJitter(simplex, angle + 4.5, 60)
  const rampIn  = smoothstep(innerEdge, rampInEdge, r)
  const rampOut = 1 - smoothstep(rampOutEdge, outerEdge, r)
  return Math.max(0, Math.min(1, rampIn * rampOut))
}

// Quantized column height (0..HILL_LEVELS) at a world position — shared by
// column generation (below) and hill-tree placement (trees snap to this,
// not to the raw continuous noise, so trunks never float/sink on a
// terraced step).
function hillLevelAt(simplex: SimplexNoise, x: number, z: number): number {
  const h   = fbmHeight(simplex, x, z)
  const env = hillEnvelope(simplex, x, z)
  return Math.max(0, Math.min(HILL_LEVELS, Math.floor(h * env * (HILL_LEVELS + 1))))
}

// One flat-topped voxel "column" per grid cell instead of stacked unit
// cubes (like buildings/trees use) — a column is 1 InstancedMesh instance
// with a non-uniform Y-scale, so the whole hills band costs ~11k instances
// instead of ~11k * levels. Output is a FLAT [gx,gz,level, gx,gz,level, ...]
// number array (grid indices, not world coords or objects) rather than the
// {x,z,...} object-per-entry style every other data file in this project
// uses — at this count (~11k entries), pretty-printed objects would be a
// multi-megabyte, tens-of-thousands-of-lines source file; a flat array
// stringified with no indent is ~10x smaller and just as fast to consume in
// decor.ts (which already knows HILL_CELL/HILL_STEP to expand gx/gz/level
// back into world position/height).
function generateHillColumns(simplex: SimplexNoise): number[] {
  const flat: number[] = []
  const maxGrid = Math.ceil((HILLS_OUTER + 60) / HILL_CELL)
  for (let gx = -maxGrid; gx <= maxGrid; gx++) {
    for (let gz = -maxGrid; gz <= maxGrid; gz++) {
      const x = gx * HILL_CELL, z = gz * HILL_CELL
      const r = Math.hypot(x, z)
      if (r < HILLS_INNER - HILL_CELL || r > HILLS_OUTER + HILL_CELL) continue
      const level = hillLevelAt(simplex, x, z)
      if (level === 0) continue
      flat.push(gx, gz, level)
    }
  }
  return flat
}

// Shared rejection-sampler for scattering points across an annulus
// (buffer/hills trees, buffer bushes, meadow centers all use this) — keep
// candidates whose radius falls in [inner,outer], target density controlled
// via sqUnitsPerItem (annulus area / sqUnitsPerItem ≈ item count).
function scatterInAnnulus(rng: RNG, inner: number, outer: number, sqUnitsPerItem: number): Point[] {
  const area = Math.PI * (outer * outer - inner * inner)
  const count = Math.round(area / sqUnitsPerItem)
  const points: Point[] = []
  for (let i = 0; i < count; i++) {
    let x = 0, z = 0, r = 0
    for (let attempt = 0; attempt < 8; attempt++) {
      x = (rng.next() * 2 - 1) * outer
      z = (rng.next() * 2 - 1) * outer
      r = Math.hypot(x, z)
      if (r >= inner && r <= outer) break
    }
    if (r >= inner && r <= outer) {
      points.push({ x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 })
    }
  }
  return points
}

interface HillTree { x: number; y: number; z: number }

// Forest scatter across the hills band — density modulated by a second,
// independent noise field (forestSimplex) so trees form loose groves and
// clearings rather than uniform stipple. Y snaps to the tree's own cell's
// quantized hillLevelAt (not raw continuous noise) — the terrain itself is
// quantized/terraced, so this is what actually sits trunks flush on a step
// instead of floating/burying them by up to HILL_STEP/2.
function generateHillTrees(rng: RNG, simplex: SimplexNoise, forestSimplex: SimplexNoise): HillTree[] {
  const trees: HillTree[] = []
  for (const p of scatterInAnnulus(rng, HILLS_INNER, HILLS_OUTER, 1100)) {
    const level = hillLevelAt(simplex, p.x, p.z)
    if (level === 0) continue
    const density = (forestSimplex.noise(p.x / 160 + 500, p.z / 160 + 500) + 1) / 2
    if (rng.next() > density) continue
    trees.push({ x: p.x, y: level * HILL_STEP, z: p.z })
  }
  return trees
}

// Grass/park buffer scatter (2026-08-13) — deliberately ~25x sparser than a
// real park (ZONE_BUFFER_SQ_UNITS_PER_TREE=100 above) since this is open
// buffer space, not another explicit park. Light density modulation from
// the same forest noise field gives loose copses instead of uniform
// spacing, without needing real park-style logic (generateZoneBufferTrees
// iterates BSP leaves and excludes reserved-zone circles — not reusable
// here, this band has neither).
function generateBufferScatter(
  rng: RNG, forestSimplex: SimplexNoise
): { trees: Point[]; bushes: Point[] } {
  const trees = scatterInAnnulus(rng, CITY_EDGE, BUFFER_OUTER, 2500).filter((p) => {
    const density = (forestSimplex.noise(p.x / 160 + 500, p.z / 160 + 500) + 1) / 2
    return rng.next() < 0.3 + density * 0.7
  })
  const bushes = scatterInAnnulus(rng, CITY_EDGE, BUFFER_OUTER, 3500)
  return { trees, bushes }
}

interface MeadowShape { id: string; points: Point[] }

// A handful of organic color-variation patches across the buffer, reusing
// sampleBlobPolygon (already used for lakes) rather than inventing a new
// shape technique — breaks up what would otherwise be ~290 units of
// perfectly uniform grass.
//
// sampleBlobPolygon's wobble can swing a polygon vertex up to 1.34x the
// requested base radius outward from the meadow's own CENTER — so a
// meadow's center can't just be scattered right up to CITY_EDGE/BUFFER_OUTER
// the way a plain point (tree/bush) can, or the blob's own far edge
// overshoots past the buffer band (caught by verifyTerrainClearsCity the
// first time this ran: a meadow center placed at ~370 produced a polygon
// vertex down at 330.9, inside CITY_EDGE). MEADOW_MAX_RADIUS/WOBBLE below
// bound that overshoot so the center-scatter margin can be computed exactly
// rather than guessed.
const MEADOW_MAX_RADIUS = 70
const MEADOW_MAX_WOBBLE = 1.34 // sampleBlobPolygon: 1 + 0.22 + 0.12, worst case
const MEADOW_MARGIN = Math.ceil(MEADOW_MAX_RADIUS * MEADOW_MAX_WOBBLE) + 5

function generateMeadows(rng: RNG): MeadowShape[] {
  const centers = scatterInAnnulus(rng, CITY_EDGE + MEADOW_MARGIN, BUFFER_OUTER - MEADOW_MARGIN, 25000) // ~10-14 patches
  return centers.map((c, i) => ({
    id: `meadow_${i}`,
    points: sampleBlobPolygon(rng, c.x, c.z, 30 + rng.next() * (MEADOW_MAX_RADIUS - 30), 16),
  }))
}

interface MountainPeakOut { x: number; z: number; cubeSize: number; levels: number; seed: number }

const MOUNTAIN_MIN_GAP_DEG  = 35
const MOUNTAIN_MIN_GAPS     = 3
// 3 mandatory gaps, each 45-70deg, roughly evenly spaced (3 slots of 120deg
// with jitter) — carved out FIRST. Mountain clusters only ever get placed
// in the leftover arcs between them, each further inset by
// MOUNTAIN_CLUSTER_MARGIN_DEG so a cluster's own peak footprints (which
// have real angular width — up to ~5deg per peak at this radius/size) can
// never grow back into a gap. This makes "at least 3 real gaps" true by
// construction, not by hoping a random skip lands right — an earlier
// version relied on randomly skipping ~30% of 9 evenly-spaced cluster slots
// and failed its own verification (1 gap instead of 3, 79% coverage) the
// first time it was run, because peak footprint width wasn't accounted for
// in the spacing math. This version can't have that failure mode: gaps are
// reserved before any cluster/peak geometry is even considered.
const MOUNTAIN_GAP_COUNT        = 3
const MOUNTAIN_GAP_MIN_DEG      = 45
const MOUNTAIN_GAP_MAX_DEG      = 70
const MOUNTAIN_CLUSTER_MARGIN_DEG = 12

// Distant mountain backdrop — same stepped-pyramid cube technique the
// rejected ring used (that part wasn't the problem), but placed ~4x further
// out and generated as sparse clusters with real, guaranteed gaps instead
// of a continuous ring. verifyMountainHorizonGaps below re-derives the
// gaps from the ACTUAL placed peak footprints (not the construction's own
// intent) as a final honest check that nothing drifted during placement.
function generateDistantMountains(rng: RNG): MountainPeakOut[] {
  const TWO_PI = Math.PI * 2
  const toRad = (deg: number) => (deg * Math.PI) / 180

  // 1. Reserve the gaps first.
  const gapSlotArc = TWO_PI / MOUNTAIN_GAP_COUNT
  const gaps = Array.from({ length: MOUNTAIN_GAP_COUNT }, (_, i) => {
    const center = i * gapSlotArc + (rng.next() - 0.5) * gapSlotArc * 0.5
    const width = toRad(MOUNTAIN_GAP_MIN_DEG + rng.next() * (MOUNTAIN_GAP_MAX_DEG - MOUNTAIN_GAP_MIN_DEG))
    return { start: center - width / 2, end: center + width / 2 }
  })
  const normGaps = gaps
    .map((g) => {
      const start = ((g.start % TWO_PI) + TWO_PI) % TWO_PI
      return { start, end: start + (g.end - g.start) }
    })
    .sort((a, b) => a.start - b.start)

  // 2. Whatever's left between the gaps is where clusters may go, each arc
  // shrunk by MOUNTAIN_CLUSTER_MARGIN_DEG on both ends as a safety margin
  // for peak footprint width.
  const margin = toRad(MOUNTAIN_CLUSTER_MARGIN_DEG)
  const allowedArcs: { start: number; end: number }[] = []
  for (let i = 0; i < normGaps.length; i++) {
    const arcStart = normGaps[i].end + margin
    const arcEnd = (i === normGaps.length - 1 ? normGaps[0].start + TWO_PI : normGaps[i + 1].start) - margin
    if (arcEnd > arcStart) allowedArcs.push({ start: arcStart, end: arcEnd })
  }

  // 3. Fill each allowed arc with 1-2 clusters of 3-5 peaks apiece.
  const peaks: MountainPeakOut[] = []
  const clusterSpans: { start: number; end: number }[] = []

  for (const arc of allowedArcs) {
    const arcWidth = arc.end - arc.start
    const clusterCount = arcWidth > toRad(24) ? 2 : 1
    const slotWidth = arcWidth / clusterCount

    for (let c = 0; c < clusterCount; c++) {
      const slotStart = arc.start + c * slotWidth
      const centerAngle = slotStart + slotWidth / 2
      const arcSpan = Math.min(slotWidth * 0.7, toRad(18)) // how far apart this cluster's own peaks spread
      const peakCount = 3 + Math.floor(rng.next() * 3) // 3-5
      let maxHalfAngle = 0

      for (let p = 0; p < peakCount; p++) {
        const t = peakCount === 1 ? 0.5 : p / (peakCount - 1)
        const angle = centerAngle - arcSpan / 2 + t * arcSpan
        const radius = MOUNTAIN_INNER + rng.next() * (MOUNTAIN_OUTER - MOUNTAIN_INNER)
        const cubeSize = 20 + rng.next() * 6 // smaller than the first attempt — kept modest so footprint angle stays predictable
        const levels = 3 + Math.floor(rng.next() * 3)
        const footprintHalf = levels * cubeSize
        maxHalfAngle = Math.max(maxHalfAngle, Math.atan2(footprintHalf, radius))

        peaks.push({
          x: Math.round(Math.cos(angle) * radius * 10) / 10,
          z: Math.round(Math.sin(angle) * radius * 10) / 10,
          cubeSize: Math.round(cubeSize * 10) / 10,
          levels,
          seed: Math.floor(rng.next() * 1e9),
        })
      }

      clusterSpans.push({
        start: centerAngle - arcSpan / 2 - maxHalfAngle,
        end: centerAngle + arcSpan / 2 + maxHalfAngle,
      })
    }
  }

  verifyMountainHorizonGaps(clusterSpans)

  const maxHeight = peaks.reduce((m, p) => Math.max(m, p.levels * p.cubeSize), 0)
  const angularHeightDeg = (Math.atan2(maxHeight, MOUNTAIN_INNER) * 180) / Math.PI
  console.log(`Mountains: max height ${maxHeight.toFixed(0)}, angular height ${angularHeightDeg.toFixed(1)}° ` +
    `(design target: stay under ~6°)`)

  return peaks
}

// Hard build-time gate: throws unless the mountain backdrop has real gaps
// in it. A solid unbroken ring (the rejected attempt's actual mistake,
// independent of its proximity/height) must never silently reappear from a
// future reseed.
function verifyMountainHorizonGaps(spans: { start: number; end: number }[]): void {
  if (spans.length === 0) throw new Error("Mountain generation produced zero clusters — reseed or check MOUNTAIN_CLUSTERS skip probability")

  const TWO_PI = Math.PI * 2
  const norm = spans
    .map((s) => ({ start: ((s.start % TWO_PI) + TWO_PI) % TWO_PI, len: s.end - s.start }))
    .sort((a, b) => a.start - b.start)

  const merged: { start: number; end: number }[] = []
  for (const s of norm) {
    const end = s.start + s.len
    const last = merged[merged.length - 1]
    if (last && s.start <= last.end) last.end = Math.max(last.end, end)
    else merged.push({ start: s.start, end })
  }

  const coverage = merged.reduce((sum, m) => sum + (m.end - m.start), 0)
  const coverageFrac = coverage / TWO_PI

  const gapsDeg: number[] = []
  for (let i = 0; i < merged.length; i++) {
    const next = merged[(i + 1) % merged.length]
    const gap = i === merged.length - 1 ? next.start + TWO_PI - merged[i].end : next.start - merged[i].end
    gapsDeg.push((gap * 180) / Math.PI)
  }
  const bigGaps = gapsDeg.filter((g) => g >= MOUNTAIN_MIN_GAP_DEG).length

  console.log(`Mountains: ${merged.length} horizon clusters, ${(coverageFrac * 100).toFixed(1)}% angular coverage, ` +
    `${bigGaps} gaps >= ${MOUNTAIN_MIN_GAP_DEG}°`)

  if (bigGaps < MOUNTAIN_MIN_GAPS) {
    throw new Error(
      `Mountain horizon has only ${bigGaps} gaps >= ${MOUNTAIN_MIN_GAP_DEG}° (need >= ${MOUNTAIN_MIN_GAPS}) — ` +
      `this would read as a solid ring, exactly what the rejected first attempt did. Reseed or widen the skip probability.`
    )
  }
  if (coverageFrac < 0.3 || coverageFrac > 0.7) {
    console.log(`NOTE: mountain coverage ${(coverageFrac * 100).toFixed(1)}% is outside the ideal 45-60% range (not fatal).`)
  }
}

// Re-measures the city's real geometric envelope from this run's own
// generated data (not the theoretical CITY_RADIUS) — building footprint
// corners, road/park-tree positions, road segment endpoints, furniture —
// and asserts it clears CITY_EDGE. Catches a future BSP/placement tweak
// that pushes real geometry past the terrain's inner edge before it ever
// reaches a screenshot.
function measureCityEnvelope(): number {
  let maxR = 0
  const consider = (x: number, z: number) => { maxR = Math.max(maxR, Math.hypot(x, z)) }

  for (const b of placed) {
    const spec = BUILDING_SPECS.find((s) => s.variant === b.variant)
    const halfDiag = spec ? Math.hypot(spec.width / 2, spec.depth / 2) : 10
    maxR = Math.max(maxR, Math.hypot(b.x, b.z) + halfDiag)
  }
  for (const seg of roadSegments) { consider(seg.x1, seg.z1); consider(seg.x2, seg.z2) }
  for (const t of parkTrees) consider(t.x, t.z)
  for (const b of bushes) consider(b.x, b.z)
  for (const t of roadTrees) consider(t.x, t.z)
  for (const l of lampPosts) consider(l.x, l.z)
  for (const b of allBenches) consider(b.x, b.z)
  for (const p of plazas) maxR = Math.max(maxR, Math.hypot(p.x, p.z) + p.radius)

  return maxR
}

function verifyTerrainClearsCity(
  cityEnvelope: number,
  data: {
    hillColumns: number[]
    hillTrees: HillTree[]
    bufferTrees: Point[]
    bufferBushes: Point[]
    meadows: MeadowShape[]
    mountains: MountainPeakOut[]
  }
): void {
  if (cityEnvelope > CITY_EDGE) {
    throw new Error(
      `City envelope (${cityEnvelope.toFixed(1)}) exceeds CITY_EDGE (${CITY_EDGE}) — real city geometry has ` +
      `drifted past the terrain's inner edge. Widen CITY_EDGE (and the band radii above) or investigate what changed.`
    )
  }

  let minR = Infinity
  for (let i = 0; i < data.hillColumns.length; i += 3) {
    minR = Math.min(minR, Math.hypot(data.hillColumns[i] * HILL_CELL, data.hillColumns[i + 1] * HILL_CELL))
  }
  for (const t of data.hillTrees) minR = Math.min(minR, Math.hypot(t.x, t.z))
  for (const t of data.bufferTrees) minR = Math.min(minR, Math.hypot(t.x, t.z))
  for (const b of data.bufferBushes) minR = Math.min(minR, Math.hypot(b.x, b.z))
  for (const m of data.meadows) for (const p of m.points) minR = Math.min(minR, Math.hypot(p.x, p.z))
  for (const p of data.mountains) minR = Math.min(minR, Math.hypot(p.x, p.z) - p.levels * p.cubeSize)

  console.log(`Terrain clears city: min terrain radius ${minR.toFixed(1)} (CITY_EDGE ${CITY_EDGE})`)
  if (minR < CITY_EDGE - 1) {
    throw new Error(`Terrain element found at radius ${minR.toFixed(1)}, inside CITY_EDGE (${CITY_EDGE}) — a generator radius/threshold is wrong.`)
  }
}

const cityEnvelope = measureCityEnvelope()

const terrainNoiseRng  = new RNG(SEED + 20)
const forestNoiseRng   = new RNG(SEED + 21)
const hillTreesRng     = new RNG(SEED + 22)
const bufferRng        = new RNG(SEED + 23)
const meadowRng        = new RNG(SEED + 24)
const mountainRng      = new RNG(SEED + 25)

const terrainSimplex = new SimplexNoise({ random: () => terrainNoiseRng.next() })
const forestSimplex  = new SimplexNoise({ random: () => forestNoiseRng.next() })

const hillColumns  = generateHillColumns(terrainSimplex)
const hillTrees     = generateHillTrees(hillTreesRng, terrainSimplex, forestSimplex)
const bufferScatter = generateBufferScatter(bufferRng, forestSimplex)
const meadows        = generateMeadows(meadowRng)
const mountains      = generateDistantMountains(mountainRng)

verifyTerrainClearsCity(cityEnvelope, {
  hillColumns, hillTrees,
  bufferTrees: bufferScatter.trees, bufferBushes: bufferScatter.bushes,
  meadows, mountains,
})

console.log(
  `Terrain: ${hillColumns.length / 3} hill columns, ${hillTrees.length} hill trees, ` +
  `${bufferScatter.trees.length} buffer trees, ${bufferScatter.bushes.length} buffer bushes, ` +
  `${meadows.length} meadows, ${mountains.length} mountain peaks`
)

const terrainOutput = `/**
 * Static world terrain: grass/park buffer, low rolling voxel hills, distant
 * mountain backdrop. Generated by src/scripts/generateCityLayout.ts's
 * "World terrain" section alongside the other data files — same "fixed
 * design decision, not runtime state" treatment. See that section's doc
 * comment for the full design rationale (this replaced a rejected first
 * attempt — a mountain ring placed close to the city that read as
 * "closed off and claustrophobic").
 *
 * HILL_COLUMNS is a FLAT [gx,gz,level, ...] number array (not objects) —
 * at ~${hillColumns.length / 3} entries, pretty-printed objects would make this file
 * enormous; decor.ts's buildHillsMesh expands it using HILL_CELL/HILL_STEP.
 */

export interface HillTree { x: number; y: number; z: number; }
export interface Point { x: number; z: number; }
export interface MeadowShape { id: string; points: Point[]; }
export interface MountainPeak { x: number; z: number; cubeSize: number; levels: number; seed: number; }
export interface TerrainBands {
  cityEdge: number; bufferOuter: number; hillsInner: number; hillsOuter: number;
  mountainInner: number; mountainOuter: number; groundRadius: number;
  fogNear: number; fogFar: number;
}

export const HILL_CELL = ${HILL_CELL};
export const HILL_STEP = ${HILL_STEP};
export const HILL_COLUMNS: number[] = ${JSON.stringify(hillColumns)};

export const HILL_TREES: HillTree[] = ${JSON.stringify(hillTrees, null, 2)};

export const BUFFER_TREES: Point[] = ${JSON.stringify(bufferScatter.trees, null, 2)};

export const BUFFER_BUSHES: Point[] = ${JSON.stringify(bufferScatter.bushes, null, 2)};

export const MEADOWS: MeadowShape[] = ${JSON.stringify(meadows, null, 2)};

export const MOUNTAINS: MountainPeak[] = ${JSON.stringify(mountains, null, 2)};

export const TERRAIN_BANDS: TerrainBands = ${JSON.stringify({
  cityEdge: CITY_EDGE, bufferOuter: BUFFER_OUTER, hillsInner: HILLS_INNER, hillsOuter: HILLS_OUTER,
  mountainInner: MOUNTAIN_INNER, mountainOuter: MOUNTAIN_OUTER, groundRadius: GROUND_RADIUS,
  fogNear: FOG_NEAR, fogFar: FOG_FAR,
}, null, 2)};
`

const terrainPath = join(process.cwd(), "src/data/cityTerrain.ts")
writeFileSync(terrainPath, terrainOutput)
console.log(`Wrote ${terrainPath}`)
