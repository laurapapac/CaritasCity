import { useEffect, useRef, memo, useMemo } from 'react'
import * as THREE from 'three'

// ── Block face texture: edge-darkening bevel + per-pixel grain ────────────────
// Grayscale canvas texture that multiplies with per-instance colour.
// Module-level singleton so all 8 cards share the same GPU texture.
function buildBlockTexture(): THREE.CanvasTexture {
  const S = 64
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
  const cvs = document.createElement('canvas')
  cvs.width = cvs.height = S
  cvs.getContext('2d')!.putImageData(new ImageData(buf, S, S), 0, 0)
  const tex = new THREE.CanvasTexture(cvs)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  return tex
}

const BLOCK_TEX = buildBlockTexture()

// ── Minecraft-inspired palette ────────────────────────────────────────────────
const P = {
  stone:     0x898989,
  brick:     0xc05030,
  brickDark: 0x8a3420,
  glass:     0x9fe4f5,
  glassDark: 0x5aa8cc,
  wood:      0xa07840,
  woodDark:  0x604828,
  slate:     0x3e4f5e,
  slateDark: 0x2a3540,
  grass:     0x5ca048,
  white:     0xeef0f5,
  offWhite:  0xdcdfe8,
  gray:      0xb0b4bc,
  grayDark:  0x7a8090,
  red:       0xdd2222,
  redLight:  0xff4444,
  yellow:    0xeecf22,
  tan:       0xd4a855,
  blue:      0x4488dd,
  concrete:  0x9aa0a8,
  concDark:  0x6e7880,
  green:     0x44994a,
  darkGray:  0x484e58,
  sand:      0xd8c080,
  sandDark:  0xa89050,
  pink:      0xe8a0a8,
} as const

type Color = (typeof P)[keyof typeof P]
type Voxel = { x: number; y: number; z: number; c: Color }

const GLASS_COLORS = new Set<Color>([P.glass, P.glassDark])

// ── Voxel construction helpers ────────────────────────────────────────────────
function makeVoxels(fn: (s: (x: number, y: number, z: number, c: Color) => void) => void): Voxel[] {
  const map = new Map<string, Color>()
  fn((x, y, z, c) => map.set(`${x},${y},${z}`, c))
  return Array.from(map.entries()).map(([k, c]) => {
    const [x, y, z] = k.split(',').map(Number)
    return { x, y, z, c }
  })
}

type Setter = (x: number, y: number, z: number, c: Color) => void

function fill(s: Setter, x0: number, y0: number, z0: number, w: number, h: number, d: number, c: Color) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      for (let z = z0; z < z0 + d; z++)
        s(x, y, z, c)
}

function shell(s: Setter, x0: number, y0: number, z0: number, w: number, h: number, d: number, c: Color, t = 2) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      for (let z = z0; z < z0 + d; z++)
        if (x < x0 + t || x >= x0 + w - t || z < z0 + t || z >= z0 + d - t)
          s(x, y, z, c)
}

function slab(s: Setter, x0: number, y: number, z0: number, w: number, d: number, c: Color) {
  fill(s, x0, y, z0, w, 1, d, c)
}

// Punch windows at given y-row on walls (front, back, sides)
function winRow(s: Setter, x0: number, y: number, z0: number, w: number, d: number, c: Color, step = 4, size = 2) {
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

// ── Building generators ───────────────────────────────────────────────────────

function genShortApartment(): Voxel[] {
  return makeVoxels(s => {
    const [W, D, floors, fh] = [18, 14, 6, 4]
    // Foundation
    fill(s, 0, 0, 0, W, 2, D, P.concrete)
    // Floors
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      shell(s, 0, y0, 0, W, fh, D, P.brick, 2)
      slab(s, 2, y0, 2, W - 4, D - 4, P.concDark)
      // Window rows
      winRow(s, 0, y0 + 1, 0, W, D, P.glass, 4, 2)
      // Trim between floors
      fill(s, 0, y0 + fh - 1, 0, W, 1, D, P.brickDark)
      // Balcony slabs on front every 2nd floor
      if (f % 2 === 1) fill(s, 2, y0, 0, W - 4, 1, 2, P.concDark)
    }
    // Parapet
    shell(s, 0, 2 + floors * fh, 0, W, 2, D, P.brick, 2)
    // Rooftop water tower
    fill(s, W - 5, 2 + floors * fh + 2, D - 5, 3, 4, 3, P.woodDark)
    fill(s, W - 4, 2 + floors * fh + 6, D - 4, 1, 2, 1, P.darkGray)
  })
}

