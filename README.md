# PC Components Manual

An interactive, educational 3D desktop PC anatomy and staged disassembly manual. Built with precision Blender modeling, procedural kinematic animation, and a high-performance WebGL/Three.js web experience runtime.

---

## Important Repository Notice

> **This repository is the full-PC animated Components Manual project.**
> 
> It contains the complete assembled desktop chassis, mechanical disassembly sequences, cable motion, and full-system WebGL runtime.
> 
> The separate **Solo Component Library** (12 isolated single-part inspection models and generators) is maintained at:
> **[https://github.com/mdrayyanhussain2006/pc-3d-anatomy](https://github.com/mdrayyanhussain2006/pc-3d-anatomy)**
> 
> The two projects are independently developed and versioned.

---

## Overview

PC Components Manual is designed as a technical visualization and educational platform for learning computer hardware anatomy. Users can inspect a desktop PC in fully assembled state, step through realistic mechanical disassembly stages, focus on individual components, and explore engineering metadata for every part.

### Key Capabilities

- **11-Stage Staged Disassembly**: From fully assembled chassis to an organized exploded view.
- **Realistic Kinematics & Constraints**: Disconnect-before-extract logic (e.g. power cables decouple before motherboard extraction, M.2 NVMe pivot/slide, CPU latching).
- **Semantic Component Hierarchy**: 29 discrete semantic components with stable node identifiers.
- **Modular WebGL Runtime**: Architecture separating rendering, lighting, camera controls, timeline animation, educational overlays, accessibility, and diagnostics.
- **Rigorous Automated QA**: Validation scripts for Blender scenes, GLB exports, node hierarchies, and Playwright end-to-end tests.

---

## Disassembly Stages

| Stage | Name | Key Actions & Kinematics |
| :--- | :--- | :--- |
| **00** | **Assembled** | Hero baseline state; all hardware mounted and enclosed |
| **01** | **Open Case** | Tempered glass side panel fastener release and lateral translation |
| **02** | **Motherboard** | Power cables disconnect; motherboard assembly extracts forward |
| **03** | **CPU Cooler** | Air cooler mount disengages and lifts away from socket plane |
| **04** | **CPU** | Retention arm pivots open; processor lifts from socket |
| **05** | **RAM** | DIMM latch release and vertical extraction of all memory sticks |
| **06** | **GPU** | PCIe retention clip opens; graphics card slides out of x16 slot |
| **07** | **Storage** | M.2 thermal shield removal, retaining screw release, NVMe pivot & slide |
| **08** | **Power Supply** | Modular cable harness disconnects; ATX PSU extracts rearward |
| **09** | **Secondary Fans** | Chassis intake and exhaust fans translate clear of mounting rails |
| **10** | **Final Exploded** | Symmetrical 3D exploded layout for global anatomical inspection |

---

## Repository Structure

```text
Components-Manual/
├── .agents/                    # Specialized agent definitions & architecture roles
├── build/                      # 3D assets, Blender sources, manifests & QA reports
│   ├── animated.blend          # Production Blender scene with full disassembly action
│   ├── detail.blend            # Detailed mesh geometry & PBR materials
│   ├── blockout.blend          # Dimensional blockout reference
│   ├── disassembly_manifest.json # Stage definitions, keyframes, and timing
│   ├── animation_stages.json   # Stage metadata mapping
│   └── export/
│       ├── pc_anatomy_master.glb     # Master validated GLB export
│       ├── pc_anatomy_web_final.glb  # Optimized production web GLB asset
│       └── pc_anatomy_web_reduced.glb# Decimated web candidate
├── scripts/                    # Headless Blender build, export, and QA pipeline
│   ├── build_blockout.py       # Generates blockout geometry
│   ├── build_detail.py         # Detailed component mesh builder
│   ├── build_animation.py      # Generates kinematic actions & keyframes
│   ├── export_glb.py           # Exports master GLB with semantic metadata
│   ├── reduce_glb.py           # Mesh decimation while preserving kinematic nodes
│   ├── qa_animation.py         # Headless verification of animation tracks
│   ├── qa_detail.py            # Mesh budget and PBR taxonomy verification
│   └── verify_glb.py           # GLB node and animation track validator
├── tools/                      # CLI tooling & glTF utilities
├── web-experience/             # Production WebGL application (TypeScript + Vite)
│   ├── src/
│   │   ├── runtime/            # Core engine (camera, lighting, timeline, state)
│   │   ├── ui/                 # Playback bar, navigation, education panels
│   │   └── styles/             # Design tokens and responsive styles
│   └── tests/                  # Playwright E2E verification suite (w1 - w5)
├── web-test/                   # Diagnostic/verification testbed harness
├── AGENTS.md                   # Project mission, boundaries, and governance
├── ANIMATION_CONTRACT.md       # Timing, ordering, and kinematic contracts
├── ASSET_CONTRACT.md           # Node naming, hierarchy, and material taxonomy
├── WEB_RUNTIME_CONTRACT.md     # WebGL runtime architecture specifications
└── VALIDATION_MATRIX.md        # Comprehensive quality assurance matrix
```

---

## Web Experience Architecture

The frontend application under `web-experience/` is built on a clean, decoupled architecture:

```text
               ┌───────────────────────────────┐
               │      Experience Runtime       │
               │   (Core Orchestration Hub)    │
               └──────────────┬────────────────┘
                              │
     ┌────────────────┬───────┴────────┬────────────────┐
     ▼                ▼                ▼                ▼
┌───────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────────┐
│ Renderer  │  │   Camera     │  │ Timeline  │  │  Interaction  │
│   Host    │  │  Controller  │  │ Controller│  │  & A11y Hub   │
└───────────┘  └──────────────┘  └───────────┘  └───────────────┘
     │                │                │                │
     ▼                ▼                ▼                ▼
Three.js Canvas   Cinematic &       Keyframe       Pointer / Keyboard
& Lighting Rig   Focus Framing     Transitions       Navigation
```

- **`ExperienceRuntime`**: Central coordinator for initialization, asset loading, and tick loops.
- **`TimelineController`**: Scrubbing, playback speeds, stage transitions, and keyframe interpolation.
- **`CameraController`**: Smooth orbit, stage-specific viewpoints, and component focus transitions.
- **`LightingRig`**: Balanced Studio PBR lighting with soft fill, rim lighting, and shadow contrast.
- **`EducationController`**: Hardware specifications, component descriptions, and architectural notes.
- **`StateStore`**: Reactive state management with subscriber dispatch.

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0 or newer
- **Blender** (optional, for asset pipeline): v4.0 or newer
- **Python**: v3.10 or newer (for build scripts)

### Running the Web Experience

```bash
# Navigate to the web experience workspace
cd web-experience

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Running End-to-End Tests

```bash
cd web-experience

# Run all Playwright test specs
npx playwright test
```

### Running Asset Pipeline (Blender Headless)

To regenerate or verify assets from source:

```bash
# Verify animation tracks in Blender
blender -b build/animated.blend --python scripts/qa_animation.py

# Verify exported GLB asset structure
python scripts/verify_glb.py build/export/pc_anatomy_web_final.glb
```

---

## Semantic Component Registry

The asset maintains 29 immutable node identifiers:

- **Chassis & Structure**: `CASE`, `CASE_SIDE_PANEL`, `PC_ROOT`
- **Core Processing**: `CPU`, `CPU_COOLER`, `MOTHERBOARD`
- **Memory & Storage**: `RAM_01`, `RAM_02`, `RAM_03`, `RAM_04`, `M2_SSD`, `M2_HEATSINK`
- **Graphics & PCIe**: `GPU`, `GPU_BRACKET`
- **Power Delivery**: `PSU`, `CABLE_24PIN`, `CABLE_EPS`, `CABLE_PCIE`, `CABLE_SATA`
- **Cooling & Airflow**: `CASE_FAN_01`, `CASE_FAN_02`, `CASE_FAN_03`, `CASE_FAN_04`

---

## Quality Assurance & Contracts

All modifications must adhere to the frozen contracts:

- **[ASSET_CONTRACT.md](ASSET_CONTRACT.md)**: Node naming, parenting rules, and triangle budgets.
- **[ANIMATION_CONTRACT.md](ANIMATION_CONTRACT.md)**: Kinematic constraints, stage ordering, and keyframe definitions.
- **[WEB_RUNTIME_CONTRACT.md](WEB_RUNTIME_CONTRACT.md)**: State synchronization, memory management, and rendering standards.
- **[VALIDATION_MATRIX.md](VALIDATION_MATRIX.md)**: Step-by-step verification checklist.

---

## License

This project is released under the **MIT License**.
