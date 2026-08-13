// ─────────────────────────────────────────────────────────────────────────────
// City domain types
// ─────────────────────────────────────────────────────────────────────────────

export type BuildingCategory = "residential" | "school" | "hospital" | "food"

// ── Blueprint (raw JSON shape) ────────────────────────────────────────────────

export interface BlueprintVoxel {
  x: number
  y: number
  z: number
  type: string
  color: string
}

export interface Blueprint {
  name?: string
  voxelCount?: number
  voxels: BlueprintVoxel[]
}

// ── City building ─────────────────────────────────────────────────────────────

export interface CityBuilding {
  id: string
  category: BuildingCategory
  /** World-space position on the terrain (block units). Y is always 0 (ground). */
  position: { x: number; z: number }
  blueprint: Blueprint
  totalBlocks: number
  completedBlocks: number
}

// ── Construction queue ────────────────────────────────────────────────────────
// Maps each category to the id of the currently active building.
// undefined means the category has no pending construction.

export type ConstructionQueue = Partial<Record<BuildingCategory, string>>

// ── Processed block (world-space, ready for Three.js) ────────────────────────

export interface Block {
  x: number
  y: number
  z: number
  type: string
  color: string | number
}

// ── Environment decor (Phase 3: parks, lakes, roads, trees) ──────────────────
// Purely visual, non-voxel scenery layered on top of the building layout —
// no gameplay/DB tie-in. Positions are static design data (src/data/cityDecor.ts,
// src/data/cityRoads.ts), same "fixed decision, not runtime state" treatment
// as CityLayoutEntry.

export interface DecorZone {
  id: string
  x: number
  z: number
  radius: number
}

/** A park's silhouette: the union of BSP block tiles its reserved-zone circle
 *  overlaps (see parkTilesFor in generateCityLayout.ts) — follows the block
 *  grid instead of being a circle. */
export interface ParkShape {
  id: string
  tiles: { x0: number; z0: number; x1: number; z1: number }[]
}

/** A lake's organic outline (sampleBlobPolygon in generateCityLayout.ts): a
 *  circle perturbed by two sine waves, not a true circle. */
export interface LakeShape {
  id: string
  points: { x: number; z: number }[]
}

/** A plain rect (like a park tile) filling a lake's block minus road
 *  clearance, rendered under the lake so the lake's own (smaller, organic)
 *  shape covers its middle, leaving a visible ring — a placeholder "beach"
 *  until a real texture replaces the flat color (2026-08-12). */
export interface BeachShape {
  id: string
  x0: number
  z0: number
  x1: number
  z1: number
}

export interface RoadSegment {
  x1: number
  z1: number
  x2: number
  z2: number
}

export interface TreeMarker {
  x: number
  z: number
  /** World-space Y (2026-08-13) — undefined/omitted means ground level (0),
   *  matching every existing tree. Used by hill trees so trunks sit flush on
   *  their terraced hill-column top instead of at y=0. */
  y?: number
}

export interface OrientedMarker {
  x: number
  z: number
  angle: number
}

// ── World terrain (2026-08-13) — grass buffer, rolling hills, distant
// mountains past the city; see generateCityLayout.ts's "World terrain"
// section for the full design rationale (replaces a rejected first attempt,
// a mountain ring that read as "closed off and claustrophobic"). ─────────

/** A stepped stack of terraced voxel-cube layers — same shape as a tree
 *  canopy's CanopyShape in decor.ts, just at mountain scale. `levels` is the
 *  number of tapering layers (footprint radius = levels - layerIndex, in
 *  cube units); `seed` drives per-cell jitter so no two peaks are
 *  identical. */
export interface MountainPeak {
  x: number
  z: number
  cubeSize: number
  levels: number
  seed: number
}

/** An organic color-variation patch in the grass buffer — same shape as a
 *  LakeShape (sampleBlobPolygon), rendered as flat ground color instead of
 *  water. */
export interface MeadowShape {
  id: string
  points: { x: number; z: number }[]
}

export interface TerrainBands {
  cityEdge: number
  bufferOuter: number
  hillsInner: number
  hillsOuter: number
  mountainInner: number
  mountainOuter: number
  groundRadius: number
  fogNear: number
  fogFar: number
}

/** Static world-terrain data (src/data/cityTerrain.ts). hillColumns is a
 *  flat [gx,gz,level, ...] number array (grid indices, not world
 *  coordinates or objects) — see cityTerrain.ts's doc comment for why;
 *  cellSize/step are needed to expand it back into world position/height. */
export interface TerrainData {
  cellSize: number
  step: number
  hillColumns: number[]
  hillTrees: TreeMarker[]
  bufferTrees: TreeMarker[]
  bufferBushes: TreeMarker[]
  meadows: MeadowShape[]
  mountains: MountainPeak[]
  bands: TerrainBands
}

export interface CityDecor {
  parks: ParkShape[]
  lakes: LakeShape[]
  beaches?: BeachShape[]
  roads: RoadSegment[]
  roadWidth: number
  roadTrees: TreeMarker[]
  parkTrees: TreeMarker[]
  /** Block-interior filler decor (2026-08-11) — all optional so callers that
   *  build a CityDecor without them (none currently do, but keep it safe)
   *  don't break. */
  bushes?: TreeMarker[]
  lampPosts?: OrientedMarker[]
  benches?: OrientedMarker[]
  plazas?: DecorZone[]
  /** World terrain past the city — grass buffer, rolling hills, distant
   *  mountains (2026-08-13). Optional so callers without it (e.g. /kiosk,
   *  which passes no decor at all today) are unaffected. */
  terrain?: TerrainData
}