function genTallApartment(): Voxel[] {
  return makeVoxels(s => {
    const [W, D, floors, fh] = [14, 12, 14, 3]
    // Foundation
    fill(s, 0, 0, 0, W + 4, 2, D + 4, P.concrete)
    // Podium (wider base, 2 floors)
    shell(s, -2, 2, -2, W + 4, fh * 2, D + 4, P.concrete, 2)
    slab(s, -1, 2, -1, W + 2, D + 2, P.concDark)
    // Tower
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      shell(s, 0, y0, 0, W, fh, D, f < 2 ? P.concrete : P.glass, 1)
      // Alternate bands of glass and concrete
      if (f % 3 === 0) shell(s, 0, y0, 0, W, fh, D, P.concrete, 1)
      else shell(s, 0, y0, 0, W, fh, D, P.glassDark, 1)
      slab(s, 1, y0, 1, W - 2, D - 2, P.concDark)
    }
    // Antenna
    const top = 2 + floors * fh
    fill(s, W / 2 - 1, top, D / 2 - 1, 2, 6, 2, P.darkGray)
    fill(s, W / 2, top + 6, D / 2, 1, 3, 1, P.red)
  })
}

function genFoodBank(): Voxel[] {
  return makeVoxels(s => {
    const [W, D, floors, fh] = [26, 18, 3, 5]
    // Foundation
    fill(s, 0, 0, 0, W, 2, D, P.concrete)
    // Main warehouse body
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      shell(s, 0, y0, 0, W, fh, D, P.concDark, 2)
      slab(s, 2, y0, 2, W - 4, D - 4, P.stone)
      // Large loading doors on front
      if (f === 0) {
        fill(s, 3, y0, 0, 4, 4, 2, P.darkGray)
        fill(s, 10, y0, 0, 4, 4, 2, P.darkGray)
        fill(s, 17, y0, 0, 4, 4, 2, P.darkGray)
      } else {
        winRow(s, 0, y0 + 1, 0, W, D, P.glass, 6, 2)
      }
    }
    // Roof - flat with solar panels (yellow)
    slab(s, 0, 2 + floors * fh, 0, W, D, P.concDark)
    for (let x = 3; x < W - 3; x += 5)
      fill(s, x, 2 + floors * fh + 1, 4, 3, 1, 8, P.yellow)
    // Signage area above door
    fill(s, 2, 2 + 2 * fh + 1, 0, W - 4, 2, 2, P.green)
    fill(s, W / 2 - 2, 2 + 2 * fh + 1, 0, 4, 2, 2, P.white)
  })
}

function genRestaurant(): Voxel[] {
  return makeVoxels(s => {
    const [W, D, floors, fh] = [16, 14, 4, 4]
    // Foundation
    fill(s, 0, 0, 0, W, 2, D, P.sandDark)
    // Building body - warm brick
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      shell(s, 0, y0, 0, W, fh, D, P.brick, 2)
      slab(s, 2, y0, 2, W - 4, D - 4, P.woodDark)
      if (f === 0) {
        // Big front windows at ground floor
        fill(s, 2, y0, 0, W - 4, fh - 1, 2, P.glassDark)
        // Wood framing
        for (let x = 2; x < W - 2; x += 4) fill(s, x, y0, 0, 1, fh - 1, 2, P.woodDark)
      } else {
        winRow(s, 0, y0 + 1, 0, W, D, P.glass, 4, 1)
      }
    }
    // Awning over entrance
    fill(s, -1, 2 + fh - 1, -2, W + 2, 1, 3, P.red)
    fill(s, -1, 2 + fh, -2, W + 2, 1, 3, P.redLight)
    // Chimney / kitchen exhaust
    fill(s, W - 3, 2 + floors * fh, D - 3, 2, 5, 2, P.brickDark)
    // Rooftop sign platform
    fill(s, 3, 2 + floors * fh, 0, W - 6, 3, 2, P.wood)
    fill(s, 4, 2 + floors * fh + 1, 0, W - 8, 2, 1, P.yellow)
    // Trim
    for (let f = 0; f < floors; f++)
      fill(s, 0, 2 + f * fh + fh - 1, 0, W, 1, D, P.woodDark)
  })
}

