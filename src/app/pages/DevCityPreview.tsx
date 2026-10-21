import { useEffect, useMemo, useRef, useState } from "react";
import { City, type CityHandle } from "../../components/city/City";
import type { CityBuilding, CityDecor } from "../../components/city/types";
import type { CameraSnapshot, CameraState } from "../../components/city/cityScene";
import { blueprintForVariant } from "../../components/city/blueprintForVariant";
import { STATIC_CITY_DECOR, STATIC_LANDMARKS, STATIC_DECOR_BUILDINGS } from "../../components/city/staticCityData";
import { CITY_LAYOUT } from "../../data/cityLayout";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

// Dev-only preview of the full Phase 2/3 static layout: all 160 real
// buildings (src/data/cityLayout.ts) placed inside a block grid, fully
// built, at their generated positions, plus the decoration-only buildings
// (src/data/cityDecorBuildings.ts), the full decor/terrain, and the two
// hand-placed landmarks (church, fountain) — src/components/city/staticCityData.ts,
// shared with the live kiosk (2026-08-13) so both render the exact same
// city. Purely client-side, never touches the real backend/DB, never
// reachable in a production build (see main.tsx).
export default function DevCityPreview() {
  const cityRef = useRef<CityHandle>(null);

  const buildings = useMemo<CityBuilding[]>(() => {
    const realBuildings = CITY_LAYOUT.map((entry) => ({
      id: entry.buildingId,
      category: entry.category,
      position: { x: entry.x, z: entry.z },
      blueprint: blueprintForVariant(entry.variant, entry.category, entry.totalBlocks, entry.buildingId),
      totalBlocks: entry.totalBlocks,
      completedBlocks: entry.totalBlocks,
    }));

    return [...realBuildings, ...STATIC_LANDMARKS, ...STATIC_DECOR_BUILDINGS];
  }, []);

  const decor: CityDecor = STATIC_CITY_DECOR;

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background">
      <City
        ref={cityRef}
        initialBuildings={buildings}
        decor={decor}
        style={{ position: "absolute", inset: 0 }}
      />

      <Card className="absolute left-4 top-4 w-80 bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle>Whole-city layout preview</CardTitle>
          <CardDescription>
            Dev-only — {buildings.length} buildings, {decor.parks.length} parks,{" "}
            {decor.lakes.length} lakes, {decor.roads.length} road segments,{" "}
            {(decor.plazas ?? []).length} plazas. Scroll out to see the whole terrain.
          </CardDescription>
        </CardHeader>
      </Card>

      <CameraLogger cityRef={cityRef} />
    </div>
  );
}

interface LoggedShot {
  id: number;
  time: string;
  snapshot: CameraSnapshot;
  screenshot: string;
}

// Shot JSON = exactly what setCameraState needs plus the derived numbers
// (heading/tilt/distance/viewport) for reading at a glance — pasting it back
// into "Apply" ignores the derived fields.
function shotJson(s: CameraSnapshot): string {
  return JSON.stringify(s, null, 2);
}

// navigator.clipboard only exists in secure contexts, and the dev server is
// usually opened over the LAN IP (plain http) — fall back to execCommand.
function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    void navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

const isVec = (v: unknown): v is { x: number; y: number; z: number } =>
  !!v &&
  typeof v === "object" &&
  ["x", "y", "z"].every((k) => typeof (v as Record<string, unknown>)[k] === "number");

const fmt = (n: number) => n.toFixed(2);

