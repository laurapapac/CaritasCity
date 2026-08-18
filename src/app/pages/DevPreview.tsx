import { useMemo, useRef, useState } from "react";
import { City, type CityHandle } from "../../components/city/City";
import type { CityBuilding, CityDecor } from "../../components/city/types";
import { blueprintForVariant } from "../../components/city/blueprintForVariant";
import {
  MONTAGE_BLOCK_COUNT,
  MONTAGE_STAGGER_MS,
  MONTAGE_FINAL_BLOCK_DELAY_MS,
} from "../../components/city/constructionMontageConfig";
import type { BuildingCategory } from "../../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Slider } from "../components/ui/slider";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";

// Dev-only preview: pick any building variant and any block count (0 → total)
// and see it rendered instantly. Purely client-side — never touches the real
// backend/DB, and never reachable in a production build (see main.tsx).

type VariantDef = {
  key: string;
  label: string;
  category: BuildingCategory;
  totalBlocks: number;
};

// From the finalized building-counts table in plans/qr-backend-todo.md.
const VARIANTS: VariantDef[] = [
  { key: "house", label: "House", category: "residential", totalBlocks: 1080 },
  { key: "short_apartment", label: "Short Apartment", category: "residential", totalBlocks: 4000 },
  { key: "tall_apartment", label: "Tall Apartment", category: "residential", totalBlocks: 8000 },
  { key: "food_bank", label: "Food Bank", category: "food", totalBlocks: 4000 },
  { key: "restaurant", label: "Restaurant", category: "food", totalBlocks: 5000 },
  { key: "school", label: "School", category: "school", totalBlocks: 5000 },
  { key: "hospital_small", label: "Small Hospital", category: "hospital", totalBlocks: 4000 },
  { key: "hospital_medium", label: "Medium Hospital", category: "hospital", totalBlocks: 6000 },
  { key: "hospital_large", label: "Large Hospital", category: "hospital", totalBlocks: 8000 },
];

// Matches cityScene.ts's TOP_VIEW_TILT_DEG(22)/FOCUS_OFFSET(22) exactly — the
// horizontal distance from a framed block to where the top-view camera lands,
// used below to place a mock tree precisely at (or well clear of) that spot.
const TOP_VIEW_HORIZONTAL_OFFSET = Math.sin((22 * Math.PI) / 180) * 22;

// Dev-only shortcut for the unverified "top-view camera framing steepened +
// tree-dodging" work (plans/qr-backend-todo.md, 2026-08-17) — reaching a real
// roof/floor block through hundreds of real placements wasn't practical, so
// this jumps straight to one and optionally mocks a tree at the exact spot
// the default (south) camera candidate would land, to exercise the dodge path.
type TreeTest = "none" | "south";