function genSchool(): Voxel[] {
  return makeVoxels(s => {
    const [W, D, floors, fh] = [24, 16, 4, 4]
    // Foundation
    fill(s, 0, 0, 0, W, 2, D, P.concrete)
    // Main building
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      shell(s, 0, y0, 0, W, fh, D, P.tan, 2)
      slab(s, 2, y0, 2, W - 4, D - 4, P.sand)
      // Lots of windows - schools have many
      winRow(s, 0, y0 + 1, 0, W, D, P.glass, 3, 1)
    }
    // Front entrance wing (protrusion)
    fill(s, W / 2 - 3, 0, -3, 6, 2, 4, P.concDark)
    shell(s, W / 2 - 3, 2, -3, 6, fh * 2, 4, P.white, 1)
    fill(s, W / 2 - 2, 2, -3, 4, fh - 1, 2, P.glass)
    // Flagpole
    fill(s, W / 2, 2 + floors * fh, D / 2, 1, 8, 1, P.gray)
    fill(s, W / 2 + 1, 2 + floors * fh + 8, D / 2, 4, 3, 1, P.red)
    fill(s, W / 2 + 1, 2 + floors * fh + 8, D / 2, 4, 3, 1, P.yellow)
    // Yellow trim strips
    for (let f = 0; f < floors; f++)
      fill(s, 0, 2 + f * fh + fh - 1, 0, W, 1, D, P.yellow)
    // Flat roof
    slab(s, 0, 2 + floors * fh, 0, W, D, P.concrete)
  })
}

function genSmallHospital(): Voxel[] {
  return makeVoxels(s => {
    const [W, D, floors, fh] = [16, 14, 5, 4]
    fill(s, 0, 0, 0, W, 2, D, P.concrete)
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      shell(s, 0, y0, 0, W, fh, D, P.white, 2)
      slab(s, 2, y0, 2, W - 4, D - 4, P.offWhite)
      winRow(s, 0, y0 + 1, 0, W, D, P.glass, 3, 1)
      fill(s, 0, y0 + fh - 1, 0, W, 1, D, P.gray)
    }
    // Front entrance
    fill(s, W / 2 - 2, 2, -1, 4, fh - 1, 2, P.glassDark)
    fill(s, W / 2 - 1, 2, -1, 2, fh - 1, 2, P.glass)
    // Red cross on roof
    const ry = 2 + floors * fh
    slab(s, 0, ry, 0, W, D, P.white)
    fill(s, W / 2 - 1, ry + 1, 2, 2, 1, D - 4, P.red)
    fill(s, 3, ry + 1, D / 2 - 1, W - 6, 1, 2, P.red)
    // Helipad circle (approx with square)
    fill(s, W / 2 - 2, ry + 2, D / 2 - 2, 4, 1, 4, P.yellow)
  })
}

function genMedHospital(): Voxel[] {
  return makeVoxels(s => {
    const [W, D, floors, fh] = [22, 18, 7, 3]
    fill(s, 0, 0, 0, W, 2, D, P.concrete)
    // Two wings
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      shell(s, 0, y0, 0, W, fh, D, P.white, 2)
      slab(s, 2, y0, 2, W - 4, D - 4, P.offWhite)
      winRow(s, 0, y0 + 1, 0, W, D, P.glass, 3, 1)
      fill(s, 0, y0 + fh - 1, 0, W, 1, D, P.concDark)
    }
    // Central tower (taller)
    const cx = W / 2 - 3
    for (let f = floors; f < floors + 3; f++) {
      const y0 = 2 + f * fh
      shell(s, cx, y0, 4, 6, fh, D - 8, P.white, 1)
      slab(s, cx + 1, y0, 5, 4, D - 10, P.offWhite)
      winRow(s, cx, y0 + 1, 4, 6, D - 8, P.glass, 2, 1)
    }
    // Red cross on main roof
    const ry = 2 + floors * fh
    slab(s, 0, ry, 0, W, D, P.gray)
    fill(s, W / 2 - 1, ry + 1, 3, 2, 1, D - 6, P.red)
    fill(s, 4, ry + 1, D / 2 - 1, W - 8, 1, 2, P.red)
    // Ambulance bay canopy
    fill(s, 2, 2, -3, 8, 1, 4, P.white)
    fill(s, 2, 3, -3, 8, 1, 4, P.red)
  })
}

