# PC Anatomy — Product UI/UX Vision

## Product goal

Transform the approved 3D asset into an educational experience that feels like a premium interactive technical visualization.

The experience should make the PC easier to understand, not simply make the model look dramatic.

## Core principle

**The 3D model is the hero. The UI supports the model.**

Do not surround the model with dense dashboards.

## Visual direction

Target:

- premium
- technical
- educational
- calm
- modern
- precise
- spacious
- readable

Avoid:

- dark-on-dark information
- giant debug panels
- excessive glassmorphism
- neon cyberpunk styling
- unnecessary gradients
- excessive rounded cards
- noisy animation
- decorative UI that competes with the PC

## Primary experience

Default state:

- complete assembled PC
- attractive 3/4 view
- good interior visibility
- subtle ambient environment
- compact control layer
- clear title/context

## Educational interaction

When a component is selected:

1. identify it
2. gently emphasize it
3. move the camera to a useful inspection angle
4. show concise educational information
5. offer the relevant disassembly action

Do not force the user to read a large wall of text.

## Navigation concept

Primary controls may include:

- Previous
- Next
- Play
- Pause
- Reset
- Explore/Inspect

A compact stage indicator should show progress.

## Hotspots

The future system may place numbered or semantic markers over components.

Markers must:

- track the component
- avoid excessive clutter
- not obscure important geometry
- have keyboard/touch equivalents
- disappear or reduce when focus changes

## Component information

A component panel can include:

- component name
- one-line purpose
- connection/context
- key learning point
- optional further detail

## Camera behavior

Camera movement should be:

- smooth
- deliberate
- fast enough to avoid frustration
- bounded
- reversible

Selection should not feel like the camera is being thrown across the scene.

## Lighting behavior

Lighting may respond slightly to focus.

Examples:

- GPU selected → subtle highlight
- motherboard selected → improve local readability
- CPU selected → closer camera and cleaner background

Do not recolor the actual asset permanently.

## Responsive design

Desktop is primary.

The layout must remain usable on:

- laptop
- tablet
- phone

On smaller screens, prioritize:

1. model
2. primary controls
3. selected component information

Secondary information can collapse.

## Product vs diagnostics

The old `web-test` harness is a validator.

It should not dictate the visual design.

Debug metrics should be accessible via a debug mode only.
