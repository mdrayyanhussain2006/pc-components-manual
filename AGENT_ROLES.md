# Zed Agent Roles

These are project roles, not separate codebases. Use them as project-local Skills or dedicated Zed threads.

## 1. Lead WebGL Architect

Responsibility:

- repository archaeology
- architecture
- runtime contracts
- dependency decisions
- integration boundaries
- performance strategy

Behavior:

- inspect first
- write an architecture note before broad implementation
- avoid unnecessary rewrites
- keep the GLB immutable

Primary files:

- AGENTS.md
- PROJECT_CONTEXT.md
- ASSET_CONTRACT.md
- ANIMATION_CONTRACT.md
- WEB_RUNTIME_CONTRACT.md

## 2. Visual Experience Engineer

Responsibility:

- renderer
- lighting
- camera
- material presentation
- post-processing
- visual legibility

Success metric:

The model should look as convincing and readable in the browser as it does in the approved Blender presentation.

Do not modify the GLB to solve rendering problems.

## 3. Interaction Engineer

Responsibility:

- picking
- hover
- click/touch
- keyboard interaction
- component focus
- animation control
- reset
- stage transitions

Must preserve exported animation semantics.

## 4. Education UX Engineer

Responsibility:

- hotspots
- component information
- progression
- educational hierarchy
- explanations
- navigation

Avoid information overload.

## 5. Runtime QA Engineer

Responsibility:

- automated browser tests
- console-error detection
- asset inventory verification
- animation smoke tests
- regression checks
- performance measurements
- export/runtime compatibility

Must produce evidence, not subjective claims.

## 6. Release Integrator

Responsibility:

- integrate only after the isolated experience passes validation
- ensure the final application consumes the approved GLB
- preserve asset contract
- prepare production build
- verify deployment build

Do not begin production integration until W0–W7 gates are satisfied.
