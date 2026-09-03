import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import logoUrl from "../../assets/logo-caritas-crvena-slogan.png";
import {
  ApiError,
  enterCode,
  getBuildings,
  getSchools,
  placeBlock,
  type BlockInfo,
  type BuildingCategory,
  type BuildingState,
  type School,
} from "../../lib/api";
import { City, type CityHandle } from "../../components/city/City";
import type { CityBuilding, ConstructionQueue } from "../../components/city/types";
import { blueprintForVariant } from "../../components/city/blueprintForVariant";
import { STATIC_CITY_DECOR, STATIC_LANDMARKS, STATIC_DECOR_BUILDINGS } from "../../components/city/staticCityData";
import { useAmbientDecorConstruction } from "../../components/city/useAmbientDecorConstruction";
import { CITY_LAYOUT } from "../../data/cityLayout";
import {
  MONTAGE_BLOCK_COUNT,
  MONTAGE_STAGGER_MS,
  MONTAGE_FINAL_BLOCK_DELAY_MS,
} from "../../components/city/constructionMontageConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../components/ui/input-otp";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";

// Matches server/src/lib/codes.ts DESKTOP_CODE_ALPHABET.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
// input-otp tests raw keystrokes against this pattern *before* onChange ever runs
// (see its native input handler), so lowercase has to be allowed here too, not just
// handled by the onChange's .toUpperCase() below — otherwise it's rejected outright.
const CODE_PATTERN = `^[${CODE_ALPHABET}${CODE_ALPHABET.toLowerCase()}]*$`;
const CODE_LENGTH = 6;

const CATEGORY_LABEL: Record<BuildingCategory, string> = {
  residential: "Residential",
  hospital: "Hospital",
  food: "Food",
  school: "School",
};

const CATEGORY_LABEL_HR: Record<BuildingCategory, string> = {
  residential: "Stambena zgrada",
  hospital: "Bolnica",
  food: "Hrana",
  school: "Škola",
};

// Real city layout (2026-08-13) — replaces the old 4-fixed-plot model.
// Position has never lived in the database (see src/lib/api.ts's
// BuildingState.orderIndex doc comment) and still doesn't; it's joined here
// client-side from src/data/cityLayout.ts, keyed by the same
// `${variant}_${orderIndex}` natural key generateCityLayout.ts's buildingId
// was already designed to match against server/src/scripts/seed.ts's
// (variant, order_index) columns.
const CITY_LAYOUT_BY_ID = new Map(CITY_LAYOUT.map((entry) => [entry.buildingId, entry]));

function buildCityBuilding(b: BuildingState): CityBuilding | null {
  const layout = CITY_LAYOUT_BY_ID.get(`${b.variant}_${b.orderIndex}`);
  if (!layout) {
    // Shouldn't happen in practice — would mean seed.ts's building counts
    // per variant have drifted out of sync with generateCityLayout.ts's
    // BUILDING_SPECS (the one gap this join doesn't cover, see
    // staticCityData.ts's doc comment). Skip rather than crash the kiosk.
    console.warn(`No city-layout entry for building ${b.id} (${b.variant}_${b.orderIndex}) — skipping`);
    return null;
  }
  return {
    id: b.id,
    category: b.category,
    position: { x: layout.x, z: layout.z },
    blueprint: blueprintForVariant(b.variant, b.category, b.totalBlocks, b.id),
    totalBlocks: b.totalBlocks,
    // Only the currently in_progress building (at most one per category) is
    // shown one block behind — the boot-reveal effect plays that last
    // block's animation to catch back up. queued buildings are genuinely at
    // 0; completed ones show their real final count outright (applying the
    // same -1 trick to a completed building would leave it permanently
    // missing its last block, since addBlock() only ever targets the
    // active building per category).
    completedBlocks: b.status === "in_progress" ? Math.max(0, b.completedBlocks - 1) : b.completedBlocks,
  };
}

