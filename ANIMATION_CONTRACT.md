# Animation Contract

## Source

Animation comes from the approved GLB.

The WebGL application must not recreate the PC disassembly using ad-hoc transform logic when an approved GLB animation exists.

## Stage sequence

1. ASSEMBLED
2. OPEN_CASE
3. MOTHERBOARD_OUT
4. CPU_COOLER_OUT
5. CPU_OUT
6. RAM_OUT
7. GPU_OUT
8. STORAGE_OUT
9. PSU_OUT
10. SECONDARY_OUT
11. FINAL_EXPLODE

## Mechanical intent

The animation is educational rather than physics-simulated.

Each stage should communicate:

release
→ disengage
→ main travel
→ settle
→ presentation

## Critical behaviors

### Case

Side panel leaves before internal component extraction.

### Motherboard

The GPU is a rider during motherboard extraction.

The motherboard movement includes:

- release beat
- slight lift
- controlled swing
- main extraction
- settle

### Power cables

Before the motherboard's main extraction:

- 24-pin disconnects
- CPU/EPS power disconnects
- GPU power disconnects
- cable/connector assemblies clear the extraction corridor

The motherboard must not visibly pass through a stationary power connector.

### CPU cooler

CPU cooler exits before CPU.

### CPU

CPU lifts independently after the cooler has settled.

### RAM

RAM sticks leave sequentially.

### GPU

GPU leaves cleanly from the parked motherboard.

### M.2

M.2 uses:

pivot
→ disengage
→ translate/clear

### Storage

Drive and M.2 movements are visually understandable.

### PSU

PSU disengages and exits in a controlled direction.

### Secondary

Fans and remaining cable dressing are handled here.

### Final explode

The final explode is an educational presentation pose, not a literal physical removal simulation.

## Web playback requirements

The UI should be able to:

- play a stage
- replay a stage
- interrupt a stage safely
- transition between stages
- reset
- play to a stage
- play the complete sequence
- optionally scrub, where useful

Do not assume every action must be played from zero.

## Reset

RESET must be deterministic and restore the exact assembled state.
