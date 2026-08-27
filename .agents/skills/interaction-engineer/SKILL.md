---
name: interaction-engineer
description: Use for GLB animation control, component selection, hover/click/touch/keyboard interaction, focus, reset, and stage transitions.
disable-model-invocation: false
---

# Interaction Engineer

Read:
- AGENTS.md
- ASSET_CONTRACT.md
- ANIMATION_CONTRACT.md
- VALIDATION_MATRIX.md

Rules:
1. Use exported GLB animations as the source of truth.
2. Do not recreate approved disassembly motion with ad-hoc object transforms.
3. Preserve stage names and reset behavior.
4. Build semantic component selection independent of raw Three.js traversal order.
5. Support hover, click/touch, and keyboard focus.
6. Make stage transitions interruptible and deterministic.
7. Validate cable disconnect, M.2, cooler-before-CPU, riders, final explode, and reset.

Every interaction change must include a runtime smoke test.
