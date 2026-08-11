import { useState, useMemo, useRef } from "react"
import { BuildingRenderer } from "./imports/BuildingRenderer"
import type { BuildingRendererHandle } from "./imports/BuildingRenderer"
import { BUILDINGS } from "./buildingGenerators"
import type { Block } from "./buildingGenerators"

// Icon SVGs for each building type (pixel-art inspired)
const ICONS: Record<string, string> = {
  "short-apt":  "🏠",
  "tall-apt":   "🏢",
  "food-bank":  "🏭",
  "restaurant": "🍽",
  "school":     "🏫",
  "small-hosp": "🏥",
  "med-hosp":   "🏥",
  "large-hosp": "🏥",
}

const COLORS: Record<string, string> = {
  "short-apt":  "#c05030",
  "tall-apt":   "#8898aa",
  "food-bank":  "#c8a870",
  "restaurant": "#cc6633",
  "school":     "#ddc870",
  "small-hosp": "#e8e8f0",
  "med-hosp":   "#e0e8e8",
  "large-hosp": "#f0f0f8",
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string>("short-apt")
  const rendererRef = useRef<BuildingRendererHandle>(null)

  const selected = BUILDINGS.find((b) => b.id === selectedId)!

  // Generate blocks only when the selected building changes
  const blocks = useMemo<Block[]>(() => selected.generate(), [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const building = useMemo(
    () => ({ totalBlocks: blocks.length, completedBlocks: blocks.length, blocks }),
    [blocks],
  )

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#0d0d1a", fontFamily: "'Press Start 2P', monospace" }}
    >
      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col overflow-y-auto"
        style={{
          width: 210,
          minWidth: 210,
          background: "#1a1a2a",
          borderRight: "4px solid #2a2a3a",
        }}
      >
        {/* Logo */}
        <div
          className="text-center py-4 px-3"
          style={{ borderBottom: "4px solid #2a2a3a" }}
        >
          <div style={{ fontSize: 11, color: "#5aaa3a", letterSpacing: 1 }}>VOXEL</div>
          <div style={{ fontSize: 11, color: "#5aaa3a", letterSpacing: 1 }}>CITY</div>
          <div style={{ fontSize: 7, color: "#557755", marginTop: 4 }}>BUILD SELECTOR</div>
        </div>

        {/* Building list */}
        <div className="flex flex-col gap-1 p-2" style={{ flex: 1 }}>
          {BUILDINGS.map((b) => {
            const active = b.id === selectedId
            const accent = COLORS[b.id] ?? "#888"
            return (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className="text-left w-full"
                style={{
                  background: active ? "#2a3a2a" : "#1e1e2e",
                  border: `3px solid ${active ? accent : "#2a2a3a"}`,
                  borderBottom: `5px solid ${active ? accent : "#1a1a1a"}`,
                  borderRight: `5px solid ${active ? accent : "#1a1a1a"}`,
                  padding: "8px 10px",
                  cursor: "pointer",
                  transition: "border-color 0.1s",
                }}
              >
                <div style={{ fontSize: 7, color: active ? "#ffffff" : "#aaaaaa", lineHeight: 1.8 }}>
                  {b.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 6, color: active ? accent : "#555577", marginTop: 3 }}>
                  {b.blocks.toLocaleString()} BLOCKS
                </div>
              </button>
            )
          })}
        </div>

        {/* Controls hint */}
        <div
          className="p-3"
          style={{ borderTop: "3px solid #2a2a3a", fontSize: 6, color: "#445544", lineHeight: 2 }}
        >
          <div>DRAG: ROTATE</div>
          <div>SCROLL: ZOOM</div>
          <div>RIGHT DRAG: PAN</div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <header
          className="flex items-center justify-between px-5"
          style={{
            height: 52,
            background: "#14141f",
            borderBottom: "4px solid #2a2a3a",
            flexShrink: 0,
          }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 16 }}>{ICONS[selectedId]}</span>
            <span style={{ fontSize: 9, color: "#ffffff" }}>
              {selected.label.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Stat label="BLOCKS" value={selected.blocks.toLocaleString()} color="#5aaa3a" />
            <Stat label="TYPE" value={getType(selected.id)} color="#6699cc" />
          </div>
        </header>

        {/* 3D Viewport */}
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          <BuildingRenderer
            ref={rendererRef}
            building={building}
            style={{ width: "100%", height: "100%" }}
          />

          {/* Overlay tag */}
          <div
            style={{
              position: "absolute",
              bottom: 14,
              right: 16,
              fontSize: 7,
              color: "rgba(255,255,255,0.35)",
              fontFamily: "'Press Start 2P', monospace",
            }}
          >
            VOXEL CITY v1.0
          </div>
        </div>
      </main>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div style={{ fontSize: 6, color: "#556655" }}>{label}</div>
      <div style={{ fontSize: 9, color }}>{value}</div>
    </div>
  )
}

function getType(id: string): string {
  if (id.includes("hosp")) return "HOSPITAL"
  if (id.includes("apt")) return "APARTMENT"
  if (id === "food-bank") return "WAREHOUSE"
  if (id === "restaurant") return "COMMERCIAL"
  if (id === "school") return "EDUCATION"
  return "CIVIC"
}
