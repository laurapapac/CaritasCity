/**
 * Placeholder box blueprint generator.
 *
 * Hospital/food/school buildings have no real 3D art yet — this produces a
 * plain rectangular-prism blueprint sized to EXACTLY `totalBlocks` voxels
 * (never more, never less), so the block-by-block reveal in cityScene.ts
 * still lines up 1:1 with real backend progress. Swap for real designs later.
 */

import type { Blueprint, BlueprintVoxel } from "./types"

export function generatePlaceholderBlueprint(totalBlocks: number, color: string): Blueprint {
  const side   = Math.max(1, Math.round(Math.cbrt(totalBlocks)))
  const height = Math.max(1, Math.ceil(totalBlocks / (side * side)))

  const voxels: BlueprintVoxel[] = []
  outer: for (let y = 0; y < height; y++) {
    for (let z = 0; z < side; z++) {
      for (let x = 0; x < side; x++) {
        if (voxels.length >= totalBlocks) break outer
        voxels.push({ x, y, z, type: "wall", color })
      }
    }
  }

  return { name: "Placeholder", voxelCount: voxels.length, voxels }
}
