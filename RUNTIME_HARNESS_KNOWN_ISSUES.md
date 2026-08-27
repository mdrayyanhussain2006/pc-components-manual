# Current Web-Test Harness — Known Baseline Issues

This document records issues discovered during the Zed handoff audit.

The harness is a diagnostic tool, not the final product UI.

## Issue 1 — stage mapping is stale/incomplete

The approved GLB animation inventory is:

- PC_Disassembly_CABLE_24PIN_flex
- PC_Disassembly_CABLE_24PIN_CONN_MB_disconnect
- PC_Disassembly_CABLE_CPU_POWER_flex
- PC_Disassembly_CABLE_CPU_POWER_CONN_MB_disconnect
- PC_Disassembly_CABLE_GPU_POWER_flex
- PC_Disassembly_CABLE_GPU_POWER_CONN_GPU_disconnect
- PC_Disassembly_CASE_SIDE_PANEL
- PC_Disassembly_CPU
- PC_Disassembly_CPU_COOLER
- PC_Disassembly_CASE_FAN_01
- PC_Disassembly_CASE_FAN_02
- PC_Disassembly_CASE_FAN_03
- PC_Disassembly_GPU
- PC_Disassembly_M2_SSD
- PC_Disassembly_MOTHERBOARD
- PC_Disassembly_PSU
- PC_Disassembly_RAM_01
- PC_Disassembly_RAM_02
- PC_Disassembly_RAM_03
- PC_Disassembly_RAM_04
- PC_Disassembly_STORAGE

The current harness has:

- `STORAGE_OUT` mapped only to `PC_Disassembly_STORAGE`, so M.2 is not explicitly exercised by that button.
- `SECONDARY_OUT` incorrectly mapped to `PC_Disassembly_M2_SSD`.
- `FINAL_EXPLODE` uses a fallback candidate list that can resolve to a fan action even though `FINAL_EXPLODE` is a manifest presentation state, not an exported single clip.

These are harness issues, not GLB defects.

## Issue 2 — semantic versus raw inventory counts

The GLB contains:

- 51 glTF nodes
- 25 glTF meshes
- 17 materials
- 21 animations

The project contract defines a 29-entry semantic inventory.

The runtime should distinguish:

- total glTF nodes
- required semantic component count

rather than labeling 51 as if it were the semantic count.

## Issue 3 — old RESET report

An older runtime report recorded `action.setTime is not a function`.

The current `main.js` contains a later reset implementation using the available Three.js AnimationAction behavior.

Re-run runtime QA before relying on either report.

## Issue 4 — UI

The current harness is intentionally debug-heavy and dark.

Do not use it as the final visual design reference.

## Rule

Fix these harness issues during W0/W2 as part of runtime architecture cleanup, without touching the frozen GLB.
