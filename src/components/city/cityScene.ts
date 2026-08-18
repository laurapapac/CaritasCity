/**
 * Imperative Three.js city scene.
 *
 * One renderer / camera / scene shared across all buildings.
 * Each building gets its own pair of InstancedMeshes (solid + glass) that
 * share the same BoxGeometry and materials — so adding a building costs only
 * two extra draw calls regardless of how many blocks it contains.
 *
 * Performance ceiling: comfortable at ~100 buildings (200 draw calls).
 * For a 1 000-building city you'd merge to a single pair of InstancedMeshes
 * per category, but that's a future concern.
 */

import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import type { Block, CityBuilding, CityDecor } from "./types"
import {
  BLOCK_TEX,
  GLASS_HEX,
  HIGHLIGHT_HEX,
  HIGHLIGHT_DUR,
  resolveColor,
  isGlass,
  computeUpTo,
} from "./utils"
import { buildDecorGroup, buildGroundGroup, disposeDecorGroup } from "./decor"

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

type HighlightEntry = { origIdx: number; startTime: number }

// ─────────────────────────────────────────────────────────────────────────────
// Camera framing constants
// ─────────────────────────────────────────────────────────────────────────────

// Wide establishing shot — frames the 2×2 grid of category plots (±30 x, ±20 z).
const DEFAULT_CAMERA_POS = { x: 0, y: 90, z: -140 }
const DEFAULT_CAMERA_TARGET = { x: 0, y: 10, z: 0 }

// How far from a block's center the close-up camera sits, along its exposed face's
// outward normal. Far enough to show neighboring blocks on the same wall, not just
// the single target block filling the frame.
const FOCUS_OFFSET = 22

// Top-view framing tilt (2026-08-17): a floor/ceiling-completing block used to be
// framed dead straight overhead (phi=0), which read fine before decor existed but
// now blends into the flat rooftop/floor plane and surrounding terrain — nothing
// to tell the fresh block apart from its neighbors at a pure top-down angle. Tilting
// the shot off vertical keeps the "from above" framing (still clearly reads as a
// floor/ceiling shot, not a wall shot) while exposing a bit of the block's side
// face, which is what actually makes it pop out against the flat plane. Steepened
// from an initial 35° to 22° (2026-08-17, same day follow-up, user asked for "a bit
// more steep") — still enough tilt to show a side face, closer to overhead than the
// first pass.
const TOP_VIEW_TILT_DEG = 22
const TOP_VIEW_TILT_RAD = (TOP_VIEW_TILT_DEG * Math.PI) / 180
const TOP_VIEW_VERTICAL = Math.cos(TOP_VIEW_TILT_RAD)
const TOP_VIEW_HORIZONTAL = Math.sin(TOP_VIEW_TILT_RAD)

// Which way (compass-wise) the top-view tilt leans is otherwise arbitrary, so it's
// used to dodge nearby tree canopies instead of always leaning south. 8 candidate
// azimuths at the same TOP_VIEW_TILT_DEG steepness — index 0 is due south (-z),
// matching the original single-direction behavior, so nothing changes for a block
// with no trees crowding it.
const TOP_VIEW_AZIMUTH_COUNT = 8
const TOP_VIEW_DIRECTIONS: Array<[number, number]> = Array.from({ length: TOP_VIEW_AZIMUTH_COUNT }, (_, i) => {
  const angle = (i / TOP_VIEW_AZIMUTH_COUNT) * Math.PI * 2
  return [Math.sin(angle) * TOP_VIEW_HORIZONTAL, -Math.cos(angle) * TOP_VIEW_HORIZONTAL]
})

// How close (world units) a tree can sit to the top-view camera's candidate
// position before it's treated as being in the way. Tuned by feel against
// FOCUS_OFFSET's close-up distance (22), not the tree canopy's actual geometric
// radius — at this zoom a canopy reads as blocking well before the camera is
// literally inside it.
const TREE_CLEARANCE_RADIUS = 14

// Only trees within this radius of the framed block are worth checking at all —
// keeps the per-focus scan to a handful of nearby trees instead of the whole
// city's canopy list.
const TREE_SEARCH_RADIUS = FOCUS_OFFSET + TREE_CLEARANCE_RADIUS + 10