// Dev-only camera logger (2026-10-21, user request): orbit/pan/zoom to an
// exact shot, then "Log camera" prints position/target/fov (+ heading, tilt,
// distance, viewport) to the console, copies it as JSON, and downloads a
// screenshot. Logged shots can be jumped back to, or any shot JSON pasted
// into "Apply" to reproduce it.
function CameraLogger({ cityRef }: { cityRef: React.RefObject<CityHandle | null> }) {
  const [live, setLive] = useState<CameraSnapshot | null>(null);
  const [shots, setShots] = useState<LoggedShot[]>([]);
  const [applyText, setApplyText] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    const id = setInterval(() => setLive(cityRef.current?.getCameraState() ?? null), 200);
    return () => clearInterval(id);
  }, [cityRef]);

  function handleLog() {
    const city = cityRef.current;
    const snapshot = city?.getCameraState();
    const screenshot = city?.captureScreenshot();
    if (!snapshot || !screenshot) return;
    const id = nextId.current++;
    const time = new Date().toISOString().replace(/[:.]/g, "-");
    console.log(`[camera] shot #${id}`, snapshot);
    console.log(`[camera] shot #${id} JSON\n${shotJson(snapshot)}`);
    copyText(shotJson(snapshot));
    downloadDataUrl(screenshot, `camera-shot-${id}-${time}.png`);
    setShots((prev) => [{ id, time, snapshot, screenshot }, ...prev]);
  }

  function handleApply() {
    try {
      const { position, target, fov } = JSON.parse(applyText) as Partial<CameraState>;
      if (!isVec(position) || !isVec(target)) throw new Error("needs position {x,y,z} and target {x,y,z}");
      if (fov !== undefined && typeof fov !== "number") throw new Error("fov must be a number");
      cityRef.current?.setCameraState({ position, target, fov });
      setApplyError(null);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleFov(value: string) {
    const fov = Number(value);
    const cur = cityRef.current?.getCameraState();
    if (!cur || !Number.isFinite(fov) || fov < 5 || fov > 120) return;
    cityRef.current?.setCameraState({ position: cur.position, target: cur.target, fov });
  }

  return (
    <Card className="absolute right-4 top-4 max-h-[calc(100vh-2rem)] w-96 overflow-y-auto bg-card/95 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Camera logger</CardTitle>
        <Button size="sm" variant="ghost" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "Show" : "Hide"}
        </Button>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-4 text-sm">
          {live && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
              <dt className="text-muted-foreground">position</dt>
              <dd>{fmt(live.position.x)}, {fmt(live.position.y)}, {fmt(live.position.z)}</dd>
              <dt className="text-muted-foreground">target</dt>
              <dd>{fmt(live.target.x)}, {fmt(live.target.y)}, {fmt(live.target.z)}</dd>
              <dt className="text-muted-foreground">heading</dt>
              <dd>{fmt(live.headingDeg)}° (0 N · 90 E · 180 S · 270 W)</dd>
              <dt className="text-muted-foreground">tilt</dt>
              <dd>{fmt(live.tiltDeg)}° below horizon</dd>
              <dt className="text-muted-foreground">distance</dt>
              <dd>{fmt(live.distance)}</dd>
              <dt className="text-muted-foreground">fov</dt>
              <dd className="flex items-center gap-2">
                <Input
                  key={live.fov}
                  type="number"
                  min={5}
                  max={120}
                  step={1}
                  defaultValue={live.fov}
                  onBlur={(e) => handleFov(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFov(e.currentTarget.value)}
                  className="h-7 w-20 font-mono text-xs"
                />
                <span>° vertical</span>
              </dd>
              <dt className="text-muted-foreground">viewport</dt>
              <dd>
                {live.viewport.width}×{live.viewport.height} (aspect {live.viewport.aspect})
              </dd>
            </dl>
          )}

          <div className="flex gap-2">
            <Button onClick={handleLog} className="flex-1">
              Log camera
            </Button>
            <Button variant="outline" onClick={() => cityRef.current?.resetCamera()}>
              Reset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Logs to the console, copies the shot JSON to the clipboard and downloads a screenshot.
          </p>

          <div className="space-y-2">
            <Textarea
              value={applyText}
              onChange={(e) => setApplyText(e.target.value)}
              placeholder={'Paste shot JSON — {"position":{…},"target":{…},"fov":50}'}
              className="h-20 font-mono text-xs"
            />
            <Button variant="outline" size="sm" onClick={handleApply} disabled={!applyText.trim()}>
              Apply
            </Button>
            {applyError && <p className="text-xs text-destructive">{applyError}</p>}
          </div>

          {shots.length > 0 && (
            <ul className="space-y-3">
              {shots.map((shot) => (
                <li key={shot.id} className="space-y-1 rounded-md border p-2">
                  <img src={shot.screenshot} alt={`Shot ${shot.id}`} className="w-full rounded" />
                  <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-xs">
                    <span>
                      #{shot.id} · {fmt(shot.snapshot.headingDeg)}° · tilt {fmt(shot.snapshot.tiltDeg)}°
                    </span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => cityRef.current?.setCameraState(shot.snapshot)}>
                        Go to
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => copyText(shotJson(shot.snapshot))}>
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadDataUrl(shot.screenshot, `camera-shot-${shot.id}-${shot.time}.png`)}
                      >
                        PNG
                      </Button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}