function genLargeHospital(): Voxel[] {
  return makeVoxels(s => {
    const [W, D, floors, fh] = [26, 22, 10, 3]
    fill(s, 0, 0, 0, W, 2, D, P.concrete)
    // Main body
    for (let f = 0; f < floors; f++) {
      const y0 = 2 + f * fh
      shell(s, 0, y0, 0, W, fh, D, P.white, 2)
      slab(s, 2, y0, 2, W - 4, D - 4, P.offWhite)
      winRow(s, 0, y0 + 1, 0, W, D, P.glass, 3, 1)
      fill(s, 0, y0 + fh - 1, 0, W, 1, D, P.concDark)
    }
    // Left tower
    for (let f = floors; f < floors + 4; f++) {
      const y0 = 2 + f * fh
      shell(s, 1, y0, 1, 8, fh, D - 2, P.white, 1)
      slab(s, 2, y0, 2, 6, D - 4, P.offWhite)
      winRow(s, 1, y0 + 1, 1, 8, D - 2, P.glass, 2, 1)
    }
    // Right tower
    for (let f = floors; f < floors + 6; f++) {
      const y0 = 2 + f * fh
      shell(s, W - 9, y0, 1, 8, fh, D - 2, P.white, 1)
      slab(s, W - 8, y0, 2, 6, D - 4, P.offWhite)
      winRow(s, W - 9, y0 + 1, 1, 8, D - 2, P.glass, 2, 1)
    }
    // Roof
    const ry = 2 + floors * fh
    slab(s, 0, ry, 0, W, D, P.gray)
    // Large red cross
    fill(s, W / 2 - 1, ry + 1, 3, 2, 1, D - 6, P.red)
    fill(s, 4, ry + 1, D / 2 - 1, W - 8, 1, 2, P.red)
    // Helipad
    fill(s, W - 9, ry, 1, 8, 1, D - 2, P.yellow)
    fill(s, W - 8, ry + 1, D / 2 - 1, 6, 1, 2, P.white)
    fill(s, W - 6, ry + 1, 2, 2, 1, D - 4, P.white)
    // Antenna tower
    fill(s, W / 2, ry + 2, D / 2, 1, 10, 1, P.darkGray)
    fill(s, W / 2 - 1, ry + 12, D / 2, 3, 1, 1, P.red)
  })
}

// ── Building metadata ─────────────────────────────────────────────────────────
const BUILDINGS = [
  { name: 'Short\nApartment', blocksEach: 4000, total: 92000, qty: 23, color: '#e8734a', gen: genShortApartment },
  { name: 'Tall\nApartment',  blocksEach: 8000, total: 96000, qty: 12, color: '#5a9de8', gen: genTallApartment },
  { name: 'Food Bank',        blocksEach: 4000, total: 44000, qty: 11, color: '#4aab5a', gen: genFoodBank },
  { name: 'Restaurant',       blocksEach: 5000, total: 70000, qty: 14, color: '#e8c030', gen: genRestaurant },
  { name: 'School',           blocksEach: 5000, total: 65000, qty: 13, color: '#f0a030', gen: genSchool },
  { name: 'Small\nHospital',  blocksEach: 4000, total: 20000, qty:  5, color: '#dd4444', gen: genSmallHospital },
  { name: 'Medium\nHospital', blocksEach: 6000, total: 24000, qty:  4, color: '#dd4444', gen: genMedHospital },
  { name: 'Large\nHospital',  blocksEach: 8000, total: 8000,  qty:  1, color: '#dd4444', gen: genLargeHospital },
] as const