// Picks which of the 8 TOP_VIEW_DIRECTIONS to frame a floor/ceiling shot from:
// stays on the default (south) direction unless a tree crowds it, in which case
// it swings to whichever azimuth puts the most distance between the camera and
// the nearest tree. Deterministic (same inputs → same output), same as the rest
// of this file's framing logic.
function pickTopViewOffset(
  cx: number,
  cz: number,
  trees: Array<{ x: number; z: number }>
): [number, number, number] {
  const nearby = trees.filter(
    (t) => Math.abs(t.x - cx) < TREE_SEARCH_RADIUS && Math.abs(t.z - cz) < TREE_SEARCH_RADIUS
  )

  const clearance = ([ox, oz]: [number, number]): number => {
    if (nearby.length === 0) return Infinity
    const camX = cx + ox * FOCUS_OFFSET
    const camZ = cz + oz * FOCUS_OFFSET
    let nearest = Infinity
    for (const t of nearby) {
      const d = Math.hypot(t.x - camX, t.z - camZ)
      if (d < nearest) nearest = d
    }
    return nearest
  }

  const [defaultOx, defaultOz] = TOP_VIEW_DIRECTIONS[0]
  if (clearance([defaultOx, defaultOz]) >= TREE_CLEARANCE_RADIUS) {
    return [defaultOx, TOP_VIEW_VERTICAL, defaultOz]
  }

  let best = TOP_VIEW_DIRECTIONS[0]
  let bestClearance = -Infinity
  for (const dir of TOP_VIEW_DIRECTIONS) {
    const c = clearance(dir)
    if (c > bestClearance) {
      bestClearance = c
      best = dir
    }
  }
  return [best[0], TOP_VIEW_VERTICAL, best[1]]
}

// Soft world boundary (2026-08-13, tightened twice same day — first pass
// (350, matching CITY_EDGE's full measured envelope including sparse edge
// roads/trees) still let a right-drag pan noticeably past what reads as
// "the city," so pulled in further to 280 — matching CITY_RADIUS
// (generateCityLayout.ts), the tighter "core" city boundary rather than
// its outermost edge decor) — how far controls.target may be panned from
// the origin. OrbitControls has no built-in pan-distance clamp
// (min/maxDistance only bound zoom/dolly), so this is enforced by hand in
// animate() below. The terrain past this point is still visible (it's
// what keeps the world from feeling boxed in) — the user just can't
// navigate the camera's own focal point out into it.
const PAN_LIMIT = 280

// Angle-dependent max zoom-out (2026-08-13, same day, third camera pass) —
// a flat controls.maxDistance can only be exactly right at one tilt: how
// much ground a given distance reveals depends heavily on the camera's
// polar angle (phi, OrbitControls' own convention — 0 = straight down,
// maxPolarAngle = shallowest allowed angle near the horizon). Straight
// down, visible radius ≈ distance*tan(halfVFOV); at a shallow/oblique
// angle, the same distance reveals far more ground in the "far" direction
// (perspective foreshortening). A flat 550 was tuned "perfect from the
// top" but showed too much outer terrain at low angles — so the cap itself
// now shrinks as phi grows, interpolated between these two tuned extremes.
const TOP_DOWN_MAX_DISTANCE = 550 // phi≈0 — user-confirmed correct, unchanged
const OBLIQUE_MAX_DISTANCE  = 330 // phi≈maxPolarAngle — starting point, tune by feel like the others

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// Vertical (floor/ceiling — nothing above or below) is checked before lateral
// (wall) on purpose: a block completing a floor/ceiling layer should be framed
// from above so the layer-completing motion reads clearly, even if it also
// happens to have a wall face exposed (e.g. a perimeter block on the growing
// top layer). Only when neither vertical direction is exposed do we fall back
// to framing whichever wall face is free. Straight-overhead/underneath framing
// (phi = 0 or π in OrbitControls' spherical terms) is safe here — it's within
// the existing minPolarAngle/maxPolarAngle range, no special up-vector needed.
const VERTICAL_DIRECTIONS: Array<[number, number, number]> = [
  [0, 1, 0], // floor/ceiling — nothing above (a new top layer forming)
  [0, -1, 0], // floor/ceiling — nothing below (rare, but handled the same way)
]
const LATERAL_DIRECTIONS: Array<[number, number, number]> = [
  [0, 0, -1],
  [-1, 0, 0],
  [1, 0, 0],
  [0, 0, 1],
]

