# WebGL Runtime Contract

## Runtime technology

The final experience may use Three.js or an equivalent WebGL runtime, but the existing GLB and animation semantics are the source of truth.

The current isolated harness uses Three.js + GLTFLoader + MeshoptDecoder.

## Current browser asset

`build/export/pc_anatomy_web_final.glb`

## Required loader behavior

The runtime must:

1. load GLB
2. initialize MeshoptDecoder
3. verify successful loading
4. verify required semantic nodes
5. verify animations
6. configure rendering
7. expose controlled playback

## Scene initialization

The renderer should establish:

- a readable neutral environment
- soft key light
- soft fill
- controlled rim/accent
- gentle ambient/interior contribution
- readable shadows
- no crushed-black hardware

## Camera

Use a controllable camera system.

Required capabilities:

- default hero view
- open-case view
- component focus view
- smooth focus transition
- orbit
- zoom
- pan
- sensible clipping
- responsive framing

Do not make the model tiny to accommodate UI.

## Lighting

The user explicitly found the first web UI too dark.

Therefore:

- prioritize legibility over dramatic darkness
- preserve dark hardware material identity
- use enough fill to reveal geometry
- make component details readable on ordinary monitors
- test both dark and bright desktop displays if practical

## Component selection

The runtime should identify the semantic component when the user:

- hovers
- clicks/taps
- focuses by keyboard

Selection should not mutate the GLB.

Possible presentation techniques:

- outline
- soft emissive rim
- local highlight
- camera focus
- contextual label

Use subtle emphasis rather than flashing/high-saturation effects.

## UI separation

The production UI must separate:

### Experience layer

- model
- camera
- selection
- animation

### Education layer

- component name
- explanation
- stage progression
- hotspot
- optional facts

### Application layer

- navigation
- controls
- responsive layout

### Debug layer

- FPS
- node counts
- mesh counts
- materials
- animation names
- loader state

Debug information must not dominate the normal experience.

## Performance

Keep:

- GLB immutable
- GPU work bounded
- animation smooth
- UI responsive

Do not add heavy libraries without justification.

Preserve meshopt compression unless runtime support is proven unavailable.

## Accessibility

The production UI should support:

- keyboard navigation
- visible focus
- readable contrast
- reduced-motion consideration
- non-color-only state indication
- descriptive labels

## Error states

If the GLB fails:

show a useful user-facing fallback.

Do not leave a blank canvas.

Development diagnostics may expose detailed errors in debug mode.
