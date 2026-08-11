import { useCallback, useEffect, useRef, useState } from "react"
import { City, type CityHandle } from "../components/city/City"
import type { BuildingCategory, CityBuilding, ConstructionQueue } from "../components/city/types"
import {
  generateHouseBlueprint,
  generateNeighbourhoodStyles,
  type StylePreset,
  type HouseStyle,
} from "../components/city/houseGenerator"
import blueprintData from "../imports/house-blueprint.json"

// ─────────────────────────────────────────────────────────────────────────────
// Source blueprint (always 1 080 blocks — structure never changes)
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_BLUEPRINT = blueprintData as unknown as {
  name?: string
  voxelCount?: number
  voxels: Array<{ x: number; y: number; z: number; type: string; color: string }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Plot positions for the 5 houses
// ─────────────────────────────────────────────────────────────────────────────

const PLOTS: Array<{ x: number; z: number }> = [
  { x:   0, z:  0 },
  { x:  26, z:  0 },
  { x: -26, z:  0 },
  { x:  13, z: 26 },
  { x: -13, z: 26 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Build city buildings from style params
// ─────────────────────────────────────────────────────────────────────────────

function buildCityBuildings(
  preset:      StylePreset,
  windowSize:  HouseStyle["windowSize"],
  windowCount: HouseStyle["windowCount"],
  masterSeed:  number,
): { buildings: CityBuilding[]; queue: ConstructionQueue } {
  const styles = generateNeighbourhoodStyles(preset, windowSize, windowCount, masterSeed, PLOTS.length)

  const buildings: CityBuilding[] = styles.map((style, i) => {
    const bp = generateHouseBlueprint(SOURCE_BLUEPRINT, style)
    return {
      id:              `house-${i + 1}`,
      category:        "residential" as BuildingCategory,
      position:        PLOTS[i],
      blueprint:       bp,
      totalBlocks:     bp.voxelCount!,
      completedBlocks: 0,
    }
  })

  return { buildings, queue: { residential: buildings[0].id } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default controls
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PRESET:       StylePreset             = "classic"
const DEFAULT_WINDOW_SIZE:  HouseStyle["windowSize"]  = "medium"
const DEFAULT_WINDOW_COUNT: HouseStyle["windowCount"] = "normal"
const DEFAULT_SEED = 42

const SPEEDS: Record<string, number> = { "1×": 120, "5×": 24, "25×": 4 }

// ─────────────────────────────────────────────────────────────────────────────
// Minimal UI primitives
// ─────────────────────────────────────────────────────────────────────────────

const mono = "ui-monospace,'Geist Mono','Courier New',monospace"

function PanelBox({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(8,12,20,0.85)", backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
      padding: "12px 14px", ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "#7ab8f5", fontWeight: 700, fontSize: 12, fontFamily: mono, marginBottom: 10 }}>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, color: "#556688", fontFamily: mono }}>{children}</span>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function SegBtn<T extends string>({
  value, options, labels, onChange,
}: {
  value: T
  options: T[]
  labels?: string[]
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {options.map((o, i) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            flex: 1,
            background:  value === o ? "#1a3a6a" : "rgba(255,255,255,0.04)",
            border:      value === o ? "1px solid rgba(122,184,245,0.5)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 5, padding: "4px 0",
            fontSize: 11, color: value === o ? "#7ab8f5" : "#445566",
            cursor: "pointer", fontFamily: mono,
          }}
        >
          {labels?.[i] ?? o}
        </button>
      ))}
    </div>
  )
}

