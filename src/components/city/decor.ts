/**
 * Static environment decor — parks, lakes, roads, roadside/park trees. Purely
 * visual, built once from a CityDecor (see src/data/cityDecor.ts +
 * src/data/cityRoads.ts) and added to the shared scene as a single disposable
 * THREE.Group — no per-frame updates, no gameplay/DB tie-in.
 *
 * Y-stacking (bottom to top): ground(0) < grid(0.05, cityScene.ts) <
 * roads(0.10) < plazas(0.12) < parks(0.15) < lakes(0.20). Keep every layer at
 * least ~0.02 apart — cramming them closer (an earlier version had roads and
 * the grid at the identical y=0.02) is what caused z-fighting/flicker at long
 * camera distances, fixed alongside logarithmicDepthBuffer in cityScene.ts.
 * All values stay far under the ~1-unit building-foundation floor.
 *
 * Parks/lakes shape overhaul (2026-08-11): parks render as a merged rectangle
 * per block tile (ParkShape.tiles, following the block grid instead of a
 * disc); lakes render as a THREE.Shape traced from an organic blob outline
 * (LakeShape.points) instead of a circle. See cityDecor.ts's doc comment for
 * why (matches user's reference image). No fountains — added, then removed
 * again at the user's request in the same follow-up round.
 */

import * as THREE from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import type { CityDecor, OrientedMarker } from "./types"

const PARK_COLOR = 0x4f8f3f
const LAKE_COLOR = 0x3a7bd5
const ROAD_COLOR = 0x555a5e
const BUSH_COLOR = 0x3d7a3f
const LAMP_POLE_COLOR = 0x2b2b2b
const LAMP_HEAD_COLOR = 0xffd98a
const BENCH_COLOR = 0x8a5a3a
const PLAZA_COLOR = 0x9a9086

// Deterministic hash of a tree's own position → [0,1), so type/scale choices
// are stable across renders (same layout always looks the same) without
// needing to store a random seed per tree in the generated data — same
// "position is a fixed design decision" spirit as everything else here.
function hash2D(x: number, z: number, salt: number): number {
  const h = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453
  return h - Math.floor(h)
}

interface TreeType {
  trunkGeo: THREE.BufferGeometry
  trunkMat: THREE.Material
  trunkY: number
  foliageGeo: THREE.BufferGeometry
  foliageMat: THREE.Material
  foliageY: number
  foliageScale?: [number, number, number]
}

