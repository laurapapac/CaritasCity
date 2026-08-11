/**
 * Shared "what does this building variant look like" logic — used by both the
 * real kiosk (Kiosk.tsx) and the dev-only block-count preview page
 * (DevPreview.tsx) so they can't drift out of sync.
 */

import type { Blueprint } from "./types";
import type { BuildingCategory } from "../../lib/api";
import { generateHouseBlueprint, generateNeighbourhoodStyles } from "./houseGenerator";
import { generatePlaceholderBlueprint } from "./placeholderGenerator";
import { HAND_AUTHORED_DESIGNS } from "./buildingGenerators";
import blueprintData from "../../imports/house-blueprint.json";

// Variants with no real design yet still fall back to a flat-colored
// placeholder box sized to the building's real block count.
export const CATEGORY_COLOR: Record<BuildingCategory, string> = {
  residential: "0xc05030",
  hospital: "0xd7dee2",
  food: "0xd98c3d",
  school: "0x4a72c9",
};

const SOURCE_BLUEPRINT = blueprintData as unknown as {
  name?: string;
  voxelCount?: number;
  voxels: Array<{ x: number; y: number; z: number; type: string; color: string }>;
};

const HOUSE_STYLE = generateNeighbourhoodStyles("classic", "medium", "normal", 42, 1)[0];

export function blueprintForVariant(
  variant: string,
  category: BuildingCategory,
  totalBlocks: number
): Blueprint {
  if (variant === "house") {
    return generateHouseBlueprint(SOURCE_BLUEPRINT, HOUSE_STYLE);
  }
  const handAuthored = HAND_AUTHORED_DESIGNS[variant];
  if (handAuthored) {
    const voxels = handAuthored();
    return { name: variant, voxelCount: voxels.length, voxels };
  }
  return generatePlaceholderBlueprint(totalBlocks, CATEGORY_COLOR[category]);
}