export default function DevPreview() {
  const cityRef = useRef<CityHandle>(null);
  const [variantKey, setVariantKey] = useState(VARIANTS[0].key);
  const [count, setCount] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [focusIndex, setFocusIndex] = useState(VARIANTS[0].totalBlocks - 1);
  const [treeTest, setTreeTest] = useState<TreeTest>("none");

  const variant = VARIANTS.find((v) => v.key === variantKey)!;

  // Only recomputed (and <City> only remounts, via key={variant.key} below) when
  // the variant changes — slider drags update the mesh directly through
  // setVisibleCount instead, so they don't need to touch this at all.
  const building = useMemo<CityBuilding>(
    () => ({
      id: variant.key,
      category: variant.category,
      position: { x: 0, z: 0 },
      blueprint: blueprintForVariant(variant.key, variant.category, variant.totalBlocks),
      totalBlocks: variant.totalBlocks,
      completedBlocks: count,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variant.key]
  );

  // Local coords === world coords here (building sits at position {x:0,z:0}),
  // and blockIndex maps 1:1 onto blueprint.voxels order (processBlueprint
  // preserves it) — so this is exactly the block focusOnBlock would frame.
  const focusVoxel = building.blueprint.voxels[focusIndex];

  // Mocks a tree at the exact spot the default (south) top-view camera
  // candidate would land, to force pickTopViewOffset's dodge path — real
  // decor is never passed to this page otherwise. Only takes effect after
  // <City> remounts (its key includes treeTest below), since cityScene.ts
  // builds the tree census once at scene-creation time.
  const mockDecor = useMemo<CityDecor | undefined>(() => {
    if (treeTest === "none" || !focusVoxel) return undefined;
    return {
      parks: [],
      lakes: [],
      roads: [],
      roadWidth: 6,
      roadTrees: [{ x: focusVoxel.x, z: focusVoxel.z - TOP_VIEW_HORIZONTAL_OFFSET }],
      parkTrees: [],
    };
  }, [treeTest, focusVoxel]);

  function handleVariantChange(key: string) {
    setVariantKey(key);
    setCount(0);
    const nextVariant = VARIANTS.find((v) => v.key === key)!;
    setFocusIndex(nextVariant.totalBlocks - 1);
  }

  // Jumps straight to blockIndex (revealing it if needed) and snaps the
  // camera there — bypasses the montage/placement flow entirely, since this
  // is purely about testing focusOnBlock's framing, not the reveal animation.
  function handleFocusTest() {
    const idx = Math.max(0, Math.min(variant.totalBlocks - 1, Math.round(focusIndex)));
    const target = idx + 1;
    setCount(target);
    cityRef.current?.setVisibleCount(variant.key, target);
    cityRef.current?.focusOnBlock(variant.key, idx, { highlight: true });
  }

  function handleCountChange(next: number) {
    if (Number.isNaN(next)) return;
    const clamped = Math.max(0, Math.min(variant.totalBlocks, Math.round(next)));
    setCount(clamped);
    cityRef.current?.setVisibleCount(variant.key, clamped);
  }

  // Mirrors Kiosk.tsx's handleConfirm exactly (same shared montage constants,
  // same call sequence): camera focuses on where the new block will land,
  // then the last MONTAGE_BLOCK_COUNT blocks replay with a stagger, then —
  // after a beat — the genuinely new block reveals with its highlight.
  function handleSimulatePlacement() {
    if (isSimulating || count >= variant.totalBlocks) return;

    setIsSimulating(true);
    cityRef.current?.focusOnBlock(variant.key, count);
    cityRef.current?.playConstructionMontage(
      variant.key,
      MONTAGE_BLOCK_COUNT,
      MONTAGE_STAGGER_MS,
      () => {
        setTimeout(() => {
          cityRef.current?.addBlockToBuilding(variant.key);
          setCount((c) => c + 1);
          setIsSimulating(false);
        }, MONTAGE_FINAL_BLOCK_DELAY_MS);
      }
    );
  }

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background">
      <City
        key={`${variant.key}-${treeTest}`}
        ref={cityRef}
        initialBuildings={[building]}
        decor={mockDecor}
        style={{ position: "absolute", inset: 0 }}
      />

      <Card className="absolute left-4 top-4 w-80 bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle>Block count preview</CardTitle>
          <CardDescription>Dev-only — doesn&apos;t touch the real database</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Variant</Label>
            <Select value={variantKey} onValueChange={handleVariantChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIANTS.map((v) => (
                  <SelectItem key={v.key} value={v.key}>
                    {v.label} — {v.totalBlocks.toLocaleString()} blocks
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Blocks placed</Label>
            <Slider
              value={[count]}
              min={0}
              max={variant.totalBlocks}
              step={1}
              onValueChange={([v]) => handleCountChange(v)}
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={variant.totalBlocks}
                value={count}
                onChange={(e) => handleCountChange(Number(e.target.value))}
                className="w-28"
              />
              <span className="text-muted-foreground text-sm">
                / {variant.totalBlocks.toLocaleString()}
              </span>
            </div>
          </div>

          <Button
            onClick={handleSimulatePlacement}
            disabled={isSimulating || count >= variant.totalBlocks}
          >
            {isSimulating ? "Placing…" : "Simulate placing next block"}
          </Button>
        </CardContent>
      </Card>

      <Card className="absolute right-4 top-4 w-80 bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle>Camera framing test</CardTitle>
          <CardDescription>
            Jump straight to a block index and snap the camera there — for verifying
            focusOnBlock&apos;s top-view tilt/tree-dodge without hundreds of real placements.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Block index</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={variant.totalBlocks - 1}
                value={focusIndex}
                onChange={(e) => setFocusIndex(Number(e.target.value))}
                className="w-28"
              />
              <span className="text-muted-foreground text-sm">
                / {variant.totalBlocks - 1} (default: last = likely roof/cap)
              </span>
            </div>
            {focusVoxel && (
              <span className="text-muted-foreground text-xs">
                voxel: x={focusVoxel.x}, y={focusVoxel.y}, z={focusVoxel.z}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Mock tree</Label>
            <Select value={treeTest} onValueChange={(v) => setTreeTest(v as TreeTest)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — default south tilt</SelectItem>
                <SelectItem value="south">
                  South, at the default candidate spot — forces the dodge
                </SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-xs">
              Changing this remounts the scene (decor is built once per scene).
            </span>
          </div>

          <Button onClick={handleFocusTest}>Focus camera on block</Button>
        </CardContent>
      </Card>
    </div>
  );
}