// How many consecutive blocks (in both directions along the perpendicular
// horizontal axis) share this same exposed face — i.e. how long is the wall
// this block sits on, for a given candidate lateral direction. Used to break
// ties at corners: a block can be exposed on two lateral faces at once (e.g.
// a corner where a long wall meets a short one), and we want the framing to
// favor the wall that's actually substantial, not whichever direction happens
// to come first in a fixed compass order.
function wallSpanLength(
  occupied: Set<string>,
  b: { x: number; y: number; z: number },
  [dx, dy, dz]: [number, number, number]
): number {
  const perpAxis: "x" | "z" = dx !== 0 ? "z" : "x"
  let length = 1
  for (const step of [1, -1]) {
    const pos = { ...b }
    for (;;) {
      pos[perpAxis] += step
      if (!occupied.has(`${pos.x},${pos.y},${pos.z}`)) break // building doesn't extend this far
      if (occupied.has(`${pos.x + dx},${pos.y + dy},${pos.z + dz}`)) break // no longer exposed here
      length++
    }
  }
  return length
}

// No face/normal data exists on voxels — derive "which way does this block face
// outward" purely from occupancy: whichever of the 6 neighbor cells is empty.
// Pure function of the block list + index, so it's naturally deterministic across
// calls (same building + blockIndex always yields the same framing).
function findExposedFaceNormal(blocks: Block[], index: number): [number, number, number] {
  const b = blocks[index]
  const occupied = new Set(blocks.map((v) => `${v.x},${v.y},${v.z}`))

  for (const [dx, dy, dz] of VERTICAL_DIRECTIONS) {
    if (!occupied.has(`${b.x + dx},${b.y + dy},${b.z + dz}`)) return [dx, dy, dz]
  }

  const exposedLateral = LATERAL_DIRECTIONS.filter(
    ([dx, dy, dz]) => !occupied.has(`${b.x + dx},${b.y + dy},${b.z + dz}`)
  )
  if (exposedLateral.length === 0) return LATERAL_DIRECTIONS[0] // fully enclosed (shouldn't happen)
  if (exposedLateral.length === 1) return exposedLateral[0]

  // Corner — multiple lateral faces exposed. Frame whichever wall is longer.
  let best = exposedLateral[0]
  let bestSpan = -1
  for (const dir of exposedLateral) {
    const span = wallSpanLength(occupied, b, dir)
    if (span > bestSpan) {
      bestSpan = span
      best = dir
    }
  }
  return best
}

interface BBoxXZ {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// A building's footprint in the XZ plane, padded ±0.5 since block x/z are
// cube centers. Computed once from the full blueprint (blocks is always the
// complete building regardless of construction progress — see syncBuilding),
// since a footprint never changes as a building is built up.
function computeBBoxXZ(blocks: Block[]): BBoxXZ {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const b of blocks) {
    if (b.x < minX) minX = b.x
    if (b.x > maxX) maxX = b.x
    if (b.z < minZ) minZ = b.z
    if (b.z > maxZ) maxZ = b.z
  }
  return { minX: minX - 0.5, maxX: maxX + 0.5, minZ: minZ - 0.5, maxZ: maxZ + 0.5 }
}

// Exact (closed-form) distance along the ray (ox0,oz0)+t*(dx,dz), t>=0, at
// which it first enters `box` — or null if it never does. A standard 2D
// ray/AABB slab test, not step-walking: exact, O(1), and works for any
// direction, not just the 4 compass directions.
function rayEntersBBoxXZ(
  ox0: number,
  oz0: number,
  dx: number,
  dz: number,
  box: BBoxXZ
): number | null {
  let tMin = 0
  let tMax = Infinity

  if (Math.abs(dx) < 1e-9) {
    if (ox0 < box.minX || ox0 > box.maxX) return null
  } else {
    let t1 = (box.minX - ox0) / dx
    let t2 = (box.maxX - ox0) / dx
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
  }

  if (Math.abs(dz) < 1e-9) {
    if (oz0 < box.minZ || oz0 > box.maxZ) return null
  } else {
    let t1 = (box.minZ - oz0) / dz
    let t2 = (box.maxZ - oz0) / dz
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
  }

  return tMin > tMax || tMax < 0 ? null : Math.max(0, tMin)
}

// How far a lateral camera can travel along its chosen direction before
// entering another building's footprint — the fix for the camera sometimes
// landing "on the wrong side," with a neighboring building's already-built
// geometry covering the target block. Only considers neighbors with
// visibleCount > 0 (an empty/unbuilt lot has nothing to occlude yet, and
// clamping against it unconditionally would needlessly pull in FOCUS_OFFSET's
// wide establishing shot for most ordinary placements). STATIC_LANDMARKS
// (church/fountain) are ordinary entries in `nodes` and always fully built,
// so they're correctly included here with no special-casing.
function nearestOccupiedNeighborEntryDistance(
  nodes: Map<string, BuildingNode>,
  selfId: string,
  cx: number,
  cz: number,
  ox: number,
  oz: number
): number {
  let nearest = Infinity
  for (const [id, other] of nodes) {
    if (id === selfId || other.visibleCount === 0) continue
    const t = rayEntersBBoxXZ(cx, cz, ox, oz, other.bboxXZ)
    if (t !== null && t < nearest) nearest = t
  }
  return nearest
}

