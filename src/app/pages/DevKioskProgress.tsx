import { useMemo, useRef, useState } from "react";
import { City, type CityHandle } from "../../components/city/City";
import type { CityBuilding } from "../../components/city/types";
import { blueprintForVariant } from "../../components/city/blueprintForVariant";
import { STATIC_CITY_DECOR, STATIC_LANDMARKS } from "../../components/city/staticCityData";
import { CITY_LAYOUT, type CityLayoutEntry } from "../../data/cityLayout";
import type { BuildingCategory } from "../../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Slider } from "../components/ui/slider";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";

// Dev-only: renders the exact real 158-building city (same layout/decor as
// /kiosk) but replaces QR scanning/code-entry/school-picking with sliders
// that scrub the whole city's construction state directly — for seeing how
// the finished city will look as it fills in, without a single real
// placement. Never touches the backend/DB.

const CATEGORIES: BuildingCategory[] = ["residential", "food", "school", "hospital"];
const CATEGORY_LABEL: Record<BuildingCategory, string> = {
  residential: "Residential",
  food: "Food",
  school: "School",
  hospital: "Hospital",
};

// Matches server/src/scripts/seed.ts's BUILDINGS array variant order per
// category — needed to replicate the real rollover's tie-break exactly
// (placeBlock.ts: `ORDER BY order_index ASC, id ASC`; order_index resets to
// 0 per variant, and id ASC — insertion order — equals this list's order
// whenever order_index ties across variants in the same category).
const CATEGORY_VARIANT_ORDER: Record<BuildingCategory, string[]> = {
  residential: ["house", "short_apartment", "tall_apartment"],
  food: ["food_bank", "restaurant"],
  school: ["school"],
  hospital: ["hospital_small", "hospital_medium", "hospital_large"],
};

function orderIndexOf(entry: CityLayoutEntry): number {
  // buildingId is exactly `${variant}_${orderIndex}` (cityLayout.ts's doc comment).
  return Number(entry.buildingId.slice(entry.variant.length + 1));
}

// One category's buildings in the exact order the real backend fills them —
// a building only starts once the previous one in this sequence is fully
// complete (placeBlock.ts's rollover query, replicated client-side).
function rolloverSequence(category: BuildingCategory): CityLayoutEntry[] {
  const variantRank = CATEGORY_VARIANT_ORDER[category];
  return CITY_LAYOUT.filter((e) => e.category === category).sort((a, b) => {
    const oa = orderIndexOf(a);
    const ob = orderIndexOf(b);
    if (oa !== ob) return oa - ob;
    return variantRank.indexOf(a.variant) - variantRank.indexOf(b.variant);
  });
}

const CATEGORY_SEQUENCE = Object.fromEntries(
  CATEGORIES.map((c) => [c, rolloverSequence(c)])
) as Record<BuildingCategory, CityLayoutEntry[]>;

const CATEGORY_TOTAL = Object.fromEntries(
  CATEGORIES.map((c) => [c, CATEGORY_SEQUENCE[c].reduce((sum, e) => sum + e.totalBlocks, 0)])
) as Record<BuildingCategory, number>;

const CITY_TOTAL_BLOCKS = CATEGORIES.reduce((sum, c) => sum + CATEGORY_TOTAL[c], 0);

// Fills a category's buildings one at a time to completion given `placed`
// total blocks placed so far — mirrors the real rollover exactly (only ever
// one partially-built building per category, everything before it in the
// sequence is full, everything after is untouched).
function distribute(sequence: CityLayoutEntry[], placed: number): Map<string, number> {
  const result = new Map<string, number>();
  let remaining = placed;
  for (const entry of sequence) {
    const count = Math.max(0, Math.min(entry.totalBlocks, remaining));
    result.set(entry.buildingId, count);
    remaining -= count;
  }
  return result;
}