type Phase =
  | { phase: "loading" }
  | { phase: "load_error" }
  | { phase: "entry"; error?: string }
  | { phase: "needs_school"; code: string; category: BuildingCategory; error?: string }
  | { phase: "constructing" }
  | { phase: "placed"; block: BlockInfo }
  | { phase: "existing"; block: BlockInfo };

function ProgressBlock({ block }: { block: BlockInfo }) {
  const pct = block.totalBlocks > 0 ? (block.completedBlocks / block.totalBlocks) * 100 : 0;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm">
        {CATEGORY_LABEL[block.category]} — {block.buildingVariant}
      </p>
      <Progress value={pct} />
      <p className="text-muted-foreground text-xs">
        {block.completedBlocks}/{block.totalBlocks} placed
      </p>
    </div>
  );
}

function EntryStep({ error, onSubmit }: { error?: string; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Kiosk is a walk-up shared desktop — the code entry should be ready to
  // type into the moment the screen appears, no click required.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Card className="pointer-events-auto w-full max-w-md bg-card/95 backdrop-blur">
      <CardContent className="flex flex-col items-center gap-6 pt-6">
        <img src={logoUrl} alt="GRADiMIR" className="h-16 w-auto" />

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-lg font-bold">Hvala na donaciji 🙏</p>
          <p className="text-sm">Vaš kod bit će aktiviran nakon potvrde.</p>
        </div>

        <p className="text-muted-foreground text-center text-sm">
          U sljedećem koraku odabrat ćete svoju školu i dodati jednu digitalnu kockicu u GRADiMIR
          svijet. Ta kockica predstavlja stvarnu novčanu donaciju koja pomaže obiteljima u
          potrebi. Nastavite i pogledajte kako svaki doprinos zajednički pomaže graditi nešto
          veće.
        </p>

        <div className="w-full border-t" />

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="font-bold">Unesite svoj kod</p>
          <p className="text-muted-foreground text-sm">Upišite kod prikazan na vašem telefonu.</p>
        </div>

        <InputOTP
          ref={inputRef}
          value={code}
          onChange={(v) => setCode(v.toUpperCase())}
          maxLength={CODE_LENGTH}
          pattern={CODE_PATTERN}
          onComplete={onSubmit}
        >
          <InputOTPGroup>
            {Array.from({ length: CODE_LENGTH }, (_, i) => (
              <InputOTPSlot
                key={i}
                index={i}
                className="h-11 w-11 rounded-md border-0 bg-muted text-base first:rounded-md last:rounded-md"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button
          className="bg-neutral-500 text-white hover:bg-neutral-600"
          disabled={code.length !== CODE_LENGTH}
          onClick={() => onSubmit(code)}
        >
          Nastavi
        </Button>
      </CardContent>
    </Card>
  );
}

function SchoolStep({
  category,
  error,
  onConfirm,
  onBack,
}: {
  category: BuildingCategory;
  error?: string;
  onConfirm: (schoolId: number) => void;
  onBack: () => void;
}) {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<number | undefined>();
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getSchools()
      .then(setSchools)
      .catch(() => setLoadError(true));
  }, []);

  const selected = schools.find((s) => s.id === schoolId);

  return (
    <Card className="pointer-events-auto w-full max-w-md bg-card/95 backdrop-blur">
      <CardContent className="flex flex-col items-center gap-6 pt-6">
        <img src={logoUrl} alt="GRADiMIR" className="h-16 w-auto" />

        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="font-bold">Koja škola?</p>
            <p className="text-muted-foreground text-sm">
              Postavljate {CATEGORY_LABEL_HR[category]} kockicu — odaberite školu koju predstavljate.
            </p>
          </div>

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between">
                {selected ? selected.name : "Odaberite školu"}
                <ChevronsUpDown className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput placeholder="Pretraži škole…" />
                <CommandList>
                  <CommandEmpty>Škola nije pronađena.</CommandEmpty>
                  <CommandGroup>
                    {schools.map((s) => (
                      <CommandItem
                        key={s.id}
                        value={s.name}
                        onSelect={() => {
                          setSchoolId(s.id);
                          setOpen(false);
                        }}
                      >
                        <Check className={s.id === schoolId ? "opacity-100" : "opacity-0"} />
                        {s.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {loadError && (
            <p className="text-destructive text-sm">
              Nije moguće učitati popis škola. Pokušajte ponovno učitati.
            </p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              Natrag
            </Button>
            <Button
              className="bg-neutral-500 text-white hover:bg-neutral-600"
              disabled={!schoolId}
              onClick={() => schoolId && onConfirm(schoolId)}
            >
              Uđi u igru
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Kiosk() {
  const cityRef = useRef<CityHandle>(null);
  const [cityData, setCityData] = useState<{
    rows: BuildingState[];
    buildings: CityBuilding[];
    queue: ConstructionQueue;
  } | null>(null);
  const [state, setState] = useState<Phase>({ phase: "loading" });
  const revealedOnLoad = useRef(false);

  useEffect(() => {
    getBuildings()
      .then((rows) => {
        const buildings = rows
          .map(buildCityBuilding)
          .filter((b): b is CityBuilding => b !== null);
        // Only the in_progress row per category drives the active queue —
        // rows also now include every queued/completed building (2026-08-13,
        // widened from "in_progress only"), so this can't just take
        // whichever row of a category comes last in the array anymore.
        const queue: ConstructionQueue = {};
        for (const row of rows) {
          if (row.status === "in_progress") queue[row.category] = row.id;
        }
        setCityData({ rows, buildings: [...buildings, ...STATIC_LANDMARKS, ...STATIC_DECOR_BUILDINGS], queue });
        setState({ phase: "entry" });
      })
      .catch(() => setState({ phase: "load_error" }));
  }, []);

  // Boot animation: replay the most recent real block on each category's
  // active building so the kiosk always opens with a "here's what's been
  // built" reveal. Scoped to in_progress rows only — a completed building's
  // completedBlocks is also > 0, but it isn't the active building for its
  // category anymore, so addBlock(category) wouldn't touch it anyway;
  // filtering here just avoids redundant no-op calls for every completed
  // building once all 160 rows are loaded instead of just the active 4.
  useEffect(() => {
    if (!cityData || revealedOnLoad.current) return;
    revealedOnLoad.current = true;
    for (const row of cityData.rows) {
      if (row.status === "in_progress" && row.completedBlocks > 0) {
        cityRef.current?.addBlock(row.category);
      }
    }
  }, [cityData]);

  // Purely cosmetic "the city feels alive" effect — cycles a small local
  // cluster of decoration buildings through construction forever, entirely
  // client-side. See useAmbientDecorConstruction's own doc comment.
  useAmbientDecorConstruction(cityRef, STATIC_DECOR_BUILDINGS, cityData !== null);

  function handleEnter(code: string) {
    enterCode(code)
      .then((res) => {
        if (res.status === "existing") {
          cityRef.current?.focusOnBlock(res.block.buildingId, res.block.blockIndex);
          cityRef.current?.markOwnBlock(res.block.buildingId, res.block.blockIndex);
          setState({ phase: "existing", block: res.block });
        } else {
          setState({ phase: "needs_school", code, category: res.category });
        }
      })
      .catch((err) => {
        const message =
          err instanceof ApiError && err.code === "invalid_or_expired_code"
            ? "Taj kod nije važeći ili je istekao."
            : "Nešto je pošlo po zlu — pokušajte ponovno.";
        setState({ phase: "entry", error: message });
      });
  }

  function handleConfirm(code: string, category: BuildingCategory, schoolId: number) {
    placeBlock(code, schoolId)
      .then((res) => {
        setState({ phase: "constructing" });
        // Catch this kiosk's local scene up to the server's authoritative
        // pre-placement count before doing anything else (2026-08-27, real
        // bug: two kiosks placing into the same actively-building building
        // around the same time — e.g. two different QR codes in the same
        // category — each still had the OTHER's local `node.visibleCount`
        // sitting stale, since neither had polled since the other's
        // placement. playConstructionMontage/addBlock both reveal blocks
        // starting from that local count, not from the server-confirmed
        // blockIndex this response just gave us, so both kiosks' montages
        // played out ending at the SAME (stale, no longer next-available)
        // index instead of their own real, distinct one — visually placing
        // the new block in the same spot on both screens, even though the
        // DB had correctly serialized two different block_index rows the
        // whole time (confirmed correct on reload, which does a full sync).
        // A silent, instant setVisibleCount to blockIndex (never higher —
        // this is the count BEFORE this block, so any block this kiosk
        // missed from the other placement pops in with no animation, but
        // the montage/reveal below then lands on the right one) fixes
        // it without touching the server, which was never the problem.
        cityRef.current?.setVisibleCount(res.block.buildingId, res.block.blockIndex);
        // Frame the block *before* the montage starts, not after — otherwise the
        // staggered reveal plays out at the wide establishing shot, where
        // individual voxels are sub-pixel and the stagger is imperceptible.
        cityRef.current?.focusOnBlock(res.block.buildingId, res.block.blockIndex);
        cityRef.current?.playConstructionMontage(
          res.block.buildingId,
          MONTAGE_BLOCK_COUNT,
          MONTAGE_STAGGER_MS,
          () => {
            setTimeout(() => {
              cityRef.current?.addBlock(category);
              cityRef.current?.markOwnBlock(res.block.buildingId, res.block.blockIndex);
              setState({ phase: "placed", block: res.block });
            }, MONTAGE_FINAL_BLOCK_DELAY_MS);
          }
        );
      })
      .catch((err) => {
        const message =
          err instanceof ApiError
            ? {
                unknown_school: "Ta škola nije prepoznata.",
                category_complete: "Ova kategorija je već završena!",
                block_already_placed: "Ovaj blok je već postavljen.",
                invalid_or_expired_code: "Taj kod nije važeći ili je istekao.",
              }[err.code] ?? "Nešto je pošlo po zlu — pokušajte ponovno."
            : "Nešto je pošlo po zlu — pokušajte ponovno.";
        setState({ phase: "needs_school", code, category, error: message });
      });
  }

  const showsModal = state.phase === "entry" || state.phase === "needs_school";

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background">
      {cityData && (
        <City
          ref={cityRef}
          initialBuildings={cityData.buildings}
          initialQueue={cityData.queue}
          decor={STATIC_CITY_DECOR}
          style={{ position: "absolute", inset: 0 }}
        />
      )}

      {state.phase === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      )}

      {state.phase === "load_error" && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Couldn't load the city</CardTitle>
              <CardDescription>Try refreshing the page.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {showsModal && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 p-4 backdrop-blur-sm">
          {state.phase === "entry" && <EntryStep error={state.error} onSubmit={handleEnter} />}
          {state.phase === "needs_school" && (
            <SchoolStep
              category={state.category}
              error={state.error}
              onBack={() => setState({ phase: "entry" })}
              onConfirm={(schoolId) => handleConfirm(state.code, state.category, schoolId)}
            />
          )}
        </div>
      )}

      {(state.phase === "placed" || state.phase === "existing") && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
          <Card className="w-full max-w-lg bg-card/90 backdrop-blur">
            <CardContent className="flex items-center gap-4 py-3">
              <div className="flex-1">
                <p className="font-medium">
                  {state.phase === "placed" ? "Block placed!" : "Already placed"}
                </p>
                <ProgressBlock block={state.block} />
              </div>
              <Button
                onClick={() => {
                  cityRef.current?.resetCamera();
                  setState({ phase: "entry" });
                }}
              >
                Scan next block
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
