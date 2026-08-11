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
import { buildDecorGroup, disposeDecorGroup } from "./decor"

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

interface BuildingNode {
  solidMesh: THREE.InstancedMesh
  glassMesh: THREE.InstancedMesh
  blocks: Block[]
  solidUpTo: Int32Array
  glassUpTo: Int32Array
  visibleCount: number
  highlights: Map<number, HighlightEntry>
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

  // ── Renderer ────────────────────────────────────────────────────────────
  // logarithmicDepthBuffer: with near=1/far=4000 (a large ratio, needed since
  // the camera can zoom out to maxDistance=1200) a linear depth buffer loses
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
  if (!disableFog) scene.fog = new THREE.Fog(0xc5e8f7, 300, 900)

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
  controls.maxDistance       = 1200
  controls.maxPolarAngle     = Math.PI / 2 - 0.02
  controls.panSpeed          = 1.2
  controls.rotateSpeed       = 0.65
  controls.zoomSpeed         = 1.2
  controls.screenSpacePanning = false
  controls.target.set(DEFAULT_CAMERA_TARGET.x, DEFAULT_CAMERA_TARGET.y, DEFAULT_CAMERA_TARGET.z)
  controls.update()

  // ── Lights ───────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a6b4a, 0.7))
  scene.add(new THREE.AmbientLight(0xffffff, 0.45))
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.4)
  sun.position.set(120, 200, -90)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0xccddff, 0.35)
  fill.position.set(-80, 60, 80)
  scene.add(fill)

  // ── Ground & grid ────────────────────────────────────────────────────────
  // 800: comfortably covers the Phase 2/3 city's placement disc (extent grows
  // a little past the theoretical radius estimate since the RSA placement
  // fallback can push a hard-to-place building slightly further out — see
  // generateCityLayout.ts), with real margin to spare.
  const groundGeo = new THREE.PlaneGeometry(800, 800)
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x6b8f5e })
  const ground    = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const grid = new THREE.GridHelper(800, 800, 0x3a6032, 0x4a7a42)
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity     = 0.35
  grid.position.y = 0.05
  scene.add(grid)

  // ── Decor (parks, lakes, roads, trees) — static, built once ───────────────
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
    controls.update()

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
      const isVertical = nx === 0 && nz === 0
      const [ox, oy, oz] = isVertical ? [0, 1, 0] : [nx, ny, nz]

      camera.position.set(cx + ox * FOCUS_OFFSET, cy + oy * FOCUS_OFFSET, cz + oz * FOCUS_OFFSET)
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
      groundGeo.dispose()
      groundMat.dispose()
      grid.geometry.dispose()
      ;(grid.material as THREE.Material).dispose()
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