export default function DevKioskProgress() {
  const cityRef = useRef<CityHandle>(null);
  const [placed, setPlaced] = useState<Record<BuildingCategory, number>>({
    residential: 0,
    food: 0,
    school: 0,
    hospital: 0,
  });

  // Tracks the last count actually pushed to the scene per building, so
  // slider drags only call setVisibleCount for buildings whose count
  // genuinely changed instead of the whole category every tick. Starts
  // pre-populated at 0 (matching initialBuildings below) so the very first
  // interaction doesn't fire a wave of redundant "set to 0" calls.
  const appliedRef = useRef(new Map<string, number>(CITY_LAYOUT.map((e) => [e.buildingId, 0])));

  // Built once — full 158-building layout + landmarks, all starting empty.
  // Sliders drive the scene afterward purely via the imperative
  // setVisibleCount (same pattern DevPreview.tsx uses for its single-building
  // slider) — React state here only tracks what the UI displays, never what
  // the scene renders.
  const initialBuildings = useMemo<CityBuilding[]>(
    () => [
      ...CITY_LAYOUT.map(
        (entry): CityBuilding => ({
          id: entry.buildingId,
          category: entry.category,
          position: { x: entry.x, z: entry.z },
          blueprint: blueprintForVariant(entry.variant, entry.category, entry.totalBlocks, entry.buildingId),
          totalBlocks: entry.totalBlocks,
          completedBlocks: 0,
        })
      ),
      ...STATIC_LANDMARKS,
    ],
    []
  );

  function applyCategory(category: BuildingCategory, nextPlaced: number) {
    const dist = distribute(CATEGORY_SEQUENCE[category], nextPlaced);
    for (const [buildingId, count] of dist) {
      if (appliedRef.current.get(buildingId) !== count) {
        appliedRef.current.set(buildingId, count);
        cityRef.current?.setVisibleCount(buildingId, count);
      }
    }
  }

  function handleCategoryChange(category: BuildingCategory, next: number) {
    if (Number.isNaN(next)) return;
    const clamped = Math.max(0, Math.min(CATEGORY_TOTAL[category], Math.round(next)));
    setPlaced((p) => ({ ...p, [category]: clamped }));
    applyCategory(category, clamped);
  }

  const overallPlaced = CATEGORIES.reduce((sum, c) => sum + placed[c], 0);
  const overallPct = CITY_TOTAL_BLOCKS > 0 ? (overallPlaced / CITY_TOTAL_BLOCKS) * 100 : 0;

  // Scales every category to the same percentage of its own total — the
  // "scrub the whole city at once" control. Per-category sliders below still
  // allow diverging from this afterward.
  function handleOverallChange(pct: number) {
    if (Number.isNaN(pct)) return;
    const clamped = Math.max(0, Math.min(100, pct));
    const next = { ...placed };
    for (const c of CATEGORIES) {
      next[c] = Math.round((clamped / 100) * CATEGORY_TOTAL[c]);
      applyCategory(c, next[c]);
    }
    setPlaced(next);
  }

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background">
      <City
        ref={cityRef}
        initialBuildings={initialBuildings}
        decor={STATIC_CITY_DECOR}
        style={{ position: "absolute", inset: 0 }}
      />

      <Card className="absolute left-4 top-4 w-96 bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle>Whole-city build progress</CardTitle>
          <CardDescription>
            Dev-only — scrubs the real 158-building city&apos;s construction state directly.
            Doesn&apos;t touch the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label>Overall progress</Label>
            <Slider
              value={[overallPct]}
              min={0}
              max={100}
              step={0.1}
              onValueChange={([v]) => handleOverallChange(v)}
            />
            <span className="text-muted-foreground text-xs">
              {overallPlaced.toLocaleString()} / {CITY_TOTAL_BLOCKS.toLocaleString()} blocks (
              {overallPct.toFixed(1)}%)
            </span>
          </div>

          {CATEGORIES.map((category) => (
            <div key={category} className="flex flex-col gap-1.5">
              <Label>{CATEGORY_LABEL[category]}</Label>
              <Slider
                value={[placed[category]]}
                min={0}
                max={CATEGORY_TOTAL[category]}
                step={1}
                onValueChange={([v]) => handleCategoryChange(category, v)}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={CATEGORY_TOTAL[category]}
                  value={placed[category]}
                  onChange={(e) => handleCategoryChange(category, Number(e.target.value))}
                  className="w-28"
                />
                <span className="text-muted-foreground text-xs">
                  / {CATEGORY_TOTAL[category].toLocaleString()}
                </span>
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOverallChange(0)}>
              Empty
            </Button>
            <Button variant="outline" onClick={() => handleOverallChange(100)}>
              Full
            </Button>
            <Button variant="outline" onClick={() => cityRef.current?.resetCamera()}>
              Reset camera
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
