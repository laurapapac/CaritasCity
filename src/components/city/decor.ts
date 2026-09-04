/**
 * Static environment decor — parks, lakes, roads, roadside/park trees. Purely
 * visual, built once from a CityDecor (see src/data/cityDecor.ts +
 * src/data/cityRoads.ts) and added to the shared scene as a single disposable
 * THREE.Group — no per-frame updates, no gameplay/DB tie-in.
 *
 * Y-stacking (bottom to top): ground(0) < grid(0.05, cityScene.ts) <
 * roads(0.10) < plazas(0.12) < parks(0.15) < beaches(0.17) < lakes(0.20).
 * Keep every layer at least ~0.02 apart — cramming them closer (an earlier
 * version had roads and the grid at the identical y=0.02) is what caused
 * z-fighting/flicker at long camera distances, fixed alongside
 * logarithmicDepthBuffer in cityScene.ts. All values stay far under the
 * ~1-unit building-foundation floor.
 *
 * Parks/lakes shape overhaul (2026-08-11): parks render as a merged rectangle
 * per block tile (ParkShape.tiles, following the block grid instead of a
 * disc); lakes render as a THREE.Shape traced from an organic blob outline
 * (LakeShape.points) instead of a circle. See cityDecor.ts's doc comment for
 * why (matches user's reference image). No fountains — added, then removed
 * again at the user's request in the same follow-up round (a different,
 * hand-placed voxel fountain landmark was added later, see
 * buildingGenerators.ts's generateFountain).
 *
 * Beaches (2026-08-12): a plain rect (BeachShape, like a park tile) filling
 * a lake's block minus road clearance, rendered under the lake — the lake's
 * own smaller, organic (and for lake_east, elliptical + rotated) shape
 * naturally covers the middle, leaving a ring whose width varies around the
 * lake rather than a uniform band. See generateCityLayout.ts's lake_east
 * doc comment for the sizing logic (lake_east only, so far).
 *
 * Ground textures (2026-08-12): parks and beaches use small procedural
 * CanvasTextures (buildGrassTexture/buildStoneTexture) instead of a flat
 * fill color, repeated via THREE.RepeatWrapping at real-world density
 * (TEXTURE_TILE_UNITS) — see scaleUV's doc comment for why the UV scaling
 * has to happen before mergeGeometries. No image assets involved; both are
 * drawn on an offscreen <canvas> at startup with a seeded PRNG so the
 * pattern is stable across reloads.
 *
 * Tree canopies (2026-08-13): canopies are small stepped stacks of cube
 * blocks (CanopyShape) instead of a smooth SphereGeometry/ConeGeometry, for
 * a chunkier "Minecraft-style" look matching the buildings' own blocky
 * voxel aesthetic — see buildTreeTypes' doc comment. Trunk geometry and
 * every tree's (x,z) position are unchanged.
 *
 * World terrain (2026-08-13, same-day follow-up): grass buffer, low rolling
 * hills, distant mountains past the city — replaces a rejected first
 * attempt (a mountain ring placed close to the city that read as "closed
 * off and claustrophobic"). See generateCityLayout.ts's "World terrain"
 * section for the generation-side design rationale. buildGroundGroup
 * replaces cityScene.ts's old inline flat-plane-and-square-grid ground with
 * a grey inner disc (city, unchanged look) + a large gradient ring that
 * fades grey → grass → haze → fog-color with radius, so the world's outer
 * edge is rendered as sky-colored rather than merely faded by fog (works at
 * any camera angle or fog setting). buildHillsMesh/buildMountainsMesh use
 * absolute per-instance colors (material color left white, InstancedMesh
 * .setColorAt carries the real RGB) rather than the tree canopies'
 * multiplicative shadeForLayer tint, since both need genuine color
 * blending toward the fog color for atmospheric perspective, not just a
 * ±12% brightness nudge.
 *
 * Road/floor textures (2026-09-04): roads and the city's own grey ground
 * disc — the only two remaining flat-color surfaces — now use procedural
 * CanvasTextures too (buildAsphaltTexture/buildConcreteTexture), same
 * technique as the parks/beaches above. Roads get a dashed centerline +
 * wheel-wear bands; the ground disc gets mottled speckle + a slab-joint
 * grid. Base colors are unchanged (asphalt/concrete tones match the old
 * flat fills), this only adds visible texture.
 */

import * as THREE from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import type { CityDecor, MeadowShape, MountainPeak, OrientedMarker, TerrainData } from "./types"
import { BLOCK_TEX } from "./utils"

const LAKE_COLOR = 0x3a7bd5
const BUSH_COLOR = 0x3d7a3f
const LAMP_POLE_COLOR = 0x2b2b2b
const LAMP_HEAD_COLOR = 0xffd98a
const BENCH_COLOR = 0x8a5a3a
const PLAZA_COLOR = 0x9a9086

