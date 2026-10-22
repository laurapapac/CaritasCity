import { useMemo, useRef, useState } from "react";
import { City, type CityHandle } from "../../components/city/City";
import type { CityBuilding } from "../../components/city/types";
import { blueprintForVariant } from "../../components/city/blueprintForVariant";
import { STATIC_CITY_DECOR, STATIC_LANDMARKS, STATIC_DECOR_BUILDINGS } from "../../components/city/staticCityData";
import { CITY_LAYOUT, type CityLayoutEntry } from "../../data/cityLayout";
import { CameraLogger } from "../components/CameraLogger";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";

// Dev-only (2026-10-22, user request): the real 160-building city, fully
// built. Tick buildings to unbuild them (0 blocks), pick one of them, and
// build its next N blocks automatically — one per tick, each dropping in
// exactly like the ambient decoration-building blocks (cityScene.ts's
// playBuildRun). Unticking a building restores it fully built. Like
// /dev/kiosk-progress it drives the scene imperatively and never touches
// the backend/DB.

const ENTRY_BY_ID = new Map(CITY_LAYOUT.map((e) => [e.buildingId, e]));

const DEFAULT_BLOCKS = 50;
// Same pace as the ambient decoration loop (useAmbientDecorConstruction.ts's STAGGER_MS).
const DEFAULT_STAGGER_MS = 1000;

function entryLabel(e: CityLayoutEntry) {
  return `${e.buildingId} · ${e.category} · ${e.totalBlocks.toLocaleString()} blocks`;
}

