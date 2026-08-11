/**
 * BuildingRenderer — pure Three.js voxel component (no react-three-fiber)
 *
 * Same public API as an r3f implementation would have; avoids the
 * @react-three/fiber v8 ↔ Make-host React incompatibility ('fg' crash).
 *
 * Architecture
 * ────────────
 * A single imperative `createScene()` creates the Three.js world and returns
 * a handle with three operations:
 *
 *   setData(blocks, solidUpTo, glassUpTo, onProgress)
 *     ↳ update which blocks array and precomputed index tables the scene uses
 *
 *   rebuild(count)
 *     ↳ full redraw of blocks[0..count-1] — clears highlights, resets meshes
 *
 *   addBlock()
 *     ↳ incremental: appends exactly one block in yellow, then fades to its
 *       final colour over HIGHLIGHT_DUR seconds.  Never touches earlier blocks.
 *
 * Two InstancedMeshes (solid + glass) keep draw calls to 2 regardless of block
 * count. Pre-allocated to 500 k solid / 50 k glass.
 *
 * Usage
 * ─────
 *   const ref = useRef<BuildingRendererHandle>(null)
 *
 *   <BuildingRenderer
 *     ref={ref}
 *     building={{ totalBlocks, completedBlocks, blocks }}
 *     onProgressChange={n => setCompletedBlocks(n)}
 *   />
 *
 *   ref.current?.addBlock()   // reveal + highlight next block
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface Block {
  x: number
  y: number
  z: number
  /** Semantic name used to look up a default colour when `color` is absent. */
  type: string
  /** Hex number (0xRRGGBB) or "0xRRGGBB" string. */
  color?: number | string
}

export interface Building {
  totalBlocks: number
  /** Drives `visibleBlocks = blocks.slice(0, completedBlocks)`. */
  completedBlocks: number
  blocks: Block[]
}

export interface BuildingRendererHandle {
  /** Reveal the next block with a 2 s yellow highlight. */
  addBlock: () => void
}