// ── Procedural ground textures (2026-08-12, user request: "add some texture
// to the beach... and the grass floor in the parks so it doesn't look
// plain") — small tileable canvases generated once at startup and repeated
// via THREE.RepeatWrapping, instead of loading image assets (no texture
// asset pipeline exists in this project yet, and these are simple enough to
// draw procedurally). A seeded PRNG keeps the pattern stable across reloads
// rather than reshuffling every time the scene builds.
function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// World-space size (in units) one texture tile covers — how far apart UV
// scaling repeats the canvas across a park/beach's real-world footprint.
// `road` is the tile's length along the direction of travel — its width
// axis is never scaled (see the road-building loop below, it always spans
// exactly one tile across the real ROAD_WIDTH). `floor` is the concrete
// disc's slab size.
const TEXTURE_TILE_UNITS = { grass: 6, beach: 5, road: 8, floor: 6 }

function buildStoneTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#d9d9d9"
  ctx.fillRect(0, 0, size, size)
  const rand = mulberry32(20260812)
  for (let i = 0; i < 260; i++) {
    const x = rand() * size, y = rand() * size
    const rx = 1.2 + rand() * 2.4
    const ry = rx * (0.7 + rand() * 0.5)
    const shade = 172 + Math.floor(rand() * 58)
    ctx.fillStyle = `rgb(${shade},${shade},${shade - 3})`
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

function buildGrassTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#4f8f3f"
  ctx.fillRect(0, 0, size, size)
  const rand = mulberry32(20260813)
  for (let i = 0; i < 420; i++) {
    const x = rand() * size, y = rand() * size
    const len = 2 + rand() * 4.5
    const angle = -Math.PI / 2 + (rand() - 0.5) * 0.9
    ctx.strokeStyle = rand() < 0.55 ? "rgba(35,70,25,0.4)" : "rgba(150,205,95,0.4)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// Roads and the city's own ground disc (2026-09-04, user request: both read
// as "a plain color" — texture them like parks/beaches already are). Same
// procedural-canvas-plus-RepeatWrapping technique as buildStoneTexture/
// buildGrassTexture above, just two new patterns.
//
// The canvas is deliberately non-square (2:1) to match a road tile's real
// aspect ratio (TEXTURE_TILE_UNITS.road long × ROAD_WIDTH wide) — only the
// length axis (U) ever gets repeat-scaled (see the road-building loop
// below), so V always spans exactly one tile across the real road width,
// which is what keeps the dashed centerline drawn at v=0.5 sitting on the
// actual center of every segment regardless of that segment's own length.
// The single centered dash (with the gap split evenly at the tile's left/
// right edges) is what makes the dash pattern tile seamlessly instead of
// doubling up or leaving an odd-width dash at each repeat boundary.
function buildAsphaltTexture(): THREE.CanvasTexture {
  const w = 256, h = 128
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#54585c"
  ctx.fillRect(0, 0, w, h)

  const rand = mulberry32(20260904)
  for (let i = 0; i < 900; i++) {
    const x = rand() * w, y = rand() * h
    const r = 0.5 + rand() * 1.3
    const shade = 60 + Math.floor(rand() * 40)
    ctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 4},0.5)`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Wheel-wear tracks — two faint darker bands where tires travel, purely
  // cosmetic (not tied to any real lane math).
  ctx.fillStyle = "rgba(30,32,34,0.18)"
  ctx.fillRect(0, h * 0.18, w, h * 0.14)
  ctx.fillRect(0, h * 0.68, w, h * 0.14)

  // Dashed centerline.
  ctx.fillStyle = "#ded6a8"
  ctx.fillRect(w * 0.25, h * 0.47, w * 0.5, h * 0.06)

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// Subtle mottled slab pattern for the ground disc — same speckle technique
// as buildStoneTexture, lower contrast (it's meant to read as "textured
// concrete," not gravel), plus a joint line drawn only along the tile's own
// top/left edge so repeating it produces one continuous slab grid instead of
// doubled-up lines at every seam.
function buildConcreteTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#b7b9ba"
  ctx.fillRect(0, 0, size, size)

  const rand = mulberry32(20260905)
  for (let i = 0; i < 500; i++) {
    const x = rand() * size, y = rand() * size
    const r = 0.6 + rand() * 1.6
    const shade = 150 + Math.floor(rand() * 55)
    ctx.fillStyle = `rgba(${shade},${shade},${shade + 1},0.35)`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = "rgba(100,100,98,0.55)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 0); ctx.lineTo(size, 0)
  ctx.moveTo(0, 0); ctx.lineTo(0, size)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// Scales an existing PlaneGeometry's UVs so a repeating texture tiles at a
// real-world density instead of stretching one full texture across the
// whole plane — must run before mergeGeometries flattens multiple tiles'
// UVs into one buffer.
function scaleUV(geo: THREE.BufferGeometry, repeatX: number, repeatY: number): void {
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * repeatX, uv.getY(i) * repeatY)
  }
  uv.needsUpdate = true
}

// Deterministic hash of a tree's own position → [0,1), so type/scale choices
// are stable across renders (same layout always looks the same) without
// needing to store a random seed per tree in the generated data — same
// "position is a fixed design decision" spirit as everything else here.
function hash2D(x: number, z: number, salt: number): number {
  const h = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453
  return h - Math.floor(h)
}

// A canopy is a small stepped stack of cube blocks instead of a smooth
// primitive (2026-08-13, user request: treetops "made out of voxel blocks
// ... give them dimension", explicitly picked the chunky ~8-14-cube
// "Minecraft-style" look over a finer ~20-30-cube voxel-sphere approximation)
// — same shared-BoxGeometry instancing discipline cityScene.ts already uses
// for building voxels, just applied to canopies. `offsets` are integer
// cube-grid coordinates relative to the canopy's own local origin (dy=0 is
// the bottom layer, increasing upward); `baseY` is the world Y of the dy=0
// layer's cube centers, picked per type so the stack's vertical center lands
// close to that type's old sphere/cone center — swapping the primitive
// shouldn't noticeably shift a tree's silhouette on the map.
interface CanopyShape {
  cubeSize: number
  baseY: number
  offsets: { dx: number; dy: number; dz: number }[]
}

interface TreeType {
  trunkGeo: THREE.BufferGeometry
  trunkMat: THREE.Material
  trunkY: number
  canopy: CanopyShape
  foliageMat: THREE.Material
}

// 3×3-footprint cross (corners omitted) — the base layer shape reused by
// most canopies below, so a 2-layer "same shape twice" stack still reads as
// a chunky blob rather than a perfect cube.
const CROSS_LAYER: { dx: number; dz: number }[] = [
  { dx: 0, dz: 0 }, { dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
]

function layerOffsets(dy: number, layer: { dx: number; dz: number }[]): { dx: number; dy: number; dz: number }[] {
  return layer.map((c) => ({ ...c, dy }))
}

// 5 tree types, spring palette, weighted mostly deciduous (only the last —
// the conifer — is a minority "for variety" type, matching the user's
// "mostly deciduous... let's act like it's spring" request). Weights must
// sum to 1 and stay in the same order as TREE_TYPE_WEIGHTS below.
//
// Birch's old non-uniform foliageScale (stretching a sphere into an
// ellipsoid) is dropped in favor of shaping its cube stack itself
// narrower/taller — stretching cubes anisotropically would read as slabs,
// not blocks.
//
// Canopy cubes get BLOCK_TEX (2026-08-27, user request — treetop voxels read
// as flat solid color next to the buildings' own textured blocks). Same
// texture/material technique cityScene.ts already uses for building voxels
// (utils.ts's makeBlockTexture: per-face edge bevel + grain, multiplied with
// the material's base color) — colors themselves are unchanged, this only
// adds the map. Trunks are left plain (smooth CylinderGeometry, not a voxel
// shape, so the "chunky block" texture wouldn't make sense there).
function buildTreeTypes(): TreeType[] {
  const trunkBrown = new THREE.MeshLambertMaterial({ color: 0x6b4a2f })
  const trunkBirch = new THREE.MeshLambertMaterial({ color: 0xd9d3c1 })

  return [
    { // round deciduous, spring green — the common default tree
      trunkGeo: new THREE.CylinderGeometry(0.3, 0.4, 2, 6), trunkMat: trunkBrown, trunkY: 1,
      canopy: {
        cubeSize: 1.5, baseY: 2.1,
        offsets: [...layerOffsets(0, CROSS_LAYER), ...layerOffsets(1, CROSS_LAYER), { dx: 0, dy: 2, dz: 0 }],
      },
      foliageMat: new THREE.MeshLambertMaterial({ color: 0x5a9c4a, map: BLOCK_TEX }),
    },
    { // flowering/blossom, soft pink — the "it's spring" tree, same blob shape as deciduous
      trunkGeo: new THREE.CylinderGeometry(0.28, 0.36, 2, 6), trunkMat: trunkBrown, trunkY: 1,
      canopy: {
        cubeSize: 1.4, baseY: 2.0,
        offsets: [...layerOffsets(0, CROSS_LAYER), ...layerOffsets(1, CROSS_LAYER), { dx: 0, dy: 2, dz: 0 }],
      },
      foliageMat: new THREE.MeshLambertMaterial({ color: 0xf0b6d2, map: BLOCK_TEX }),
    },
    { // fresh yellow-green deciduous, smaller/bushier — 2-layer stack, no cap
      trunkGeo: new THREE.CylinderGeometry(0.3, 0.4, 1.8, 6), trunkMat: trunkBrown, trunkY: 0.9,
      canopy: {
        cubeSize: 1.3, baseY: 2.45,
        offsets: [...layerOffsets(0, CROSS_LAYER), ...layerOffsets(1, CROSS_LAYER)],
      },
      foliageMat: new THREE.MeshLambertMaterial({ color: 0x9bcf55, map: BLOCK_TEX }),
    },
    { // birch — pale trunk, narrow/tall canopy (narrow via shape, not stretched cubes)
      trunkGeo: new THREE.CylinderGeometry(0.25, 0.3, 2.4, 6), trunkMat: trunkBirch, trunkY: 1.2,
      canopy: {
        cubeSize: 1.1, baseY: 2.05,
        offsets: [
          ...layerOffsets(0, CROSS_LAYER),
          { dx: 0, dy: 1, dz: 0 },
          { dx: 0, dy: 2, dz: 0 }, { dx: 1, dy: 2, dz: 0 }, { dx: -1, dy: 2, dz: 0 },
          { dx: 0, dy: 3, dz: 0 },
        ],
      },
      foliageMat: new THREE.MeshLambertMaterial({ color: 0xbadb8e, map: BLOCK_TEX }),
    },
    { // conifer — tiered pyramid (wide base tapering to a point), minority type
      trunkGeo: new THREE.CylinderGeometry(0.35, 0.5, 2, 6), trunkMat: trunkBrown, trunkY: 1,
      canopy: {
        cubeSize: 1.3, baseY: 1.8,
        offsets: [
          { dx: -1, dy: 0, dz: -1 }, { dx: 0, dy: 0, dz: -1 }, { dx: 1, dy: 0, dz: -1 },
          { dx: -1, dy: 0, dz: 0 }, { dx: 0, dy: 0, dz: 0 }, { dx: 1, dy: 0, dz: 0 },
          { dx: -1, dy: 0, dz: 1 }, { dx: 0, dy: 0, dz: 1 }, { dx: 1, dy: 0, dz: 1 },
          ...layerOffsets(1, CROSS_LAYER),
          { dx: 0, dy: 2, dz: 0 },
        ],
      },
      foliageMat: new THREE.MeshLambertMaterial({ color: 0x3a7a3f, map: BLOCK_TEX }),
    },
  ]
}

const TREE_TYPE_WEIGHTS = [0.30, 0.20, 0.20, 0.15, 0.15]

function pickTreeType(x: number, z: number): number {
  const r = hash2D(x, z, 1)
  let cumulative = 0
  for (let i = 0; i < TREE_TYPE_WEIGHTS.length; i++) {
    cumulative += TREE_TYPE_WEIGHTS[i]
    if (r < cumulative) return i
  }
  return TREE_TYPE_WEIGHTS.length - 1
}

// Cheap two-tone shade per cube layer (2026-08-13) — top layer ~12%
// lighter, bottom layer ~12% darker, middle layers unshaded — set via
// InstancedMesh.setColorAt (no material flags needed; three.js multiplies a
// Lambert material's base color by instanceColor automatically once it
// exists). Gives the stepped stack a subtle built-in ambient-occlusion feel
// instead of one flat color per tree, reinforcing the "dimension" the
// canopy shapes above are already going for.
const canopyShadeColor = new THREE.Color()
function shadeForLayer(dy: number, maxDy: number): THREE.Color {
  if (maxDy > 0 && dy === maxDy) return canopyShadeColor.setScalar(1.12)
  if (maxDy > 0 && dy === 0) return canopyShadeColor.setScalar(0.88)
  return canopyShadeColor.setScalar(1)
}

// Buckets every tree by type (deterministic per position), then builds one
// trunk InstancedMesh + one canopy InstancedMesh per type actually used —
// still just a handful of draw calls total (at most 2 × TREE_TYPE_WEIGHTS.length),
// not one per tree or one per cube. Each canopy InstancedMesh holds
// bucket.length * canopy.offsets.length instances (one shared unit
// BoxGeometry, one instance per cube per tree of that type — same pattern
// cityScene.ts uses for building voxels). Each tree also gets a small
// deterministic scale variation (0.85-1.15x, applied to both the trunk and
// every one of its canopy cubes) so same-type trees aren't perfectly
// identical clones.
//
// Optional per-tree `y` (2026-08-13, world terrain): every existing caller
// passes trees with no `y`, defaulting to 0 (ground level, unchanged
// behavior). Hill trees set it to their hill column's quantized top height,
// so trunks sit flush on a terraced step instead of floating/sinking by up
// to half a step if snapped to raw continuous noise instead.
function buildVariedTreesMesh(trees: { x: number; z: number; y?: number }[]): THREE.InstancedMesh[] {
  if (trees.length === 0) return []

  const types = buildTreeTypes()
  const buckets: { x: number; z: number; y?: number }[][] = types.map(() => [])
  for (const t of trees) buckets[pickTreeType(t.x, t.z)].push(t)

  const canopyCubeGeo = new THREE.BoxGeometry(1, 1, 1)
  const meshes: THREE.InstancedMesh[] = []
  const dummy = new THREE.Object3D()

  types.forEach((type, typeIndex) => {
    const bucket = buckets[typeIndex]
    if (bucket.length === 0) return

    const { cubeSize, baseY, offsets } = type.canopy
    const maxDy = offsets.reduce((m, o) => Math.max(m, o.dy), 0)
    const trunkMesh = new THREE.InstancedMesh(type.trunkGeo, type.trunkMat, bucket.length)
    const canopyMesh = new THREE.InstancedMesh(canopyCubeGeo, type.foliageMat, bucket.length * offsets.length)

    bucket.forEach((t, i) => {
      const scale = 0.85 + hash2D(t.x, t.z, 2) * 0.3
      const groundY = t.y ?? 0

      dummy.position.set(t.x, type.trunkY * scale + groundY, t.z)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      trunkMesh.setMatrixAt(i, dummy.matrix)

      offsets.forEach((o, j) => {
        dummy.position.set(
          t.x + o.dx * cubeSize * scale,
          (baseY + o.dy * cubeSize) * scale + groundY,
          t.z + o.dz * cubeSize * scale,
        )
        dummy.scale.setScalar(cubeSize * scale)
        dummy.updateMatrix()
        const cubeIndex = i * offsets.length + j
        canopyMesh.setMatrixAt(cubeIndex, dummy.matrix)
        canopyMesh.setColorAt(cubeIndex, shadeForLayer(o.dy, maxDy))
      })
    })

    trunkMesh.instanceMatrix.needsUpdate = true
    canopyMesh.instanceMatrix.needsUpdate = true
    if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true
    meshes.push(trunkMesh, canopyMesh)
  })

  return meshes
}

// Single flattened-sphere blob per bush — cheaper than a trunk+foliage tree,
// reads fine at the small scale bushes fill gaps at.
function buildBushesMesh(bushes: { x: number; z: number }[]): THREE.InstancedMesh | null {
  if (bushes.length === 0) return null

  const geo = new THREE.SphereGeometry(1.1, 6, 5)
  const mat = new THREE.MeshLambertMaterial({ color: BUSH_COLOR })
  const mesh = new THREE.InstancedMesh(geo, mat, bushes.length)

  const dummy = new THREE.Object3D()
  bushes.forEach((b, i) => {
    dummy.position.set(b.x, 0.7, b.z)
    dummy.scale.set(1, 0.7, 1)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  })
  mesh.instanceMatrix.needsUpdate = true

  return mesh
}

// Pole + light head, same two-InstancedMesh pattern as buildTreesMesh. Angle
// only matters visually for asymmetric geometry, but applying it uniformly
// is free and keeps every filler-decor type consistent.
function buildLampPostsMesh(lamps: OrientedMarker[]): [THREE.InstancedMesh, THREE.InstancedMesh] | null {
  if (lamps.length === 0) return null

  const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 4, 6)
  const poleMat = new THREE.MeshLambertMaterial({ color: LAMP_POLE_COLOR })
  const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, lamps.length)

  const headGeo = new THREE.SphereGeometry(0.35, 8, 6)
  const headMat = new THREE.MeshLambertMaterial({ color: LAMP_HEAD_COLOR, emissive: 0x554015 })
  const headMesh = new THREE.InstancedMesh(headGeo, headMat, lamps.length)

  const dummy = new THREE.Object3D()
  lamps.forEach((lamp, i) => {
    dummy.position.set(lamp.x, 2, lamp.z)
    dummy.rotation.y = lamp.angle
    dummy.updateMatrix()
    poleMesh.setMatrixAt(i, dummy.matrix)

    dummy.position.set(lamp.x, 4.1, lamp.z)
    dummy.updateMatrix()
    headMesh.setMatrixAt(i, dummy.matrix)
  })
  poleMesh.instanceMatrix.needsUpdate = true
  headMesh.instanceMatrix.needsUpdate = true

  return [poleMesh, headMesh]
}

// Seat + backrest, both facing `angle` (computed at generation time to face
// toward the block's buildings — see generateBenches).
function buildBenchesMesh(benches: OrientedMarker[]): [THREE.InstancedMesh, THREE.InstancedMesh] | null {
  if (benches.length === 0) return null

  const seatGeo = new THREE.BoxGeometry(1.6, 0.15, 0.5)
  const seatMat = new THREE.MeshLambertMaterial({ color: BENCH_COLOR })
  const seatMesh = new THREE.InstancedMesh(seatGeo, seatMat, benches.length)

  const backGeo = new THREE.BoxGeometry(1.6, 0.5, 0.1)
  const backMat = new THREE.MeshLambertMaterial({ color: BENCH_COLOR })
  const backMesh = new THREE.InstancedMesh(backGeo, backMat, benches.length)

  const dummy = new THREE.Object3D()
  benches.forEach((bench, i) => {
    dummy.position.set(bench.x, 0.45, bench.z)
    dummy.rotation.y = bench.angle
    dummy.updateMatrix()
    seatMesh.setMatrixAt(i, dummy.matrix)

    const backOffsetX = -Math.sin(bench.angle) * 0.2
    const backOffsetZ = -Math.cos(bench.angle) * 0.2
    dummy.position.set(bench.x + backOffsetX, 0.7, bench.z + backOffsetZ)
    dummy.updateMatrix()
    backMesh.setMatrixAt(i, dummy.matrix)
  })
  seatMesh.instanceMatrix.needsUpdate = true
  backMesh.instanceMatrix.needsUpdate = true

  return [seatMesh, backMesh]
}

// ── World terrain rendering (2026-08-13) ──────────────────────────────────

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// Same color the fog is set to in cityScene.ts (scene.fog color, kept in
// sync there) — used here so hills/mountains/the ground rim can bake
// atmospheric-perspective blending directly into their vertex colors,
// working correctly even with fog disabled (e.g. DevCityPreview) or at
// close camera distances fog barely touches.
const FOG_TINT_COLOR = new THREE.Color(0xc5e8f7)

const GROUND_GREY       = new THREE.Color(0xb3b5b6) // matches the old flat ground color exactly
const GROUND_GRASS_EDGE = new THREE.Color(0x7f9a6e)
const GROUND_GRASS_FULL = new THREE.Color(0x86a874)
const GROUND_HAZY       = new THREE.Color(0x9dbcc9)

// Radial color for the ground ring — grey (matching the city's own ground)
// blends into grass, holds, then desaturates toward the fog color so the
// world's outer rim is rendered as sky-colored rather than merely faded by
// distance fog (which alone can't hide a flat edge from an oblique/top-down
// angle where the edge itself isn't far from the camera — the actual
// lesson from the rejected mountain-ring attempt). blendStart/blendEnd are
// the grey-disc-relative offsets (see buildGroundGroup) — the later bands
// (900/1300/2000) are pure distant-terrain aesthetics, unrelated to the
// city's own size, so they stay fixed.
function groundColorAt(radius: number, blendStart: number, blendEnd: number, out: THREE.Color): THREE.Color {
  if (radius < blendEnd) return out.copy(GROUND_GREY).lerp(GROUND_GRASS_EDGE, smoothstep(blendStart, blendEnd, radius))
  if (radius < 900) return out.copy(GROUND_GRASS_EDGE).lerp(GROUND_GRASS_FULL, smoothstep(blendEnd, 450, radius))
  if (radius < 1300) return out.copy(GROUND_GRASS_FULL).lerp(GROUND_HAZY, smoothstep(900, 1300, radius))
  return out.copy(GROUND_HAZY).lerp(FOG_TINT_COLOR, smoothstep(1300, 2000, radius))
}

// Replaces cityScene.ts's old flat PlaneGeometry(800,800) + square
// GridHelper: an inner grey disc (same color/material as the old ground —
// the city's own ground literally doesn't change) plus a large gradient
// ring carrying the radial color fade above. GridHelper is dropped
// entirely rather than shrunk — its own square boundary was part of what
// read as "the rectangular edge" in the first place (confirmed with user),
// and roads/parks/plazas/terrain already give plenty of spatial reference
// without it.
//
// `cityEdge` (TERRAIN_BANDS.cityEdge from cityTerrain.ts, passed in by the
// caller) is the generator's own verified city boundary — the disc radius
// is derived from it (+10, the same margin the original hardcoded 360 had
// over the old cityEdge of 350) rather than hardcoded, so this can't go
// stale again the way it did in the 2026-08-19 city-expansion rebalance:
// cityEdge grew 350→450 but this disc stayed a literal 360, leaving real
// building/tree geometry (measured extent up to ~390) poking out past the
// concrete onto bare grass.
const GROUND_DISC_MARGIN = 10
const GROUND_BLEND_MARGIN = 5
const GROUND_BLEND_WIDTH = 25

export function buildGroundGroup(cityEdge = 450): THREE.Group {
  const group = new THREE.Group()
  group.name = "ground"

  const discRadius = cityEdge + GROUND_DISC_MARGIN
  const blendStart = cityEdge + GROUND_BLEND_MARGIN
  const blendEnd = blendStart + GROUND_BLEND_WIDTH

  const innerGeo = new THREE.CircleGeometry(discRadius, 96)
  // CircleGeometry's own UV already maps the full diameter to [0,1] on both
  // axes, so scaleUV's usual "repeat = span / tileUnit" works unchanged even
  // though this isn't a plane.
  scaleUV(innerGeo, (2 * discRadius) / TEXTURE_TILE_UNITS.floor, (2 * discRadius) / TEXTURE_TILE_UNITS.floor)
  const innerMat = new THREE.MeshLambertMaterial({ map: buildConcreteTexture() })
  const inner = new THREE.Mesh(innerGeo, innerMat)
  inner.rotation.x = -Math.PI / 2
  group.add(inner)

  const ringGeo = new THREE.RingGeometry(blendStart, 2000, 128, 48)
  ringGeo.rotateX(-Math.PI / 2)
  const avgCircumference = 2 * Math.PI * ((blendStart + 2000) / 2)
  scaleUV(ringGeo, avgCircumference / TEXTURE_TILE_UNITS.grass, (2000 - blendStart) / TEXTURE_TILE_UNITS.grass)

  const pos = ringGeo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    groundColorAt(Math.hypot(pos.getX(i), pos.getZ(i)), blendStart, blendEnd, c)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  ringGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3))

  const ringMat = new THREE.MeshLambertMaterial({ map: buildGrassTexture(), vertexColors: true })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.position.y = 0.03
  group.add(ring)

  return group
}

const HILL_BASE_COLOR = new THREE.Color(0x5d8f4a)

// Expands the flat [gx,gz,level,...] array into one flat-topped voxel
// "column" InstancedMesh instance per cell (a non-uniform-Y-scaled shared
// unit cube, not stacked layers — see cityTerrain.ts's doc comment for why
// this stays a flat array). Each column's color: a level-based
// lighter/darker tint (same shadeForLayer-style idea as tree canopies, just
// computed as an absolute color here) then lerped toward the fog color
// past ~950 radius so the outer hills visibly desaturate into haze — this
// happens on top of (not instead of) scene.fog, and works even with fog
// disabled.
function buildHillsMesh(terrain: TerrainData): THREE.InstancedMesh | null {
  const { cellSize, step, hillColumns, bands } = terrain
  const count = hillColumns.length / 3
  if (count === 0) return null

  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const mesh = new THREE.InstancedMesh(geo, mat, count)

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  const fadeStart = bands.hillsOuter - 200
  const fadeEnd = bands.hillsOuter

  for (let i = 0; i < count; i++) {
    const gx = hillColumns[i * 3]
    const gz = hillColumns[i * 3 + 1]
    const level = hillColumns[i * 3 + 2]
    const x = gx * cellSize
    const z = gz * cellSize
    const height = level * step

    dummy.position.set(x, height / 2, z)
    dummy.scale.set(cellSize, height, cellSize)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)

    color.copy(HILL_BASE_COLOR).multiplyScalar(0.88 + level * 0.06)
    color.lerp(FOG_TINT_COLOR, smoothstep(fadeStart, fadeEnd, Math.hypot(x, z)) * 0.75)
    mesh.setColorAt(i, color)
  }

  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  return mesh
}

const MOUNTAIN_BASE_COLOR  = new THREE.Color(0x8fa3b5) // desaturated blue-grey — atmospheric perspective baked in, not realistic rock color
const MOUNTAIN_LIGHT_COLOR = new THREE.Color(0xb9c9d8)
const MOUNTAIN_FOG_LERP    = 0.55 // baked in at generation-independent render time — see module doc comment

// A tapering diamond-footprint stack, same technique as a tree canopy's
// conifer shape (decor.ts's buildTreeTypes) just at mountain scale — level L
// has footprint radius `levels - L`. ~25% of each level's OUTER (diamond
// -edge) cells are dropped, deterministically per peak via its own `seed`,
// so silhouettes are irregular and no two peaks look identical despite
// sharing the same generation formula.
function mountainPeakOffsets(levels: number, seed: number): { dx: number; dy: number; dz: number }[] {
  const offsets: { dx: number; dy: number; dz: number }[] = []
  for (let dy = 0; dy < levels; dy++) {
    const r = levels - dy
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > r) continue
        const isEdge = r > 0 && Math.abs(dx) + Math.abs(dz) === r
        if (isEdge && hash2D(seed + dx * 13 + dz * 31, dy * 97 + seed, 7) < 0.25) continue
        offsets.push({ dx, dy, dz })
      }
    }
  }
  return offsets
}

// Distant mountain backdrop — same stepped-pyramid cube technique the
// rejected first attempt used (that part was never the problem — see
// generateCityLayout.ts's "World terrain" doc comment for what actually
// was: proximity and lack of real gaps). Colors are absolute (material left
// white) so the fog-lerp is a genuine blend, not a multiplicative tint —
// this is what keeps peaks reading as background regardless of camera angle
// or fog state, rather than relying on scene.fog alone.
function buildMountainsMesh(peaks: MountainPeak[]): THREE.InstancedMesh | null {
  if (peaks.length === 0) return null

  const perPeakOffsets = peaks.map((p) => mountainPeakOffsets(p.levels, p.seed))
  const totalCubes = perPeakOffsets.reduce((sum, o) => sum + o.length, 0)
  if (totalCubes === 0) return null

  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const mesh = new THREE.InstancedMesh(geo, mat, totalCubes)

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let cubeIndex = 0

  peaks.forEach((peak, pi) => {
    const offsets = perPeakOffsets[pi]
    const maxDy = Math.max(1, peak.levels - 1)

    for (const o of offsets) {
      dummy.position.set(
        peak.x + o.dx * peak.cubeSize,
        (o.dy + 0.5) * peak.cubeSize,
        peak.z + o.dz * peak.cubeSize,
      )
      dummy.scale.setScalar(peak.cubeSize)
      dummy.updateMatrix()
      mesh.setMatrixAt(cubeIndex, dummy.matrix)

      color.copy(MOUNTAIN_BASE_COLOR).lerp(MOUNTAIN_LIGHT_COLOR, o.dy / maxDy)
      color.lerp(FOG_TINT_COLOR, MOUNTAIN_FOG_LERP)
      mesh.setColorAt(cubeIndex, color)
      cubeIndex++
    }
  })

  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  return mesh
}

const MEADOW_COLOR = 0x6ea355

// A handful of organic color-variation patches across the grass buffer,
// same THREE.Shape-from-blob-outline technique decor.lakes already uses —
// just a flat solid color (no water material) at a low y (0.05) so it reads
// as a subtle ground-color variation, not a new "zone."
function buildMeadowsMesh(meadows: MeadowShape[]): THREE.Mesh | null {
  const geometries: THREE.BufferGeometry[] = []
  for (const meadow of meadows) {
    if (meadow.points.length < 3) continue
    const shape = new THREE.Shape()
    shape.moveTo(meadow.points[0].x, -meadow.points[0].z)
    for (let i = 1; i < meadow.points.length; i++) shape.lineTo(meadow.points[i].x, -meadow.points[i].z)
    shape.closePath()
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, 0.05, 0)
    geometries.push(geo)
  }
  if (geometries.length === 0) return null

  const merged = mergeGeometries(geometries)
  geometries.forEach((g) => g.dispose())
  const mat = new THREE.MeshLambertMaterial({ color: MEADOW_COLOR })
  return new THREE.Mesh(merged, mat)
}

export function buildDecorGroup(decor: CityDecor): THREE.Group {
  const group = new THREE.Group()
  group.name = "decor"

  const grassMat = new THREE.MeshLambertMaterial({ map: buildGrassTexture() })
  for (const park of decor.parks) {
    if (park.tiles.length === 0) continue
    const tileGeometries = park.tiles.map((tile) => {
      const width = tile.x1 - tile.x0, depth = tile.z1 - tile.z0
      const geo = new THREE.PlaneGeometry(width, depth)
      scaleUV(geo, width / TEXTURE_TILE_UNITS.grass, depth / TEXTURE_TILE_UNITS.grass)
      geo.rotateX(-Math.PI / 2)
      geo.translate((tile.x0 + tile.x1) / 2, 0.15, (tile.z0 + tile.z1) / 2)
      return geo
    })
    const merged = mergeGeometries(tileGeometries)
    tileGeometries.forEach((g) => g.dispose())
    group.add(new THREE.Mesh(merged, grassMat))
  }

  const beachMat = new THREE.MeshLambertMaterial({ map: buildStoneTexture() })
  for (const beach of decor.beaches ?? []) {
    const width = beach.x1 - beach.x0, depth = beach.z1 - beach.z0
    const geo = new THREE.PlaneGeometry(width, depth)
    scaleUV(geo, width / TEXTURE_TILE_UNITS.beach, depth / TEXTURE_TILE_UNITS.beach)
    geo.rotateX(-Math.PI / 2)
    geo.translate((beach.x0 + beach.x1) / 2, 0.17, (beach.z0 + beach.z1) / 2)
    group.add(new THREE.Mesh(geo, beachMat))
  }

  for (const lake of decor.lakes) {
    if (lake.points.length < 3) continue
    // Shape's local Y is negated so the post-rotation world Z lands right-side
    // up (rotateX(-90) also negates Y→Z, so this cancels out) — see the
    // module doc comment's "Parks/lakes shape overhaul" note.
    const shape = new THREE.Shape()
    shape.moveTo(lake.points[0].x, -lake.points[0].z)
    for (let i = 1; i < lake.points.length; i++) {
      shape.lineTo(lake.points[i].x, -lake.points[i].z)
    }
    shape.closePath()
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, 0.20, 0)
    const mat = new THREE.MeshPhongMaterial({
      color: LAKE_COLOR,
      shininess: 90,
      transparent: true,
      opacity: 0.85,
    })
    group.add(new THREE.Mesh(geo, mat))
  }

  for (const plaza of decor.plazas ?? []) {
    const geo = new THREE.CircleGeometry(plaza.radius, 32)
    const mat = new THREE.MeshLambertMaterial({ color: PLAZA_COLOR })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(plaza.x, 0.12, plaza.z)
    group.add(mesh)
  }

  if (decor.roads.length > 0) {
    const roadGeometries = decor.roads.map((seg) => {
      const dx = seg.x2 - seg.x1
      const dz = seg.z2 - seg.z1
      const length = Math.hypot(dx, dz)
      const angle = Math.atan2(dz, dx)
      const geo = new THREE.PlaneGeometry(length, decor.roadWidth)
      // Only the length axis (U) is scaled — PlaneGeometry's default V
      // already spans exactly [0,1] across decor.roadWidth (the plane's own
      // height param), so leaving it alone is what keeps the texture's
      // dashed centerline sitting on the real center of every segment.
      scaleUV(geo, length / TEXTURE_TILE_UNITS.road, 1)
      geo.rotateX(-Math.PI / 2)
      geo.rotateY(-angle)
      geo.translate((seg.x1 + seg.x2) / 2, 0.10, (seg.z1 + seg.z2) / 2)
      return geo
    })
    const merged = mergeGeometries(roadGeometries)
    roadGeometries.forEach((g) => g.dispose())
    const mat = new THREE.MeshLambertMaterial({ map: buildAsphaltTexture() })
    group.add(new THREE.Mesh(merged, mat))
  }

  const terrain = decor.terrain

  if (terrain) {
    const meadows = buildMeadowsMesh(terrain.meadows)
    if (meadows) group.add(meadows)
  }

  const trees = buildVariedTreesMesh([
    ...decor.parkTrees, ...decor.roadTrees,
    ...(terrain?.hillTrees ?? []), ...(terrain?.bufferTrees ?? []),
  ])
  group.add(...trees)

  const bushes = buildBushesMesh([...(decor.bushes ?? []), ...(terrain?.bufferBushes ?? [])])
  if (bushes) group.add(bushes)

  const lampPosts = buildLampPostsMesh(decor.lampPosts ?? [])
  if (lampPosts) group.add(...lampPosts)

  const benches = buildBenchesMesh(decor.benches ?? [])
  if (benches) group.add(...benches)

  if (terrain) {
    const hills = buildHillsMesh(terrain)
    if (hills) group.add(hills)

    const mountains = buildMountainsMesh(terrain.mountains)
    if (mountains) group.add(mountains)
  }

  return group
}

// Material.dispose() doesn't dispose textures assigned to it (map, etc.) —
// the grass/beach CanvasTextures built above need their own disposal, or
// they'd leak every time the scene is torn down and rebuilt.
function disposeMaterial(mat: THREE.Material): void {
  const map = (mat as THREE.MeshLambertMaterial).map
  if (map) map.dispose()
  mat.dispose()
}

export function disposeDecorGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
      obj.geometry.dispose()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach(disposeMaterial)
      else disposeMaterial(mat)
    }
  })
}