export default function DevBuildRun() {
  const cityRef = useRef<CityHandle>(null);
  // Unbuilt buildings, in the order they were picked, with their visible block count.
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  // Raw input text — clamping on every keystroke would turn a cleared field
  // into the minimum and swallow what's typed next.
  const [blocksText, setBlocksText] = useState(String(DEFAULT_BLOCKS));
  const [staggerText, setStaggerText] = useState(String(DEFAULT_STAGGER_MS));
  const blocks = Math.max(1, Math.round(Number(blocksText)) || 1);
  const staggerMs = Math.max(16, Math.round(Number(staggerText)) || DEFAULT_STAGGER_MS);

  const initialBuildings = useMemo<CityBuilding[]>(
    () => [
      ...CITY_LAYOUT.map(
        (entry): CityBuilding => ({
          id: entry.buildingId,
          category: entry.category,
          position: { x: entry.x, z: entry.z },
          blueprint: blueprintForVariant(entry.variant, entry.category, entry.totalBlocks, entry.buildingId),
          totalBlocks: entry.totalBlocks,
          completedBlocks: entry.totalBlocks,
        })
      ),
      ...STATIC_LANDMARKS,
      ...STATIC_DECOR_BUILDINGS,
    ],
    []
  );

  const unbuiltIds = [...counts.keys()];
  // With only one unbuilt building there's nothing to choose — it's the one.
  const activeId = unbuiltIds.length === 1 ? unbuiltIds[0] : chosenId && counts.has(chosenId) ? chosenId : null;
  const active = activeId ? ENTRY_BY_ID.get(activeId)! : null;
  const activeCount = activeId ? counts.get(activeId)! : 0;

  const visibleEntries = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q
      ? CITY_LAYOUT.filter((e) => e.buildingId.toLowerCase().includes(q) || e.category.includes(q))
      : CITY_LAYOUT;
  }, [filter]);

  function setCount(id: string, n: number) {
    setCounts((prev) => (prev.has(id) ? new Map(prev).set(id, n) : prev));
  }

  function stopRun() {
    if (runningId) cityRef.current?.stopAmbientCycle(runningId);
    setRunningId(null);
  }

  function toggleBuilding(entry: CityLayoutEntry, unbuild: boolean) {
    const id = entry.buildingId;
    if (unbuild) {
      cityRef.current?.setVisibleCount(id, 0);
      setCounts((prev) => new Map(prev).set(id, 0));
    } else {
      if (runningId === id) stopRun();
      cityRef.current?.setVisibleCount(id, entry.totalBlocks);
      setCounts((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function restoreAll() {
    stopRun();
    for (const id of counts.keys()) cityRef.current?.setVisibleCount(id, ENTRY_BY_ID.get(id)!.totalBlocks);
    setCounts(new Map());
    setChosenId(null);
  }

  function resetActive() {
    if (!activeId) return;
    if (runningId === activeId) stopRun();
    cityRef.current?.setVisibleCount(activeId, 0);
    setCount(activeId, 0);
  }

  // Frames the block that would be built next (or the top one once full).
  function focusActive() {
    if (!active) return;
    cityRef.current?.focusOnBlock(active.buildingId, Math.min(activeCount, active.totalBlocks - 1));
  }

  function build() {
    if (!active || runningId) return;
    const id = active.buildingId;
    setRunningId(id);
    cityRef.current?.playBuildRun(
      id,
      blocks,
      staggerMs,
      (n) => setCount(id, n),
      () => setRunningId((cur) => (cur === id ? null : cur))
    );
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
          <CardTitle>Build a building</CardTitle>
          <CardDescription>
            Dev-only — the whole city starts built. Tick buildings to unbuild them, pick one, then build
            its next blocks with the decoration drop-in. Doesn&apos;t touch the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto text-sm">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="building-filter">1. Unbuild buildings</Label>
            <Input
              id="building-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter — e.g. hospital, house_12"
            />
            <ul className="max-h-48 overflow-y-auto rounded-md border p-1">
              {visibleEntries.map((e) => (
                <li key={e.buildingId}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted">
                    <Checkbox
                      checked={counts.has(e.buildingId)}
                      onCheckedChange={(v) => toggleBuilding(e, v === true)}
                    />
                    <span className="font-mono text-xs">{entryLabel(e)}</span>
                  </label>
                </li>
              ))}
              {visibleEntries.length === 0 && (
                <li className="px-1.5 py-1 text-xs text-muted-foreground">No buildings match.</li>
              )}
            </ul>
          </div>

          {unbuiltIds.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>2. Building to build</Label>
              <RadioGroup value={activeId ?? ""} onValueChange={setChosenId} className="gap-1">
                {unbuiltIds.map((id) => {
                  const e = ENTRY_BY_ID.get(id)!;
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-2 font-mono text-xs">
                      <RadioGroupItem value={id} className="border-foreground/50" />
                      <span>
                        {id} — {counts.get(id)!.toLocaleString()} / {e.totalBlocks.toLocaleString()}
                        {runningId === id && " · building…"}
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
              <Button size="sm" variant="outline" className="self-start" onClick={restoreAll}>
                Restore all to built
              </Button>
            </div>
          )}

          {active && (
            <div className="flex flex-col gap-2">
              <Label>3. Build {active.buildingId}</Label>
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Blocks</span>
                  <Input
                    type="number"
                    min={1}
                    value={blocksText}
                    onChange={(e) => setBlocksText(e.target.value)}
                    className="w-24"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">ms per block</span>
                  <Input
                    type="number"
                    min={16}
                    step={50}
                    value={staggerText}
                    onChange={(e) => setStaggerText(e.target.value)}
                    className="w-24"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {runningId ? (
                  <Button onClick={stopRun}>Stop</Button>
                ) : (
                  <Button onClick={build} disabled={activeCount >= active.totalBlocks}>
                    Build {Math.min(blocks, active.totalBlocks - activeCount).toLocaleString()} blocks
                  </Button>
                )}
                <Button variant="outline" onClick={focusActive}>
                  Focus camera
                </Button>
                <Button variant="outline" onClick={resetActive}>
                  Back to 0
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                {activeCount.toLocaleString()} / {active.totalBlocks.toLocaleString()} blocks built
              </span>
            </div>
          )}

          <Button variant="outline" className="self-start" onClick={() => cityRef.current?.resetCamera()}>
            Reset camera
          </Button>
        </CardContent>
      </Card>

      <CameraLogger cityRef={cityRef} />
    </div>
  );
}
