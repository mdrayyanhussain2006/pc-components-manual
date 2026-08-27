# PC Anatomy Web Experience — Zed Project Instructions

## Mission

This repository contains a completed, validated 3D PC anatomy asset and the next-phase WebGL experience built around it.

The project is now in the **Web Experience Engineering** phase.

The goal is to turn the approved GLB asset into a premium, educational, interactive PC anatomy experience and then integrate that experience into the user's real web application.

## Frozen source assets

Treat these as immutable source-of-truth assets:

- `build/animated.blend`
- `build/detail.blend`
- `build/export/pc_anatomy_master.glb`
- `build/export/pc_anatomy_web_final.glb`
- `build/disassembly_manifest.json`
- the approved animation/validation artifacts

Do not modify, overwrite, regenerate, re-key, re-parent, re-mesh, rename, or optimize these files unless the user explicitly authorizes an asset-phase change.

`pc_anatomy_web_final.glb` is the approved web asset.

## Important project boundary

The previous phase used Qoder + Blender to build and validate the asset.

That phase is closed.

Do not reopen modeling or animation work merely because the WebGL experience can be improved.

The current problem is primarily **runtime presentation, interaction, and product UX**, not 3D asset creation.

## Current reality

The 3D asset and Blender animation are strong.

The browser validation harness is not the final UI. It is a diagnostic/runtime verification tool.

Do not use its dark/debug-heavy presentation as the design reference.

The final WebGL experience must be substantially more polished, readable, educational, and user-friendly.

## Non-negotiable asset contract

Preserve:

- semantic component separability
- node names
- animation names
- animation timing
- motherboard rider behavior
- CPU cooler → CPU ordering
- M.2 pivot/disengage/translate behavior
- power-cable disconnect before motherboard extraction
- organized FINAL_EXPLODE presentation
- reset behavior

Do not merge separately selectable components.

Do not replace the GLB with a rebuilt model.

## Engineering rules

1. Inspect before editing.
2. Prefer small, reversible changes.
3. Never claim success without a runnable verification step.
4. Separate runtime diagnostics from product UI.
5. Keep debug panels hidden behind an explicit debug mode.
6. Do not add large dependencies unless they are justified.
7. Do not change the frozen asset to solve a lighting, camera, or UI problem.
8. When a WebGL runtime behavior is uncertain, reproduce it in the isolated runtime harness before changing architecture.
9. Preserve the project's existing validation scripts.
10. After every major UI/runtime change, run the relevant validation matrix.

## WebGL quality bar

The final experience should feel like a premium technical visualization:

- clear component visibility
- readable lighting
- purposeful camera motion
- calm visual hierarchy
- smooth animation
- deliberate educational focus
- responsive controls
- accessible labels
- no debug clutter in the primary experience
- no unnecessary cinematic darkness that hides hardware details

## Agent behavior

The agent is expected to:

- inspect repository structure and existing implementation before changing it
- read all relevant contracts before implementation
- explain architectural changes before making broad changes
- use the smallest suitable change
- validate after changes
- report exactly what was changed and how it was tested

When uncertain between changing the GLB and changing the runtime, prefer changing the runtime.

## Phase gate

Current phase:

**WEB EXPERIENCE ARCHITECTURE + UI/UX**

Do not begin final ZURAY integration until the isolated WebGL experience has passed its own visual/runtime QA.
