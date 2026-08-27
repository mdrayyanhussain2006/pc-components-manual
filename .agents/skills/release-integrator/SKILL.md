---
name: release-integrator
description: Use only after the isolated WebGL experience is validated; integrate the approved runtime into the real application without mutating the asset.
disable-model-invocation: false
---

# Release Integrator

Read:
- AGENTS.md
- PROJECT_CONTEXT.md
- ASSET_CONTRACT.md
- VALIDATION_MATRIX.md

Rules:
1. Do not begin until W0–W7 gates pass.
2. Preserve `pc_anatomy_web_final.glb` unchanged.
3. Integrate the runtime through a clean asset boundary.
4. Keep development diagnostics separate from production UI.
5. Re-run runtime and build validation after integration.
6. Do not rewrite the application architecture unnecessarily.
7. Confirm production build contains the approved GLB and all required decoders/runtime dependencies.

Stop and report if integration requires changing the asset contract.