// Margin (world units) the lateral camera stops short of a neighbor's
// footprint, rather than stopping exactly at its edge. Tune live.
const NEIGHBOR_CLEARANCE_MARGIN = 2

interface BuildingNode {
  solidMesh: THREE.InstancedMesh
  glassMesh: THREE.InstancedMesh
  blocks: Block[]
  solidUpTo: Int32Array
  glassUpTo: Int32Array
  visibleCount: number
  highlights: Map<number, HighlightEntry>
  bboxXZ: BBoxXZ
}

// ─────────────────────────────────────────────────────────────────────────────
// Public handle
// ─────────────────────────────────────────────────────────────────────────────

export interface CitySceneHandle {
  /**
   * Create (first call) or sync (subsequent calls) a building's mesh to match
   * building.completedBlocks.  Safe to call on every render — it skips work
   * when nothing has changed.
   */
  syncBuilding(building: CityBuilding, blocks: Block[]): void
  /** Remove a building's meshes from the scene. */
  unregisterBuilding(id: string): void
  /**
   * Instantly set a building's visible block count to an arbitrary value —
   * no animation, no highlight. Dev/preview tooling only (see DevPreview.tsx);
   * the real placement flow always goes through addBlock/playConstructionMontage.
   */
  setVisibleCount(buildingId: string, count: number): void
  /**
   * Incrementally reveal one block, painting it yellow, then fading to its
   * final colour over HIGHLIGHT_DUR seconds.  Fires onProgress(newCount).
   */
  addBlock(buildingId: string, onProgress?: (newCount: number) => void): void
  /**
   * Purely visual "under construction" effect: rewinds up to `count` of the
   * building's most-recently-placed blocks, then replays their reveal — no
   * highlight, they just pop to their final color — one at a time, `staggerMs`
   * apart. Doesn't change how many blocks are counted as placed — just re-plays
   * their appearance. Calls onComplete once the full replay has finished.
   */
  playConstructionMontage(
    buildingId: string,
    count: number,
    staggerMs: number,
    onComplete?: () => void
  ): void
  /**
   * Snap the camera close to and facing a specific already-placed block (no
   * animation — an instant cut), optionally re-triggering the same yellow
   * highlight fade used when a block is first revealed. Deterministic: same
   * buildingId + blockIndex always produces the same framing.
   */
  focusOnBlock(buildingId: string, blockIndex: number, opts?: { highlight?: boolean }): void
  /** Snap the camera back to the wide establishing shot. */
  resetCamera(): void
  getVisibleCount(buildingId: string): number
  dispose(): void
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export interface CitySceneOptions {
  decor?: CityDecor
  /** Skips scene.fog entirely — useful for dev tooling that wants a clear,
   *  unobscured screenshot at long camera distances (e.g. DevCityPreview's
   *  road-sketching reference shots). Real kiosk/demo pages keep fog on. */
  disableFog?: boolean
}

export function createCityScene(container: HTMLDivElement, options: CitySceneOptions = {}): CitySceneHandle {
  const { decor, disableFog } = options
  const w = container.clientWidth  || 1
  const h = container.clientHeight || 1

  // Flat tree census for pickTopViewOffset's proximity check — every tree source
  // in CityDecor, positions only. Built once (decor is static per scene instance)
  // rather than per focus call. /kiosk and /dev/city both pass all of these; a
  // caller with no decor (or no terrain) just gets an empty/partial list, which
  // degrades to "no nearby trees" — always the default south-facing tilt.
  const topViewTrees: Array<{ x: number; z: number }> = [
    ...(decor?.roadTrees ?? []),
    ...(decor?.parkTrees ?? []),
    ...(decor?.terrain?.hillTrees ?? []),
    ...(decor?.terrain?.bufferTrees ?? []),
  ]

  // ── Renderer ────────────────────────────────────────────────────────────
  // logarithmicDepthBuffer: with near=1/far=4000 (a large ratio, needed since
  // the camera can zoom out to maxDistance=800) a linear depth buffer loses
  // almost all its precision at distance — parks/lakes/roads sitting within a
  // fraction of a unit of the ground and each other flickered/z-fought once
  // zoomed out. Logarithmic redistributes precision to fix exactly this.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  container.appendChild(renderer.domElement)
  renderer.domElement.style.display = "block"

  // ── Scene ────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene()
  scene.background = new THREE.Color("#87ceeb")
  // Fog near/far widened (2026-08-13, was 300/900) to match the world
  // terrain's much larger scale (grass buffer/hills/mountains now extend to
  // ~2000, see generateCityLayout.ts's TERRAIN_BANDS) — near=800 keeps the
  // whole city (envelope ~344) crisp, far=2400 means the ground rim and
  // distant mountains sit mostly hazed. Fog color (0xc5e8f7) is duplicated
  // as FOG_TINT_COLOR in decor.ts, which bakes the same atmospheric
  // perspective directly into hill/mountain/ground-rim vertex colors so
  // they read as background even with fog disabled or at close range —
  // keep both in sync if this color ever changes.
  if (!disableFog) scene.fog = new THREE.Fog(0xc5e8f7, 800, 2400)

  // ── Camera ───────────────────────────────────────────────────────────────
  // near=1 (not 0.5): nothing ever renders closer than controls.minDistance
  // (1.5) below, so this loses nothing and gives the depth buffer a little
  // more room to work with.
  const camera = new THREE.PerspectiveCamera(50, w / h, 1, 4000)
  camera.position.set(DEFAULT_CAMERA_POS.x, DEFAULT_CAMERA_POS.y, DEFAULT_CAMERA_POS.z)

  // ── Controls ─────────────────────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping     = true
  controls.dampingFactor     = 0.08
  // Low enough that focusOnBlock's close-up framing (FOCUS_OFFSET) isn't
  // immediately clamped back out on the next controls.update().
  controls.minDistance       = 1.5
  // Tightened from 1600, then 800 (2026-08-13, same day) before landing on
  // an angle-dependent cap (TOP_DOWN_MAX_DISTANCE/OBLIQUE_MAX_DISTANCE
  // above) — a single flat value couldn't be right at every tilt (correct
  // at top-down, too loose at the shallower angles people actually use day
  // to day, since the same distance reveals far more ground at a low
  // angle). Set here as the initial/top-down value; animate() below
  // overwrites this every frame based on the camera's current polar angle.
  controls.maxDistance       = TOP_DOWN_MAX_DISTANCE
  controls.maxPolarAngle     = Math.PI / 2 - 0.02
  controls.panSpeed          = 1.2
  controls.rotateSpeed       = 0.65
  controls.zoomSpeed         = 1.2
  controls.screenSpacePanning = false
  controls.target.set(DEFAULT_CAMERA_TARGET.x, DEFAULT_CAMERA_TARGET.y, DEFAULT_CAMERA_TARGET.z)
  controls.update()

  // phi=0 is straight down, controls.maxPolarAngle is the shallowest allowed
  // tilt — interpolates the two tuned extremes above. Declared here (not at
  // module scope) since it reads controls.maxPolarAngle.
  function maxDistanceForPhi(phi: number): number {
    const t = smoothstep(0, controls.maxPolarAngle, phi)
    return TOP_DOWN_MAX_DISTANCE + (OBLIQUE_MAX_DISTANCE - TOP_DOWN_MAX_DISTANCE) * t
  }
  // Tracks the camera's polar angle across frames — set from the ACTUAL
  // camera position each frame (see animate() below), one frame behind,
  // so this frame's controls.maxDistance can be picked before update() runs
  // (phi is unknown until after update() applies pending rotate/pan/zoom
  // deltas — a one-frame lag here is imperceptible at animation-frame rates
  // and phi only changes from gradual user rotation anyway). Starts at 0 to
  // match DEFAULT_CAMERA_POS's fairly top-down establishing shot.
  let lastPhi = 0

  // ── Lights ───────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a6b4a, 0.7))
  scene.add(new THREE.AmbientLight(0xffffff, 0.45))
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.4)
  sun.position.set(120, 200, -90)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0xccddff, 0.35)
  fill.position.set(-80, 60, 80)
  scene.add(fill)

  // ── Ground ───────────────────────────────────────────────────────────────
  // Replaces the old flat PlaneGeometry(800,800) + square GridHelper
  // (2026-08-13) — a grey inner disc (radius 360, comfortably covers the
  // city's measured ~344 envelope) plus a large gradient ring fading
  // grey→grass→haze→fog-color out to radius 2000, so there's no rectangular
  // edge and no visible outer boundary at any camera angle. GridHelper is
  // dropped entirely, not just resized — its own square boundary was part
  // of what read as "the rectangular edge" in the first place. See
  // decor.ts's buildGroundGroup for the full rationale.
  const groundGroup = buildGroundGroup()
  scene.add(groundGroup)

  // ── Decor (parks, lakes, roads, trees, world terrain) — static, built once
  const decorGroup = decor ? buildDecorGroup(decor) : null
  if (decorGroup) scene.add(decorGroup)

  // ── Shared geometry & materials (reused by every building) ───────────────
  // Two draw calls per building, but geo/mat uploads happen only once.
  const voxelGeo = new THREE.BoxGeometry(1, 1, 1)

  const solidMat = new THREE.MeshLambertMaterial({ map: BLOCK_TEX })

  const glassMat = new THREE.MeshPhongMaterial({
    color:      GLASS_HEX,
    transparent: true,
    opacity:    0.38,
    shininess:  160,
    specular:   new THREE.Color(0xc8eeff),
    depthWrite: false,
    side:       THREE.DoubleSide,
  })

  // ── Per-building node map ─────────────────────────────────────────────────
  const nodes  = new Map<string, BuildingNode>()
  const dummy  = new THREE.Object3D()
  const hlColor  = new THREE.Color(HIGHLIGHT_HEX)
  const finColor = new THREE.Color()

  // ── Resize ───────────────────────────────────────────────────────────────
  const ro = new ResizeObserver(() => {
    const ww = container.clientWidth  || 1
    const hh = container.clientHeight || 1
    camera.aspect = ww / hh
    camera.updateProjectionMatrix()
    renderer.setSize(ww, hh)
  })
  ro.observe(container)

  // ── Render loop ───────────────────────────────────────────────────────────
  // Highlight animation runs here rather than in useFrame so we don't need r3f.
  let rafId = 0
  const animate = () => {
    rafId = requestAnimationFrame(animate)
    // Angle-dependent zoom cap (2026-08-13) — see maxDistanceForPhi's doc
    // comment. Must be set BEFORE controls.update() so OrbitControls' own
    // internal spherical-radius clamping (inside update()) applies it
    // natively — overriding camera.position after the fact instead would
    // leave that internal radius state stale/out of sync (unlike panning,
    // handled below, which has no such hidden state).
    controls.maxDistance = maxDistanceForPhi(lastPhi)
    controls.update()

    // Recompute phi from the camera's actual post-update position, for next
    // frame's maxDistanceForPhi call above.
    const camOffset = camera.position.clone().sub(controls.target)
    const camDist = camOffset.length()
    if (camDist > 1e-6) lastPhi = Math.acos(THREE.MathUtils.clamp(camOffset.y / camDist, -1, 1))

    // Soft world boundary (2026-08-13) — see PAN_LIMIT's doc comment.
    // Clamps controls.target's XZ distance from the origin by hand, since
    // OrbitControls has no built-in pan clamp. Moves camera.position by the
    // same delta so orbit distance/angle are preserved — panning into the
    // wall feels like sliding along it, not like the view snapping or
    // rotating. Runs after controls.update() and before renderer.render()
    // so an over-panned frame is never actually displayed.
    const targetR = Math.hypot(controls.target.x, controls.target.z)
    if (targetR > PAN_LIMIT) {
      const shrink = PAN_LIMIT / targetR - 1
      const dx = controls.target.x * shrink
      const dz = controls.target.z * shrink
      controls.target.x += dx
      controls.target.z += dz
      camera.position.x += dx
      camera.position.z += dz
    }

    const now = performance.now() / 1000
    for (const node of nodes.values()) {
      if (node.highlights.size === 0) continue
      let dirty = false
      for (const [si, { origIdx, startTime }] of node.highlights) {
        const elapsed = now - startTime
        if (elapsed >= HIGHLIGHT_DUR) {
          node.solidMesh.setColorAt(si, finColor.set(resolveColor(node.blocks[origIdx])))
          node.highlights.delete(si)
          dirty = true
        } else {
          const t      = elapsed / HIGHLIGHT_DUR
          const smooth = t * t * (3 - 2 * t) // smoothstep
          hlColor.set(HIGHLIGHT_HEX)
          finColor.set(resolveColor(node.blocks[origIdx]))
          node.solidMesh.setColorAt(si, hlColor.lerp(finColor, smooth))
          dirty = true
        }
      }
      if (dirty && node.solidMesh.instanceColor) node.solidMesh.instanceColor.needsUpdate = true
    }

    renderer.render(scene, camera)
  }
  animate()

  // ── Internal: full rebuild for a node ────────────────────────────────────
  function rebuildNode(node: BuildingNode, count: number) {
    const target = Math.min(count, node.blocks.length)
    node.visibleCount = target
    node.highlights.clear()

    let si = 0, gi = 0
    for (let i = 0; i < target; i++) {
      const b = node.blocks[i]
      dummy.position.set(b.x, b.y + 0.5, b.z)
      dummy.updateMatrix()
      if (isGlass(b)) {
        node.glassMesh.setMatrixAt(gi++, dummy.matrix)
      } else {
        node.solidMesh.setMatrixAt(si, dummy.matrix)
        node.solidMesh.setColorAt(si++, finColor.set(resolveColor(b)))
      }
    }

    node.solidMesh.count = si
    node.glassMesh.count = gi
    node.solidMesh.instanceMatrix.needsUpdate = true
    node.glassMesh.instanceMatrix.needsUpdate = true
    if (node.solidMesh.instanceColor) node.solidMesh.instanceColor.needsUpdate = true
  }

  // ── Internal: reveal a single block ───────────────────────────────────────
  // Shared by addBlock() (one genuinely new block — always highlighted) and
  // playConstructionMontage() (replaying already-known blocks purely for visual
  // effect — highlight off by default, they just pop straight to their final color).
  function revealBlockAt(node: BuildingNode, i: number, opts: { highlight?: boolean } = {}) {
    const highlight = opts.highlight ?? true
    const b = node.blocks[i]
    node.visibleCount = Math.max(node.visibleCount, i + 1)

    dummy.position.set(b.x, b.y + 0.5, b.z)
    dummy.updateMatrix()

    if (isGlass(b)) {
      const gi = node.glassUpTo[i]
      node.glassMesh.setMatrixAt(gi, dummy.matrix)
      node.glassMesh.count = Math.max(node.glassMesh.count, gi + 1)
      node.glassMesh.instanceMatrix.needsUpdate = true
    } else {
      const si = node.solidUpTo[i]
      node.solidMesh.setMatrixAt(si, dummy.matrix)
      node.solidMesh.count = Math.max(node.solidMesh.count, si + 1)
      node.solidMesh.instanceMatrix.needsUpdate = true
      if (highlight) {
        node.solidMesh.setColorAt(si, hlColor.set(HIGHLIGHT_HEX))
        node.highlights.set(si, { origIdx: i, startTime: performance.now() / 1000 })
      } else {
        node.solidMesh.setColorAt(si, finColor.set(resolveColor(b)))
      }
      if (node.solidMesh.instanceColor) node.solidMesh.instanceColor.needsUpdate = true
    }
  }

  // Tracks the montage's pending timer so a new montage (or dispose) can cancel it.
  let montageTimeoutId: ReturnType<typeof setTimeout> | undefined

  // ── Handle ────────────────────────────────────────────────────────────────
  const handle: CitySceneHandle = {

    syncBuilding(building, blocks) {
      let node = nodes.get(building.id)

      if (!node) {
        // Allocate meshes sized for this building's worst-case block count
        const maxSolid = building.totalBlocks + 64
        const maxGlass = Math.max(64, Math.ceil(building.totalBlocks * 0.05))

        const sm = new THREE.InstancedMesh(voxelGeo, solidMat, maxSolid)
        sm.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        sm.count = 0
        sm.frustumCulled = false
        scene.add(sm)

        const gm = new THREE.InstancedMesh(voxelGeo, glassMat, maxGlass)
        gm.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        gm.count = 0
        gm.frustumCulled = false
        gm.renderOrder   = 1
        scene.add(gm)

        const { solidUpTo, glassUpTo } = computeUpTo(blocks)

        node = {
          solidMesh: sm,
          glassMesh: gm,
          blocks,
          solidUpTo,
          glassUpTo,
          visibleCount: 0,
          highlights: new Map(),
          bboxXZ: computeBBoxXZ(blocks),
        }
        nodes.set(building.id, node)
      }

      const target = Math.min(building.completedBlocks, blocks.length)
      // Skip rebuild when addBlock() already moved visibleCount to target
      if (target === node.visibleCount) return
      rebuildNode(node, target)
    },

    unregisterBuilding(id) {
      const node = nodes.get(id)
      if (!node) return
      scene.remove(node.solidMesh)
      scene.remove(node.glassMesh)
      nodes.delete(id)
    },

    setVisibleCount(buildingId, count) {
      const node = nodes.get(buildingId)
      if (!node) return
      rebuildNode(node, count)
    },

    addBlock(buildingId, onProgress) {
      const node = nodes.get(buildingId)
      if (!node) return

      const i = node.visibleCount
      if (i >= node.blocks.length) return

      revealBlockAt(node, i)
      onProgress?.(i + 1)
    },

    playConstructionMontage(buildingId, count, staggerMs, onComplete) {
      clearTimeout(montageTimeoutId)

      const node = nodes.get(buildingId)
      if (!node) { onComplete?.(); return }

      const target = node.visibleCount
      const rewindTo = Math.max(0, target - count)
      if (rewindTo >= target) { onComplete?.(); return }

      // Instantly hide the blocks we're about to replay — purely visual, doesn't
      // touch React state/completedBlocks, which already accounts for them.
      rebuildNode(node, rewindTo)

      let i = rewindTo
      const step = () => {
        revealBlockAt(node, i, { highlight: false })
        i++
        if (i >= target) { onComplete?.(); return }
        montageTimeoutId = setTimeout(step, staggerMs)
      }
      step()
    },

    focusOnBlock(buildingId, blockIndex, opts) {
      const node = nodes.get(buildingId)
      if (!node) return
      const block = node.blocks[blockIndex]
      if (!block) return

      const [nx, ny, nz] = findExposedFaceNormal(node.blocks, blockIndex)
      const cx = block.x, cy = block.y + 0.5, cz = block.z

      // Floor AND ceiling (any vertical exposure) are framed from above, never
      // below — controls.maxPolarAngle forbids the camera from ever going
      // beneath the target's horizontal plane, so offsetting downward for a
      // "ceiling" (nothing below) normal would get silently clamped into a
      // useless in-between position instead of the intended look-up shot.
      // Tilted, not straight up, so the block's side face shows a little instead
      // of blending flat into the floor/rooftop plane — and steered away from
      // whichever azimuth would put a tree canopy right in front of the camera.
      const isVertical = nx === 0 && nz === 0
      const [ox, oy, oz] = isVertical ? pickTopViewOffset(cx, cz, topViewTrees) : [nx, ny, nz]

      // Lateral shots only: don't let FOCUS_OFFSET's fixed distance fly the
      // camera past the real (often much narrower, ~ROAD_GAP=8) gap to a
      // neighboring building into its already-built geometry — pull the
      // camera in instead of letting a nearer building cover the target
      // block. Vertical shots skip this: their horizontal displacement is
      // only sin(TOP_VIEW_TILT_DEG)*FOCUS_OFFSET (~8 units), comfortably
      // inside typical building gaps already.
      let dist = FOCUS_OFFSET
      if (!isVertical) {
        const entry = nearestOccupiedNeighborEntryDistance(nodes, buildingId, cx, cz, ox, oz)
        if (entry < FOCUS_OFFSET) dist = Math.max(controls.minDistance, entry - NEIGHBOR_CLEARANCE_MARGIN)
      }

      camera.position.set(cx + ox * dist, cy + oy * dist, cz + oz * dist)
      controls.target.set(cx, cy, cz)
      controls.update()

      if (opts?.highlight && !isGlass(block)) {
        const si = node.solidUpTo[blockIndex]
        if (si >= 0 && si < node.solidMesh.count) {
          node.highlights.set(si, { origIdx: blockIndex, startTime: performance.now() / 1000 })
        }
      }
    },

    resetCamera() {
      camera.position.set(DEFAULT_CAMERA_POS.x, DEFAULT_CAMERA_POS.y, DEFAULT_CAMERA_POS.z)
      controls.target.set(DEFAULT_CAMERA_TARGET.x, DEFAULT_CAMERA_TARGET.y, DEFAULT_CAMERA_TARGET.z)
      controls.update()
    },

    getVisibleCount(buildingId) {
      return nodes.get(buildingId)?.visibleCount ?? 0
    },

    dispose() {
      clearTimeout(montageTimeoutId)
      cancelAnimationFrame(rafId)
      ro.disconnect()
      controls.dispose()
      for (const node of nodes.values()) {
        scene.remove(node.solidMesh)
        scene.remove(node.glassMesh)
      }
      nodes.clear()
      voxelGeo.dispose()
      solidMat.dispose()
      glassMat.dispose()
      scene.remove(groundGroup)
      disposeDecorGroup(groundGroup)
      if (decorGroup) {
        scene.remove(decorGroup)
        disposeDecorGroup(decorGroup)
      }
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    },
  }

  return handle
}
