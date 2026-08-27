# Validation Matrix

## Gate W0 — Runtime foundation

Must pass:

- GLB loads
- Meshopt loads
- no loader errors
- required semantic components present
- expected animations present

## Gate W1 — Rendering

Must pass:

- model clearly visible
- hardware details readable
- no crushed blacks
- no excessive bloom
- no unacceptable aliasing
- no obvious texture/material regressions

## Gate W2 — Camera

Must pass:

- hero view
- orbit
- zoom
- pan
- component focus
- responsive framing
- reset camera

## Gate W3 — Animation

Must pass:

- OPEN_CASE
- MOTHERBOARD_OUT
- CPU_COOLER_OUT
- CPU_OUT
- RAM_OUT
- GPU_OUT
- STORAGE_OUT
- PSU_OUT
- SECONDARY_OUT
- FINAL_EXPLODE
- RESET

## Gate W4 — Cable behavior

Must pass visually:

24PIN:
connected → disconnect → clear → motherboard extraction

CPU POWER:
connected → disconnect → clear → motherboard extraction

GPU POWER:
connected → disconnect → clear → motherboard/GPU extraction

No visible pass-through.

## Gate W5 — Component interaction

Must pass:

- hover
- click
- touch
- keyboard
- semantic component identity
- focus feedback
- information panel

## Gate W6 — UI quality

Must pass:

- no debug clutter
- readable contrast
- coherent visual hierarchy
- responsive layout
- controls discoverable
- information concise
- mobile fallback

## Gate W7 — Performance

Record:

- initial load
- steady FPS
- animation FPS
- memory usage where practical
- interaction latency
- GLB transfer size

## Gate W8 — Regression

After major changes verify:

- GLB hash unchanged
- node inventory unchanged
- mesh/material inventory unchanged
- animation inventory unchanged
- source files untouched

## Final release gate

The WebGL experience is not approved until:

- all required automated checks pass
- manual visual inspection passes
- animations pass
- cable behavior passes
- lighting passes
- responsive behavior passes
- no console errors in normal operation
- debug UI is hidden by default
