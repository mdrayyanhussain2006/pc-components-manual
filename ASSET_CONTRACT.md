# Frozen 3D Asset Contract

## Approved runtime asset

`build/export/pc_anatomy_web_final.glb`

## Reference asset

`build/export/pc_anatomy_master.glb`

## Blender sources

`build/animated.blend`

`build/detail.blend`

These remain immutable unless the user explicitly opens a new asset-production phase.

## Structural contract

Required semantic components:

- CASE
- CASE_SIDE_PANEL
- MOTHERBOARD
- CPU
- CPU_COOLER
- RAM_01
- RAM_02
- RAM_03
- RAM_04
- GPU
- M2_SSD
- STORAGE
- PSU
- CASE_FAN_01
- CASE_FAN_02
- CASE_FAN_03
- CABLE_24PIN
- CABLE_CPU_POWER
- CABLE_GPU_POWER

Additional nodes/connectors may exist. Do not treat the presence of helper nodes as corruption.

The exported GLB contains additional support nodes beyond the 29 semantic entries. The 29 count represents the required semantic component inventory, not the total glTF node count.

## Approved exported inventory

- 25 meshes
- 17 materials
- 21 animations
- 33,383 triangles in the final web GLB

## Animation contract

Approved animation family:

- ASSEMBLED/reset behavior
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

The underlying exported file may contain helper/support clips or exact names with the project's `PC_Disassembly_*` naming convention.

Always inspect the GLB's actual animation names instead of hard-coding assumptions.

## Preservation rules

The web runtime may:

- blend clips
- stop clips
- scrub clips
- focus the camera
- highlight selected components
- add UI overlays
- add non-destructive scene lighting

The web runtime may NOT:

- alter mesh geometry
- rebuild components
- rename nodes in the asset
- bake new animation into the GLB
- merge semantic meshes
- apply destructive transforms to the source GLB
- modify the Blender source

## Rendering principle

The runtime should make the existing hardware detail easier to see.

Do not darken the scene merely to create a cinematic effect.