function ActionBtn({
  label, onClick, color = "rgba(255,255,255,0.06)", disabled = false, flex = false,
}: { label: string; onClick: () => void; color?: string; disabled?: boolean; flex?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: flex ? 1 : undefined,
        background: disabled ? "rgba(255,255,255,0.03)" : color,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 6, padding: "7px 8px",
        fontFamily: mono, fontSize: 12,
        color: disabled ? "#334" : "#c8d8e8",
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap" as const,
      }}
    >
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Style params ─────────────────────────────────────────────────────────
  const [preset,      setPreset]      = useState<StylePreset>(DEFAULT_PRESET)
  const [windowSize,  setWindowSize]  = useState<HouseStyle["windowSize"]>(DEFAULT_WINDOW_SIZE)
  const [windowCount, setWindowCount] = useState<HouseStyle["windowCount"]>(DEFAULT_WINDOW_COUNT)
  const [seed,        setSeed]        = useState(DEFAULT_SEED)

  // ── City state ───────────────────────────────────────────────────────────
  const initial = () => buildCityBuildings(DEFAULT_PRESET, DEFAULT_WINDOW_SIZE, DEFAULT_WINDOW_COUNT, DEFAULT_SEED)

  const [cityKey,       setCityKey]       = useState(0)
  const [initBuildings, setInitBuildings] = useState(() => initial().buildings)
  const [initQueue,     setInitQueue]     = useState<ConstructionQueue>(() => initial().queue)
  const [buildings,     setBuildings]     = useState<CityBuilding[]>(() => initial().buildings)
  const [queue,         setQueue]         = useState<ConstructionQueue>(() => initial().queue)

  const cityRef = useRef<CityHandle>(null)

  const handleStateChange = useCallback(
    (b: CityBuilding[], q: ConstructionQueue) => { setBuildings(b); setQueue(q) },
    []
  )

  // ── Auto-build ───────────────────────────────────────────────────────────
  const [autoPlay, setAutoPlay] = useState(false)
  const [speedKey, setSpeedKey] = useState("5×")
  const autoRef     = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    autoRef.current = autoPlay
    if (!autoPlay) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      return
    }
    const ms = SPEEDS[speedKey] ?? 40
    intervalRef.current = setInterval(() => {
      if (autoRef.current) cityRef.current?.addBlock("residential")
    }, ms)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current!) }
  }, [autoPlay, speedKey])

  const allDone = buildings.every(b => b.completedBlocks >= b.totalBlocks)
  useEffect(() => { if (allDone) setAutoPlay(false) }, [allDone])

  // ── Generate neighbourhood ────────────────────────────────────────────────
  const generate = useCallback(() => {
    setAutoPlay(false)
    const { buildings: nb, queue: nq } = buildCityBuildings(preset, windowSize, windowCount, seed)
    setInitBuildings(nb)
    setInitQueue(nq)
    setBuildings(nb)
    setQueue(nq)
    setCityKey(k => k + 1)
  }, [preset, windowSize, windowCount, seed])

  // ── Derived HUD values ────────────────────────────────────────────────────
  const activeId       = queue["residential"]
  const totalCompleted = buildings.reduce((s, b) => s + b.completedBlocks, 0)
  const totalBlocks    = buildings.reduce((s, b) => s + b.totalBlocks, 0)
  const cityPct        = totalBlocks > 0 ? totalCompleted / totalBlocks : 0

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "#87ceeb" }}>
      <City
        key={cityKey}
        ref={cityRef}
        initialBuildings={initBuildings}
        initialQueue={initQueue}
        onStateChange={handleStateChange}
        style={{ position: "absolute", inset: 0 }}
      />

      {/* ── Left HUD ────────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 16, left: 16, bottom: 16,
        display: "flex", flexDirection: "column", gap: 8,
        zIndex: 10, pointerEvents: "auto", fontFamily: mono, width: 230,
      }}>

        {/* ── Style panel ─────────────────────────────────────────────── */}
        <PanelBox>
          <SectionTitle>🎨 Neighbourhood Style</SectionTitle>

          <Row label="Palette">
            <SegBtn
              value={preset}
              options={["classic","nordic","adobe","modern","cottage"]}
              labels={["Classic","Nordic","Adobe","Modern","Cottage"]}
              onChange={setPreset}
            />
          </Row>

          <Row label="Window size">
            <SegBtn
              value={windowSize}
              options={["small","medium","large"]}
              labels={["S","M","L"]}
              onChange={setWindowSize}
            />
          </Row>

          <Row label="Window density">
            <SegBtn
              value={windowCount}
              options={["few","normal","many"]}
              labels={["Few","Normal","Many"]}
              onChange={setWindowCount}
            />
          </Row>

          <Row label="Seed">
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input
                type="number"
                value={seed}
                onChange={e => setSeed(Number(e.target.value))}
                style={{
                  width: 60, background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4,
                  color: "#c8d8e8", fontSize: 11, padding: "3px 6px", fontFamily: mono,
                }}
              />
              <button
                onClick={() => setSeed(Math.floor(Math.random() * 9999))}
                title="Random seed"
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 4, padding: "3px 7px", color: "#c8d8e8", cursor: "pointer", fontSize: 13,
                }}
              >🎲</button>
            </div>
          </Row>

          <div style={{ fontSize: 10, color: "#334455", marginBottom: 8, lineHeight: 1.5 }}>
            All 5 houses: <strong style={{ color: "#7ab8f5" }}>1 080 blocks</strong> each.
            Seed varies palette & window position per house.
          </div>

          <button
            onClick={generate}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #1a3a6a, #2a5a3a)",
              border: "1px solid rgba(122,184,245,0.35)",
              borderRadius: 6, padding: "8px 0",
              fontFamily: mono, fontSize: 12, color: "#7ab8f5",
              cursor: "pointer", fontWeight: 700,
            }}
          >
            ✦ Generate Neighbourhood
          </button>
        </PanelBox>

        {/* ── Buildings panel ──────────────────────────────────────────── */}
        <PanelBox style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <SectionTitle>🏘 Residential District</SectionTitle>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {buildings.map(b => {
              const pct      = b.totalBlocks > 0 ? b.completedBlocks / b.totalBlocks : 0
              const isActive = b.id === activeId
              const isDone   = b.completedBlocks >= b.totalBlocks

              return (
                <div key={b.id} style={{ marginBottom: 9 }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "baseline", marginBottom: 3,
                  }}>
                    <span style={{ fontSize: 12, color: isActive ? "#ffd166" : isDone ? "#6ddc8b" : "#445566" }}>
                      {isActive ? "🔨 " : isDone ? "✓ " : "○ "}{b.id}
                    </span>
                    <span style={{ fontSize: 10, color: "#334" }}>
                      {b.completedBlocks}/{b.totalBlocks}
                    </span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.07)" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${pct * 100}%`,
                      background: isDone ? "#6ddc8b" : isActive ? "#ffd166" : "#2a3a4a",
                      transition: "width 0.08s linear",
                    }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* City total */}
          <div style={{ marginTop: 6, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
              <Label>City total</Label>
              <span style={{ color: allDone ? "#6ddc8b" : "#c8d8e8", fontFamily: mono }}>
                {(cityPct * 100).toFixed(1)} %{allDone ? " ✓" : ""}
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.07)" }}>
              <div style={{
                height: "100%", borderRadius: 2, width: `${cityPct * 100}%`,
                background: allDone ? "#6ddc8b" : "#7ab8f5",
                transition: "width 0.08s linear",
              }} />
            </div>
            <div style={{ fontSize: 10, color: "#334", marginTop: 3, textAlign: "right" as const }}>
              {totalCompleted.toLocaleString()} / {totalBlocks.toLocaleString()} blocks
            </div>
          </div>
        </PanelBox>

        {/* ── Construction controls ────────────────────────────────────── */}
        <PanelBox>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <ActionBtn
              label={autoPlay ? "⏸ Pause" : "▶ Auto Build"}
              onClick={() => setAutoPlay(p => !p)}
              color={autoPlay ? "#5a1a1a" : "#1a4a2a"}
              disabled={allDone && !autoPlay}
              flex
            />
            <ActionBtn
              label="+ Block"
              onClick={() => cityRef.current?.addBlock("residential")}
              disabled={allDone}
            />
          </div>

          <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
            <Label>Speed</Label>
            <div style={{ flex: 1, display: "flex", gap: 3, marginLeft: 6 }}>
              {Object.keys(SPEEDS).map(k => (
                <button key={k} onClick={() => setSpeedKey(k)} style={{
                  flex: 1,
                  background:  speedKey === k ? "#1a3a6a" : "rgba(255,255,255,0.04)",
                  border:      speedKey === k ? "1px solid rgba(122,184,245,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 5, padding: "4px 0",
                  fontSize: 11, color: speedKey === k ? "#7ab8f5" : "#445566",
                  cursor: "pointer", fontFamily: mono,
                }}>{k}</button>
              ))}
            </div>
          </div>

          <ActionBtn
            label="↺ Reset"
            onClick={() => { setAutoPlay(false); cityRef.current?.reset() }}
          />
        </PanelBox>

        <div style={{
          background: "rgba(8,12,20,0.5)", borderRadius: 6,
          padding: "5px 10px", fontSize: 10, color: "#334",
        }}>
          Scroll · Drag · Right-drag to pan
        </div>
      </div>
    </div>
  )
}