// ── Three.js voxel canvas ─────────────────────────────────────────────────────
const VoxelCanvas = memo(function VoxelCanvas({ voxels }: { voxels: Voxel[] }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = mountRef.current
    if (!container || voxels.length === 0) return

    const W = container.clientWidth || 320
    const H = container.clientHeight || 260

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(W, H)
    container.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'

    // ── Scene ─────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)
    scene.fog = new THREE.Fog(0xc5e8f7, 120, 500)

    // ── Camera ────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 1000)

    // ── Lights ────────────────────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5a6b4a, 0.7))
    scene.add(new THREE.AmbientLight(0xffffff, 0.45))
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.4)
    sun.position.set(12, 20, -9)
    scene.add(sun)
    const fillLight = new THREE.DirectionalLight(0xccddff, 0.35)
    fillLight.position.set(-8, 6, 8)
    scene.add(fillLight)

    // ── Ground + grid ─────────────────────────────────────────────────────
    const groundGeo = new THREE.PlaneGeometry(200, 200)
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x6b8f5e })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    scene.add(ground)

    const grid = new THREE.GridHelper(200, 200, 0x3a6032, 0x4a7a42)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.35
    grid.position.y = 0.02
    scene.add(grid)

    // ── Center voxels ─────────────────────────────────────────────────────
    const xs = voxels.map(v => v.x), ys = voxels.map(v => v.y), zs = voxels.map(v => v.z)
    const cx   = (Math.min(...xs) + Math.max(...xs)) / 2
    const maxY = Math.max(...ys)
    const cz   = (Math.min(...zs) + Math.max(...zs)) / 2

    const solid = voxels.filter(v => !GLASS_COLORS.has(v.c))
    const glass = voxels.filter(v =>  GLASS_COLORS.has(v.c))

    const geo      = new THREE.BoxGeometry(1, 1, 1)
    const dummy    = new THREE.Object3D()
    const tmpColor = new THREE.Color()

    // ── Solid: bevel+grain texture × per-instance color ───────────────────
    const solidMat  = new THREE.MeshLambertMaterial({ map: BLOCK_TEX })
    const solidMesh = new THREE.InstancedMesh(geo, solidMat, solid.length || 1)
    solid.forEach((v, i) => {
      dummy.position.set(v.x - cx, v.y, v.z - cz)
      dummy.updateMatrix()
      solidMesh.setMatrixAt(i, dummy.matrix)
      solidMesh.setColorAt(i, tmpColor.set(v.c))
    })
    solidMesh.count = solid.length
    solidMesh.instanceMatrix.needsUpdate = true
    if (solidMesh.instanceColor) solidMesh.instanceColor.needsUpdate = true
    scene.add(solidMesh)

    // ── Glass: semi-transparent, no depth write ───────────────────────────
    const glassMat  = new THREE.MeshPhongMaterial({
      color:       0x9fe4f5,
      transparent: true,
      opacity:     0.38,
      shininess:   160,
      specular:    new THREE.Color(0xc8eeff),
      depthWrite:  false,
      side:        THREE.DoubleSide,
    })
    const glassMesh = new THREE.InstancedMesh(geo, glassMat, glass.length || 1)
    glass.forEach((v, i) => {
      dummy.position.set(v.x - cx, v.y, v.z - cz)
      dummy.updateMatrix()
      glassMesh.setMatrixAt(i, dummy.matrix)
    })
    glassMesh.count = glass.length
    glassMesh.instanceMatrix.needsUpdate = true
    glassMesh.renderOrder = 1
    scene.add(glassMesh)

    // ── Resize observer ───────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth || 1
      const h = container.clientHeight || 1
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(container)

    // ── Rotating camera ───────────────────────────────────────────────────
    const radius = maxY * 1.6 + 10
    let angle = Math.PI / 4
    let raf: number

    const animate = () => {
      raf = requestAnimationFrame(animate)
      angle += 0.006
      camera.position.set(Math.cos(angle) * radius * 0.7, maxY * 0.8, Math.sin(angle) * radius * 0.7)
      camera.lookAt(0, maxY * 0.4, 0)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      geo.dispose()
      solidMat.dispose()
      glassMat.dispose()
      groundGeo.dispose()
      groundMat.dispose()
      grid.geometry.dispose()
      ;(grid.material as THREE.Material).dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container)
        container.removeChild(renderer.domElement)
    }
  }, [voxels])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
})

