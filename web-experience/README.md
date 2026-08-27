# PC Anatomy Web Experience — W1

Isolated production WebGL foundation for rendering, lighting, and camera validation.

## Commands

- `npm run dev` — start the local Vite server
- `npm run build` — type-check, build, and verify the emitted GLB hash/inventory
- `npm run test:e2e` — run W1 browser controls and screenshot validation
- `npm run validate` — run the complete W1 validation sequence

The canonical asset remains at `../build/export/pc_anatomy_web_final.glb`. Vite emits that exact file to `dist/assets/models/pc_anatomy_web_final.glb`; no source duplicate is stored here.

## Camera

- Mouse/touch: orbit, zoom, and pan through OrbitControls
- `H`: hero view
- `O`: open-case view
- `R`: reset to hero

Add `?debug=1` to show diagnostic telemetry and camera test controls. Debug UI is absent in normal product mode.