// 5 tree types, spring palette, weighted mostly deciduous (only the last —
// the classic conifer cone — is a minority "for variety" type, matching the
// user's "mostly deciduous... let's act like it's spring" request). Weights
// must sum to 1 and stay in the same order as TREE_TYPE_WEIGHTS below.
function buildTreeTypes(): TreeType[] {
  const trunkBrown = new THREE.MeshLambertMaterial({ color: 0x6b4a2f })
  const trunkBirch = new THREE.MeshLambertMaterial({ color: 0xd9d3c1 })

  return [
    { // round deciduous, spring green — the common default tree
      trunkGeo: new THREE.CylinderGeometry(0.3, 0.4, 2, 6), trunkMat: trunkBrown, trunkY: 1,
      foliageGeo: new THREE.SphereGeometry(2.2, 7, 6),
      foliageMat: new THREE.MeshLambertMaterial({ color: 0x5a9c4a }), foliageY: 3.6,
    },
    { // flowering/blossom, soft pink — the "it's spring" tree
      trunkGeo: new THREE.CylinderGeometry(0.28, 0.36, 2, 6), trunkMat: trunkBrown, trunkY: 1,
      foliageGeo: new THREE.SphereGeometry(2.0, 7, 6),
      foliageMat: new THREE.MeshLambertMaterial({ color: 0xf0b6d2 }), foliageY: 3.4,
    },
    { // fresh yellow-green deciduous, smaller/bushier
      trunkGeo: new THREE.CylinderGeometry(0.3, 0.4, 1.8, 6), trunkMat: trunkBrown, trunkY: 0.9,
      foliageGeo: new THREE.SphereGeometry(1.9, 6, 5),
      foliageMat: new THREE.MeshLambertMaterial({ color: 0x9bcf55 }), foliageY: 3.1,
    },
    { // birch — pale trunk, narrow pale-green canopy
      trunkGeo: new THREE.CylinderGeometry(0.25, 0.3, 2.4, 6), trunkMat: trunkBirch, trunkY: 1.2,
      foliageGeo: new THREE.SphereGeometry(1.7, 6, 5),
      foliageMat: new THREE.MeshLambertMaterial({ color: 0xbadb8e }), foliageY: 3.7,
      foliageScale: [0.85, 1.3, 0.85],
    },
    { // conifer — kept for silhouette variety, deliberately the minority type
      trunkGeo: new THREE.CylinderGeometry(0.35, 0.5, 2, 6), trunkMat: trunkBrown, trunkY: 1,
      foliageGeo: new THREE.ConeGeometry(1.8, 3.6, 8),
      foliageMat: new THREE.MeshLambertMaterial({ color: 0x3a7a3f }), foliageY: 3.1,
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

// Buckets every tree by type (deterministic per position), then builds one
// trunk+foliage InstancedMesh pair per type actually used — still just a
// handful of draw calls total (at most 2 × TREE_TYPE_WEIGHTS.length), not one
// per tree. Each instance also gets a small deterministic scale variation
// (0.85-1.15x) so same-type trees aren't perfectly identical clones.
function buildVariedTreesMesh(trees: { x: number; z: number }[]): THREE.InstancedMesh[] {
  if (trees.length === 0) return []

  const types = buildTreeTypes()
  const buckets: { x: number; z: number }[][] = types.map(() => [])
  for (const t of trees) buckets[pickTreeType(t.x, t.z)].push(t)

  const meshes: THREE.InstancedMesh[] = []
  const dummy = new THREE.Object3D()

  types.forEach((type, typeIndex) => {
    const bucket = buckets[typeIndex]
    if (bucket.length === 0) return

    const trunkMesh = new THREE.InstancedMesh(type.trunkGeo, type.trunkMat, bucket.length)
    const foliageMesh = new THREE.InstancedMesh(type.foliageGeo, type.foliageMat, bucket.length)
    const [fsx, fsy, fsz] = type.foliageScale ?? [1, 1, 1]

    bucket.forEach((t, i) => {
      const scale = 0.85 + hash2D(t.x, t.z, 2) * 0.3

      dummy.position.set(t.x, type.trunkY * scale, t.z)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      trunkMesh.setMatrixAt(i, dummy.matrix)

      dummy.position.set(t.x, type.foliageY * scale, t.z)
      dummy.scale.set(fsx * scale, fsy * scale, fsz * scale)
      dummy.updateMatrix()
      foliageMesh.setMatrixAt(i, dummy.matrix)
    })

    trunkMesh.instanceMatrix.needsUpdate = true
    foliageMesh.instanceMatrix.needsUpdate = true
    meshes.push(trunkMesh, foliageMesh)
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

export function buildDecorGroup(decor: CityDecor): THREE.Group {
  const group = new THREE.Group()
  group.name = "decor"

  for (const park of decor.parks) {
    if (park.tiles.length === 0) continue
    const tileGeometries = park.tiles.map((tile) => {
      const geo = new THREE.PlaneGeometry(tile.x1 - tile.x0, tile.z1 - tile.z0)
      geo.rotateX(-Math.PI / 2)
      geo.translate((tile.x0 + tile.x1) / 2, 0.15, (tile.z0 + tile.z1) / 2)
      return geo
    })
    const merged = mergeGeometries(tileGeometries)
    tileGeometries.forEach((g) => g.dispose())
    const mat = new THREE.MeshLambertMaterial({ color: PARK_COLOR })
    group.add(new THREE.Mesh(merged, mat))
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
      geo.rotateX(-Math.PI / 2)
      geo.rotateY(-angle)
      geo.translate((seg.x1 + seg.x2) / 2, 0.10, (seg.z1 + seg.z2) / 2)
      return geo
    })
    const merged = mergeGeometries(roadGeometries)
    roadGeometries.forEach((g) => g.dispose())
    const mat = new THREE.MeshLambertMaterial({ color: ROAD_COLOR })
    group.add(new THREE.Mesh(merged, mat))
  }

  const trees = buildVariedTreesMesh([...decor.parkTrees, ...decor.roadTrees])
  group.add(...trees)

  const bushes = buildBushesMesh(decor.bushes ?? [])
  if (bushes) group.add(bushes)

  const lampPosts = buildLampPostsMesh(decor.lampPosts ?? [])
  if (lampPosts) group.add(...lampPosts)

  const benches = buildBenchesMesh(decor.benches ?? [])
  if (benches) group.add(...benches)

  return group
}

export function disposeDecorGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
      obj.geometry.dispose()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}