// ── Building card ─────────────────────────────────────────────────────────────
function BuildingCard({ building }: { building: typeof BUILDINGS[number] }) {
  const voxels = useMemo(() => building.gen(), [building])

  return (
    <div style={{
      background: 'linear-gradient(160deg, #1a2035 0%, #111826 100%)',
      border: '2px solid #2a3555',
      borderRadius: '4px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: `0 0 0 1px #0a0e1a, 0 8px 24px rgba(0,0,0,0.6), 0 0 20px ${building.color}18`,
      transition: 'border-color 0.2s, box-shadow 0.2s',
      cursor: 'default',
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLDivElement
      el.style.borderColor = building.color
      el.style.boxShadow = `0 0 0 1px #0a0e1a, 0 12px 32px rgba(0,0,0,0.7), 0 0 28px ${building.color}44`
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLDivElement
      el.style.borderColor = '#2a3555'
      el.style.boxShadow = `0 0 0 1px #0a0e1a, 0 8px 24px rgba(0,0,0,0.6), 0 0 20px ${building.color}18`
    }}
    >
      {/* Canvas viewport */}
      <div style={{ height: '220px' }}>
        <VoxelCanvas voxels={voxels} />
      </div>

      {/* Info panel */}
      <div style={{ padding: '14px 16px 16px', borderTop: `2px solid ${building.color}44` }}>
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '9px',
          color: building.color,
          lineHeight: '1.8',
          marginBottom: '12px',
          textShadow: `0 0 10px ${building.color}88`,
          whiteSpace: 'pre-line',
        }}>
          {building.name}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <StatChip label="BLOCKS" value={building.blocksEach.toLocaleString()} color="#7ab4ff" />
          <StatChip label="TOTAL" value={building.total.toLocaleString()} color="#a8f0a8" />
          <StatChip label="QTY" value={`×${building.qty}`} color={building.color} />
        </div>
      </div>
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: '#0d1220',
      border: `1px solid ${color}44`,
      borderRadius: '3px',
      padding: '5px 8px',
      flex: 1,
      minWidth: '70px',
    }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: '#5a6a8a', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontWeight: 800, color }}>
        {value}
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #0e1830 0%, #0a0e1a 60%)',
      padding: '32px 24px 48px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '22px',
          color: '#ffffff',
          textShadow: '0 0 20px #4488ff88, 3px 3px 0 #0a0e1a',
          letterSpacing: '2px',
          lineHeight: '1.6',
          marginBottom: '8px',
        }}>
          CITY BLOCKS
        </div>
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '8px',
          color: '#4a6a9a',
          letterSpacing: '3px',
        }}>
          VOXEL BUILDING CATALOGUE
        </div>
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
          {['🏗️', '🏥', '🏫', '🏪'].map((e, i) => (
            <span key={i} style={{ fontSize: '20px' }}>{e}</span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
      className="building-grid"
      >
        {BUILDINGS.map((b, i) => (
          <BuildingCard key={i} building={b} />
        ))}
      </div>

      {/* Footer stats */}
      <div style={{
        maxWidth: '1200px',
        margin: '28px auto 0',
        padding: '16px 20px',
        background: '#111826',
        border: '1px solid #2a3555',
        borderRadius: '4px',
        display: 'flex',
        gap: '32px',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <FooterStat label="BUILDING TYPES" value="8" />
        <FooterStat label="TOTAL BLOCKS" value={BUILDINGS.reduce((a, b) => a + b.total, 0).toLocaleString()} />
        <FooterStat label="TOTAL BUILDINGS" value={BUILDINGS.reduce((a, b) => a + b.qty, 0).toString()} />
      </div>

      <style>{`
        @media (max-width: 1000px) { .building-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px)  { .building-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: '#4a6a9a', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '20px', fontWeight: 800, color: '#7ab4ff' }}>{value}</div>
    </div>
  )
}
