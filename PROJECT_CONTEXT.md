# PC Anatomy — Permanent Web Experience Context

## Project identity

This is a dedicated PC anatomy 3D asset and WebGL experience project.

Workspace root:

`Components-Manual/`

The final asset will ultimately be consumed by a separate web application.

## Original purpose

Create a premium educational 3D desktop PC anatomy model that can:

- show a complete modern desktop PC
- expose major components individually
- perform a staged disassembly
- allow component-focused educational exploration
- support future numbered hotspots
- work as a browser/WebGL asset

## Frozen asset history

### Step 1 — Toolchain

Completed.

Verified:

- Blender 5.2 LTS
- headless Blender
- GLB export
- glTF validation
- Python
- Node.js
- glTF tooling

### Step 2 — Blockout

Completed and locked.

The blockout established:

- complete PC proportions
- separate named components
- hierarchy
- pivots/origins
- mechanical extraction directions

### Step 2.5 — Blockout refinement

Completed and locked.

Notable improvements:

- GPU became visually identifiable
- motherboard landmarks were established
- CPU and cooler were made independently controllable
- disassembly manifest architecture was formalized

### Step 3 — Detail

Completed and locked.

Created realistic technical component structure and a deliberate PBR material taxonomy.

### Step 3.5 — Realism refinement

Completed and locked.

Meaningful detail was added to:

- motherboard
- GPU
- CPU cooler
- PSU
- RAM
- fans
- connectors/cables
- surface materials

The model was intentionally kept as a stylized-realistic technical PC anatomy asset rather than pushed toward photorealism.

### Final polish

Completed and locked.

The renderer/material presentation was cleaned up and visible surface noise was removed.

### Step 4 — Animation

Completed and locked.

The animation is a 974-frame timeline at 24 FPS, approximately 40.6 seconds.

The animation contains:

- staged component extraction
- mechanical release/disengage beats
- controlled easing
- settle/park poses
- organized final explosion
- reset/reverse validation

### Cable correction

An earlier animation version kept power cables passive while the motherboard departed. Visual inspection rejected this because the motherboard visibly passed through stationary connectors.

REV 3.4 corrected this by disconnecting and clearing:

- 24-pin power
- CPU/EPS power
- GPU power

before the motherboard's major extraction motion.

That visual behavior was subsequently approved.

### GLB export

The master GLB was exported and validated.

The optimized web GLB was then produced conservatively.

## Current approved web asset

`build/export/pc_anatomy_web_final.glb`

Current reported measurements:

- 33,383 triangles
- 25 meshes
- 17 materials
- 21 animations
- approximately 539 KB
- glTF validator: 0 errors / 0 warnings
- semantic/pose verification: 954 checks / 0 failures
- worst measured pose deviation: 0.37 mm

The master GLB remains available as a rollback/reference export.

## Current runtime-test state

An isolated Three.js runtime harness was created to verify:

- GLB loading
- Meshopt loading
- node/component presence
- animation presence
- stage playback
- cable-disconnect behavior
- reset behavior

The harness successfully loaded the GLB and reported:

- GLB loaded
- Meshopt loaded
- all required semantic components present
- 21 animations

The user manually observed an important UX issue:

- Blender animation presentation looked excellent.
- Browser presentation looked noticeably worse.
- The browser viewport was too dark.
- Hardware details were harder to see.
- The diagnostic UI was visually unattractive and did not feel like a finished educational product.

This is the primary reason the project is now moving to Zed + a top-tier coding agent.

## Important interpretation

The browser disappointment should NOT be interpreted as evidence that the GLB or animation is bad.

The asset is strong.

The current WebGL validation harness is a developer-facing diagnostic surface, not the final product.

The next phase is therefore:

**experience engineering**

not:

**asset rebuilding**

## Current phase

**Phase W0 — WebGL Experience Architecture and UX**

Immediate goals:

1. audit the current runtime harness
2. establish the final rendering/lighting system
3. create the final camera system
4. create semantic component selection
5. create focus/inspection behavior
6. create educational progression
7. build the product UI
8. move diagnostic information behind a debug mode
9. preserve the existing GLB contract
10. validate before integrating into the user's real web application
