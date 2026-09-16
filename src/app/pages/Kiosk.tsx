import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, KeyRound, MapPin, Menu, Volume2, VolumeX, X } from "lucide-react";
import logoUrl from "../../assets/logo-gradimir.png";
import { playSound, useMuted } from "../../lib/sound";
import { DROP_FALL_DUR_OWN } from "../../components/city/utils";
import {
  ApiError,
  enterCode,
  getBuildings,
  getSchools,
  getStats,
  placeBlock,
  type BlockInfo,
  type BuildingCategory,
  type BuildingState,
  type School,
  type Stats,
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

const CATEGORY_LABEL_HR: Record<BuildingCategory, string> = {
  residential: "Stambena zgrada",
  hospital: "Bolnica",
  food: "Hrana",
  school: "Škola",
};

// What the current block actually builds, by variant (accusative case, for
// "Stavljate kockicu koja gradi ___"). Falls back to the category's own
// generic label (see CATEGORY_LABEL_HR) if the active building's variant
// couldn't be looked up locally — see getActiveVariant in Kiosk().
const VARIANT_WORD_HR: Record<string, string> = {
  school: "školu",
  hospital_small: "bolnicu",
  hospital_medium: "bolnicu",
  hospital_large: "bolnicu",
  restaurant: "restoran",
  food_bank: "pučku kuhinju",
  house: "kuću",
  short_apartment: "zgradu",
  tall_apartment: "zgradu",
};

// Nominative-case display name per variant, for the placed/existing block
// card ("Bolnica — Mala bolnica"). Falls back to the raw variant string
// (see ProgressBlock) if a variant is ever added here without a translation.
const VARIANT_LABEL_HR: Record<string, string> = {
  house: "Kuća",
  short_apartment: "Niža stambena zgrada",
  tall_apartment: "Neboder",
  food_bank: "Pučka kuhinja",
  restaurant: "Restoran",
  school: "Škola",
  hospital_small: "Mala bolnica",
  hospital_medium: "Srednja bolnica",
  hospital_large: "Velika bolnica",
};

// Stats panel targets — match BUILDING_SPECS's totals in
// src/scripts/generateCityLayout.ts (75*1080 + 7*4000 + 2*8000 = 125,000 per
// category * 4 categories = 500,000 overall). 460,000 is the school-donation
// target specifically: 500,000 minus the 40,000 expected to come in as
// external (non-school) donations instead.
const TOTAL_BLOCKS_TARGET = 500_000;
const CATEGORY_BLOCKS_TARGET = 125_000;
const SCHOOL_BLOCKS_TARGET = 460_000;
const STATS_CATEGORIES: BuildingCategory[] = ["residential", "hospital", "food", "school"];

function pct(completed: number, target: number): number {
  return target > 0 ? Math.min(100, (completed / target) * 100) : 0;
}

// Wide desktop (≥1200px) keeps this always visible; below that — phones and
// tablets both — it overlaps the centered modal steps, so it's hidden by
// default and toggled open via a hamburger button instead (see Kiosk()'s
// statsOpen state and the toggle button rendered near the end of Kiosk()).
function StatsPanel({
  overallCompleted,
  categoryCompleted,
  schoolBlocksPlaced,
  mobileOpen,
}: {
  overallCompleted: number;
  categoryCompleted: Record<BuildingCategory, number>;
  schoolBlocksPlaced: number | null;
  mobileOpen: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 min-[1200px]:block ${mobileOpen ? "block" : "hidden"}`}
    >
      <Card className="pointer-events-auto w-56 bg-card/90 backdrop-blur">
        <CardContent className="flex flex-col gap-3 py-4 text-sm">
          <div className="flex flex-col gap-1">
            <p className="flex justify-between font-medium">
              <span>Ukupno</span>
              <span>{pct(overallCompleted, TOTAL_BLOCKS_TARGET).toFixed(2)}%</span>
            </p>
            <Progress value={pct(overallCompleted, TOTAL_BLOCKS_TARGET)} />
          </div>
          {STATS_CATEGORIES.map((category) => (
            <div key={category} className="flex flex-col gap-1">
              <p className="flex justify-between text-muted-foreground">
                <span>{CATEGORY_LABEL_HR[category]}</span>
                <span>{pct(categoryCompleted[category], CATEGORY_BLOCKS_TARGET).toFixed(2)}%</span>
              </p>
              <Progress value={pct(categoryCompleted[category], CATEGORY_BLOCKS_TARGET)} />
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 text-muted-foreground">
            <span>Škole postavile</span>
            <span>
              {schoolBlocksPlaced ?? "…"}/{SCHOOL_BLOCKS_TARGET}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
  | { phase: "welcome" }
  | { phase: "entry"; error?: string }
  | { phase: "needs_school"; code: string; category: BuildingCategory; variant?: string; error?: string }
  | { phase: "browsing" }
  | { phase: "constructing" }
  | { phase: "placed"; block: BlockInfo }
  | { phase: "existing"; block: BlockInfo };

function ProgressBlock({ block }: { block: BlockInfo }) {
  const pct = block.totalBlocks > 0 ? (block.completedBlocks / block.totalBlocks) * 100 : 0;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm">
        {CATEGORY_LABEL_HR[block.category]} — {VARIANT_LABEL_HR[block.buildingVariant] ?? block.buildingVariant}
      </p>
      <Progress value={pct} />
      <p className="text-muted-foreground text-xs">
        {block.completedBlocks}/{block.totalBlocks} kockica stavljeno
      </p>
    </div>
  );
}

function WelcomeStep({ onHasCode, onBrowse }: { onHasCode: () => void; onBrowse: () => void }) {
  return (
    <Card className="pointer-events-auto w-full max-w-md bg-card/95 backdrop-blur">
      <CardContent className="flex flex-col items-center gap-6 pt-6">
        <img src={logoUrl} alt="GRADiMIR" className="-mt-[82px] h-auto max-h-[200px] w-auto max-w-full" />

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-lg font-bold">Dobrodošli u GRADiMIR</p>
          <p className="text-muted-foreground text-sm">Zajedno gradimo grad, kockicu po kockicu.</p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            className="bg-neutral-500 text-white hover:bg-neutral-600"
            onClick={() => {
              playSound("buttonClick");
              onHasCode();
            }}
          >
            Imam kod
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              playSound("buttonClick");
              onBrowse();
            }}
          >
            Pogledaj gradilište
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Replaces WelcomeStep once the city hits 100% (see Kiosk()'s cityComplete)
// — there's nothing left to place a code toward, so "Imam kod" gives way to
// looking up where your own already-placed block ended up. Copy is a
// placeholder; content here is expected to change later.
function CityCompleteStep({ onVisitBlock, onBrowse }: { onVisitBlock: () => void; onBrowse: () => void }) {
  return (
    <Card className="pointer-events-auto w-full max-w-md bg-card/95 backdrop-blur">
      <CardContent className="flex flex-col items-center gap-6 pt-6">
        <img src={logoUrl} alt="GRADiMIR" className="-mt-[82px] h-auto max-h-[200px] w-auto max-w-full" />

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-lg font-bold">Hvala vam! 🙏</p>
          <p className="text-muted-foreground text-sm">
            Grad GRADiMIR je u potpunosti izgrađen zahvaljujući vašoj velikodušnosti.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            className="bg-neutral-500 text-white hover:bg-neutral-600"
            onClick={() => {
              playSound("buttonClick");
              onVisitBlock();
            }}
          >
            Posjeti svoju kockicu
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              playSound("buttonClick");
              onBrowse();
            }}
          >
            Pogledaj grad
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EntryStep({
  error,
  onSubmit,
  onBack,
}: {
  error?: string;
  onSubmit: (code: string) => void;
  onBack: () => void;
}) {
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
        <img src={logoUrl} alt="GRADiMIR" className="-mt-[82px] h-auto max-h-[200px] w-auto max-w-full" />

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
          inputMode="text"
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

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              playSound("buttonClick");
              onBack();
            }}
          >
            Natrag
          </Button>
          <Button
            className="bg-neutral-500 text-white hover:bg-neutral-600"
            disabled={code.length !== CODE_LENGTH}
            onClick={() => {
              playSound("buttonClick");
              onSubmit(code);
            }}
          >
            Nastavi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Several schools across different cities share the same name (e.g.
// multiple "Osnovna škola Vladimir Nazor") — show the city alongside the
// name everywhere the picker displays a school, so they're distinguishable.
function schoolLabel(s: School): string {
  return s.city ? `${s.name} (${s.city})` : s.name;
}

function SchoolStep({
  category,
  variant,
  error,
  onConfirm,
  onBack,
}: {
  category: BuildingCategory;
  variant?: string;
  error?: string;
  onConfirm: (schoolId: number) => void;
  onBack: () => void;
}) {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<number | undefined>();
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSchools()
      .then(setSchools)
      .catch(() => setLoadError(true));
  }, []);

  const selected = schools.find((s) => s.id === schoolId);
  const buildingWord =
    (variant && VARIANT_WORD_HR[variant]) ?? CATEGORY_LABEL_HR[category].toLowerCase();

  return (
    <Card className="pointer-events-auto w-full max-w-md bg-card/95 backdrop-blur">
      <CardContent className="flex flex-col items-center gap-6 pt-6">
        <img src={logoUrl} alt="GRADiMIR" className="-mt-[82px] h-auto max-h-[200px] w-auto max-w-full" />

        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="font-bold">Koja ste škola?</p>
            <p className="text-muted-foreground text-sm">Stavljate kockicu koja gradi {buildingWord}.</p>
            <p className="text-muted-foreground text-sm">Odaberite školu koju predstavljate.</p>
          </div>

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between">
                <span className="min-w-0 flex-1 truncate text-left">
                  {selected ? schoolLabel(selected) : "Odaberite školu"}
                </span>
                <ChevronsUpDown className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput
                  placeholder="Pretraži škole…"
                  onValueChange={() => {
                    // cmdk keeps the list's previous scroll position after
                    // filtering, so the top (best) match can land scrolled
                    // out of view below the fold instead of at the top —
                    // reset it on every keystroke.
                    if (listRef.current) listRef.current.scrollTop = 0;
                  }}
                />
                <CommandList ref={listRef}>
                  <CommandEmpty>Škola nije pronađena.</CommandEmpty>
                  <CommandGroup>
                    {schools.map((s) => (
                      <CommandItem
                        key={s.id}
                        value={schoolLabel(s)}
                        onSelect={() => {
                          setSchoolId(s.id);
                          setOpen(false);
                        }}
                      >
                        <Check className={s.id === schoolId ? "opacity-100" : "opacity-0"} />
                        {schoolLabel(s)}
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
            <Button
              variant="outline"
              onClick={() => {
                playSound("buttonClick");
                onBack();
              }}
            >
              Natrag
            </Button>
            <Button
              className="bg-neutral-500 text-white hover:bg-neutral-600"
              disabled={!schoolId}
              onClick={() => {
                playSound("buttonClick");
                if (schoolId) onConfirm(schoolId);
              }}
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
  const [liveBuildings, setLiveBuildings] = useState<CityBuilding[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const revealedOnLoad = useRef(false);

  // Real (non-decor) building ids, to exclude STATIC_LANDMARKS/
  // STATIC_DECOR_BUILDINGS from the stats panel's totals below — those are
  // purely cosmetic and aren't part of the real 500,000-block target.
  const realBuildingIds = useMemo(
    () => new Set((cityData?.rows ?? []).map((r) => r.id)),
    [cityData],
  );

  const { overallCompleted, categoryCompleted } = useMemo(() => {
    const perCategory: Record<BuildingCategory, number> = {
      residential: 0,
      hospital: 0,
      food: 0,
      school: 0,
    };
    let total = 0;
    for (const b of liveBuildings) {
      if (!realBuildingIds.has(b.id)) continue;
      perCategory[b.category] += b.completedBlocks;
      total += b.completedBlocks;
    }
    return { overallCompleted: total, categoryCompleted: perCategory };
  }, [liveBuildings, realBuildingIds]);

  const cityComplete = overallCompleted >= TOTAL_BLOCKS_TARGET;
  const [muted, toggleMuted] = useMuted();
  const [statsOpen, setStatsOpen] = useState(false);

  // Fires once, the moment the city first reads as complete (not on every
  // re-render while it stays true) — a one-off milestone sound, not tied to
  // any particular button press the way the others above are.
  const announcedCityComplete = useRef(false);
  useEffect(() => {
    if (cityComplete && !announcedCityComplete.current) {
      announcedCityComplete.current = true;
      playSound("cityComplete");
    }
  }, [cityComplete]);

  function refreshStats() {
    getStats()
      .then(setStats)
      .catch(() => {});
  }

  useEffect(refreshStats, []);

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
        setState({ phase: "welcome" });
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
  useAmbientDecorConstruction(cityRef, STATIC_DECOR_BUILDINGS, cityData !== null && !cityComplete);

  // The active (in_progress) building for a category already has a fixed
  // variant before school selection — placeBlock always targets it, one
  // in_progress row per category (see server/src/routes/placeBlock.ts) — so
  // this reads it straight out of the already-loaded city data instead of
  // needing a backend change to /enter.
  function getActiveVariant(category: BuildingCategory): string | undefined {
    return cityData?.rows.find((r) => r.category === category && r.status === "in_progress")
      ?.variant;
  }

  function handleEnter(code: string) {
    enterCode(code)
      .then((res) => {
        if (res.status === "existing") {
          cityRef.current?.focusOnBlock(res.block.buildingId, res.block.blockIndex);
          cityRef.current?.markOwnBlock(res.block.buildingId, res.block.blockIndex);
          setState({ phase: "existing", block: res.block });
        } else {
          setState({
            phase: "needs_school",
            code,
            category: res.category,
            variant: getActiveVariant(res.category),
          });
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
              refreshStats();
              // addBlock() above always falls for exactly DROP_FALL_DUR_OWN
              // seconds (see revealBlockAt/utils.ts) before settling — there's
              // no host-side "landed" callback out of the three.js scene, so
              // this just times the sound to the same fixed duration instead.
              setTimeout(() => playSound("blockLanding"), DROP_FALL_DUR_OWN * 1000);
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
        setState({ phase: "needs_school", code, category, variant: getActiveVariant(category), error: message });
      });
  }

  const showsModal =
    state.phase === "welcome" || state.phase === "entry" || state.phase === "needs_school";

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background">
      {cityData && (
        <City
          ref={cityRef}
          initialBuildings={cityData.buildings}
          initialQueue={cityData.queue}
          decor={STATIC_CITY_DECOR}
          onStateChange={setLiveBuildings}
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
          {state.phase === "welcome" && cityComplete && (
            <CityCompleteStep
              onVisitBlock={() => setState({ phase: "entry" })}
              onBrowse={() => setState({ phase: "browsing" })}
            />
          )}
          {state.phase === "welcome" && !cityComplete && (
            <WelcomeStep
              onHasCode={() => setState({ phase: "entry" })}
              onBrowse={() => setState({ phase: "browsing" })}
            />
          )}
          {state.phase === "entry" && (
            <EntryStep
              error={state.error}
              onSubmit={handleEnter}
              onBack={() => setState({ phase: "welcome" })}
            />
          )}
          {state.phase === "needs_school" && (
            <SchoolStep
              category={state.category}
              variant={state.variant}
              error={state.error}
              onBack={() => setState({ phase: "entry" })}
              onConfirm={(schoolId) => handleConfirm(state.code, state.category, schoolId)}
            />
          )}
        </div>
      )}

      {state.phase === "browsing" && (
        <div className="pointer-events-none absolute top-4 right-4">
          <Button
            size="lg"
            className="pointer-events-auto bg-red-600 text-white shadow-xl hover:bg-red-700"
            onClick={() => {
              playSound("buttonClick");
              setState({ phase: "entry" });
            }}
          >
            <KeyRound />
            Unesi kod
          </Button>
        </div>
      )}

      {(state.phase === "placed" || state.phase === "existing") && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
          <Card className="w-full max-w-lg bg-card/90 backdrop-blur">
            <CardContent className="flex flex-col gap-4 py-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-medium">
                  {state.phase === "placed" ? "Kockica je stavljena!" : "Već postavljeno"}
                </p>
                <ProgressBlock block={state.block} />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    playSound("buttonClick");
                    cityRef.current?.focusOnBlock(state.block.buildingId, state.block.blockIndex);
                  }}
                >
                  <MapPin />
                  Vrati me na moju kockicu
                </Button>
                <Button
                  onClick={() => {
                    playSound("buttonClick");
                    cityRef.current?.resetCamera();
                    setState({ phase: "welcome" });
                  }}
                >
                  Stavi sljedeću kockicu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {cityData && (
        <StatsPanel
          overallCompleted={overallCompleted}
          categoryCompleted={categoryCompleted}
          schoolBlocksPlaced={stats?.schoolBlocksPlaced ?? null}
          mobileOpen={statsOpen}
        />
      )}

      {/* Rendered last (on top of the modal steps' full-screen blurred
          backdrop, see showsModal above) so it stays visible and clickable
          on every phase, not just ones without a backdrop overlay. */}
      <div className="pointer-events-none absolute top-4 left-4">
        <Button
          size="icon"
          variant="outline"
          className="pointer-events-auto bg-card/90 backdrop-blur"
          onClick={toggleMuted}
          aria-label={muted ? "Uključi zvuk" : "Isključi zvuk"}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
      </div>

      {/* Shown below 1200px (see StatsPanel's own doc comment) — the stats
          panel overlaps the centered modal at tablet widths too, not just
          phones, so the cutoff for "desktop shows it unconditionally" is
          wider than Tailwind's own sm breakpoint. Shifted down when the
          browsing phase's own top-right "Unesi kod" button is also on
          screen, so the two never overlap. */}
      {cityData && (
        <div
          className={`pointer-events-none absolute right-4 min-[1200px]:hidden ${state.phase === "browsing" ? "top-20" : "top-4"}`}
        >
          <Button
            size="icon"
            variant="outline"
            className="pointer-events-auto bg-card/90 backdrop-blur"
            onClick={() => setStatsOpen((v) => !v)}
            aria-label={statsOpen ? "Zatvori statistiku" : "Otvori statistiku"}
          >
            {statsOpen ? <X /> : <Menu />}
          </Button>
        </div>
      )}
    </div>
  );
}