export interface BuildingRendererProps {
  building: Building
  /** Called when `addBlock()` increments the counter; lets the parent sync. */
  onProgressChange?: (completedBlocks: number) => void
  style?: React.CSSProperties
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────────────────────────────────────────

const GLASS_HEX      = 0x90c8d8
const HIGHLIGHT_HEX  = 0xffff44
const HIGHLIGHT_DUR  = 2.0   // seconds

const TYPE_COLORS: Record<string, number> = {
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

function resolveColor(b: Block): number {
  if (b.color !== undefined) {
    return typeof b.color === "number"
      ? b.color
      : parseInt(String(b.color).replace(/^0x/i, ""), 16)
  }
  return TYPE_COLORS[b.type] ?? 0x888888
}

const isGlass = (b: Block) => resolveColor(b) === GLASS_HEX

// ─────────────────────────────────────────────────────────────────────────────
// Block-face texture (module-level singleton, shared across all instances)
// Edge-darkening bevel + per-pixel grain; multiplies with per-instance colour.
// ─────────────────────────────────────────────────────────────────────────────

function buildBlockTexture(): THREE.CanvasTexture {
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

const BLOCK_TEX = buildBlockTexture()

// ─────────────────────────────────────────────────────────────────────────────
// Index helper
// ─────────────────────────────────────────────────────────────────────────────

/** For each original block index i, how many solid/glass blocks precede it. */
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
// Imperative scene
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SOLID = 500_000
const MAX_GLASS =  50_000

type HighlightEntry = { origIdx: number; startTime: number }

interface SceneHandle {
  /** Update the blocks array and index tables the scene references. */
  setData(
    blocks: Block[],
    solidUpTo: Int32Array,
    glassUpTo: Int32Array,
    onProgress: ((n: number) => void) | undefined
  ): void
  /** Full rebuild: renders blocks[0..count-1], clears all highlights. */
  rebuild(count: number): void
  /** Incremental: adds one block, highlights it, fires onProgress. */
  addBlock(): void
  getVisibleCount(): number
  dispose(): void
}

function createScene(container: HTMLDivElement): SceneHandle {
  // ── Renderer ────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1)
  container.appendChild(renderer.domElement)
  renderer.domElement.style.display = "block"

  // ── Scene & camera ──────────────────────────────────────────────────────
  const scene = new THREE.Scene()
  scene.background = new THREE.Color("#87ceeb")
  scene.fog = new THREE.Fog(0xc5e8f7, 250, 800)

  const camera = new THREE.PerspectiveCamera(50, (container.clientWidth || 1) / (container.clientHeight || 1), 0.5, 4000)
  camera.position.set(20, 28, -40)

  // ── Controls ────────────────────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping     = true
  controls.dampingFactor     = 0.08
  controls.minDistance       = 4
  controls.maxDistance       = 900
  controls.maxPolarAngle     = Math.PI / 2 - 0.02
  controls.panSpeed          = 1.2
  controls.rotateSpeed       = 0.65
  controls.zoomSpeed         = 1.2
  controls.screenSpacePanning = false
  controls.target.set(0, 8, 0)
  controls.update()

  // ── Lights ──────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a6b4a, 0.7))
  scene.add(new THREE.AmbientLight(0xffffff, 0.45))
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.4)
  sun.position.set(120, 200, -90)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0xccddff, 0.35)
  fill.position.set(-80, 60, 80)
  scene.add(fill)

  // ── Ground & grid ───────────────────────────────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(512, 512)
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x6b8f5e })
  const ground    = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const grid = new THREE.GridHelper(512, 512, 0x3a6032, 0x4a7a42)
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity     = 0.35
  grid.position.y = 0.02
  scene.add(grid)

  // ── Voxel meshes ────────────────────────────────────────────────────────
  const voxelGeo = new THREE.BoxGeometry(1, 1, 1)

  const solidMat  = new THREE.MeshLambertMaterial({ map: BLOCK_TEX })
  const solidMesh = new THREE.InstancedMesh(voxelGeo, solidMat, MAX_SOLID)
  solidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  solidMesh.count        = 0
  solidMesh.frustumCulled = false
  scene.add(solidMesh)

  const glassMat  = new THREE.MeshPhongMaterial({
    color:      GLASS_HEX,
    transparent: true,
    opacity:    0.38,
    shininess:  160,
    specular:   new THREE.Color(0xc8eeff),
    depthWrite: false,
    side:       THREE.DoubleSide,
  })
  const glassMesh = new THREE.InstancedMesh(voxelGeo, glassMat, MAX_GLASS)
  glassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  glassMesh.count        = 0
  glassMesh.frustumCulled = false
  glassMesh.renderOrder   = 1
  scene.add(glassMesh)

  // ── Working objects ─────────────────────────────────────────────────────
  const dummy    = new THREE.Object3D()
  const hlColor  = new THREE.Color(HIGHLIGHT_HEX)
  const finColor = new THREE.Color()
  const highlights = new Map<number, HighlightEntry>()

  // ── Mutable data references (updated via setData) ───────────────────────
  let _blocks: Block[]                       = []
  let _solidUpTo: Int32Array                 = new Int32Array(1)
  let _glassUpTo: Int32Array                 = new Int32Array(1)
  let _onProgress: ((n: number) => void) | undefined
  let _visibleCount                          = 0

  // ── Resize ───────────────────────────────────────────────────────────────
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth  || 1
    const h = container.clientHeight || 1
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })
  ro.observe(container)

  // ── Render loop (highlight animation lives here) ─────────────────────────
  let rafId = 0
  const animate = () => {
    rafId = requestAnimationFrame(animate)
    controls.update()

    if (highlights.size > 0) {
      const now = performance.now() / 1000
      let dirty = false

      for (const [si, { origIdx, startTime }] of highlights) {
        const elapsed = now - startTime

        if (elapsed >= HIGHLIGHT_DUR) {
          solidMesh.setColorAt(si, finColor.set(resolveColor(_blocks[origIdx])))
          highlights.delete(si)
          dirty = true
        } else {
          // Smoothstep: yellow → final colour
          const t      = elapsed / HIGHLIGHT_DUR
          const smooth = t * t * (3 - 2 * t)
          hlColor.set(HIGHLIGHT_HEX)
          finColor.set(resolveColor(_blocks[origIdx]))
          solidMesh.setColorAt(si, hlColor.lerp(finColor, smooth))
          dirty = true
        }
      }

      if (dirty && solidMesh.instanceColor) solidMesh.instanceColor.needsUpdate = true
    }

    renderer.render(scene, camera)
  }
  animate()

  // ── Handle ───────────────────────────────────────────────────────────────
  return {
    setData(blocks, solidUpTo, glassUpTo, onProgress) {
      _blocks    = blocks
      _solidUpTo = solidUpTo
      _glassUpTo = glassUpTo
      _onProgress = onProgress
    },

    rebuild(count) {
      const target = Math.min(count, _blocks.length)
      _visibleCount = target
      highlights.clear()

      let si = 0, gi = 0
      for (let i = 0; i < target; i++) {
        const b = _blocks[i]
        dummy.position.set(b.x, b.y + 0.5, b.z)
        dummy.updateMatrix()
        if (isGlass(b)) {
          if (gi < MAX_GLASS) glassMesh.setMatrixAt(gi++, dummy.matrix)
        } else {
          if (si < MAX_SOLID) {
            solidMesh.setMatrixAt(si, dummy.matrix)
            solidMesh.setColorAt(si++, finColor.set(resolveColor(b)))
          }
        }
      }

      solidMesh.count = si
      glassMesh.count = gi
      solidMesh.instanceMatrix.needsUpdate = true
      glassMesh.instanceMatrix.needsUpdate = true
      if (solidMesh.instanceColor) solidMesh.instanceColor.needsUpdate = true
    },

    addBlock() {
      const i = _visibleCount
      if (i >= _blocks.length) return

      const b = _blocks[i]
      _visibleCount = i + 1

      dummy.position.set(b.x, b.y + 0.5, b.z)
      dummy.updateMatrix()

      if (isGlass(b)) {
        const gi = _glassUpTo[i]
        glassMesh.setMatrixAt(gi, dummy.matrix)
        glassMesh.count = Math.max(glassMesh.count, gi + 1)
        glassMesh.instanceMatrix.needsUpdate = true
      } else {
        const si = _solidUpTo[i]
        solidMesh.setMatrixAt(si, dummy.matrix)
        solidMesh.setColorAt(si, hlColor.set(HIGHLIGHT_HEX))
        solidMesh.count = Math.max(solidMesh.count, si + 1)
        solidMesh.instanceMatrix.needsUpdate = true
        if (solidMesh.instanceColor) solidMesh.instanceColor.needsUpdate = true
        highlights.set(si, { origIdx: i, startTime: performance.now() / 1000 })
      }

      _onProgress?.(i + 1)
    },

    getVisibleCount() { return _visibleCount },

    dispose() {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      controls.dispose()
      voxelGeo.dispose()
      solidMat.dispose()
      glassMat.dispose()
      groundGeo.dispose()
      groundMat.dispose()
      grid.geometry.dispose()
      ;(grid.material as THREE.Material).dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// React component
// ─────────────────────────────────────────────────────────────────────────────

export const BuildingRenderer = forwardRef<
  BuildingRendererHandle,
  BuildingRendererProps
>(function BuildingRenderer({ building, onProgressChange, style, className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef     = useRef<SceneHandle | null>(null)

  // Pre-compute index tables whenever the blocks array reference changes
  const { solidUpTo, glassUpTo } = useMemo(
    () => computeUpTo(building.blocks),
    [building.blocks]
  )

  // ── Init scene once ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const s = createScene(el)
    sceneRef.current = s
    return () => { s.dispose(); sceneRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep scene's data references current ──────────────────────────────────
  // Runs after init (effects fire in order), so scene is guaranteed to exist.
  useEffect(() => {
    sceneRef.current?.setData(building.blocks, solidUpTo, glassUpTo, onProgressChange)
  }, [building.blocks, solidUpTo, glassUpTo, onProgressChange])

  // ── Full rebuild when completedBlocks changes from outside ────────────────
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    const target = Math.min(building.completedBlocks, building.blocks.length)
    // Skip rebuild if this change was triggered by our own addBlock() call
    if (target === s.getVisibleCount()) return
    s.rebuild(target)
  }, [building.completedBlocks, building.blocks.length])

  // ── Expose addBlock() via ref ─────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    addBlock() { sceneRef.current?.addBlock() },
  }))

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", ...style }}
      className={className}
    />
  )
})

export default BuildingRenderer
