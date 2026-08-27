---
name: webgl-experience-review
description: Review and improve the PC anatomy browser experience, especially lighting, camera, interaction, animation controls, accessibility, and visual hierarchy without modifying the frozen GLB.
disable-model-invocation: false
---

# WebGL Experience Review

Read:
- @AGENTS.md
- @WEB_RUNTIME_CONTRACT.md
- @UI_UX_VISION.md
- @VALIDATION_MATRIX.md

Use the frozen `build/export/pc_anatomy_web_final.glb` as the asset source.

Before implementation:
1. inspect the current runtime
2. identify visual and interaction regressions
3. separate diagnostic UI from product UI
4. establish a measurable acceptance criterion

Use browser/runtime evidence where available.

Never modify the GLB to solve runtime presentation problems.
