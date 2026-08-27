# W0 — Zed / GPT-5.6 Sol Architecture Audit + Environment Bootstrap

You are the lead WebGL Experience Architect and environment bootstrap agent for this project.

## Context injection protocol

Use explicit Zed context mentions before reasoning:

@AGENTS.md
@PROJECT_CONTEXT.md
@ASSET_CONTRACT.md
@ANIMATION_CONTRACT.md
@WEB_RUNTIME_CONTRACT.md
@UI_UX_VISION.md
@VALIDATION_MATRIX.md
@ZED_ENVIRONMENT_POLICY.md
@web-test/
@build/export/pc_anatomy_web_final.glb
@build/disassembly_manifest.json
@build/animation_stages.json

Use `/` commands/Skills where appropriate instead of putting every workflow instruction into the prompt. In particular, use:

`/lead-webgl-architect`
`/runtime-qa-engineer`

and use Zed's command palette actions when environment configuration is needed:

`agent: open settings`
`agent: manage profiles`
`agent: manage skills`
`agent: new thread`
`zed: extensions`

Do not invent slash-command names. If a command or skill is not available in this Zed installation, inspect the available commands/skills first.

## Phase 0 — environment + repository audit

Do NOT begin product implementation yet.

First:

1. Read the project instructions and contracts.
2. Audit the repository structure.
3. Audit the current `web-test` harness.
4. Inspect the actual final GLB.
5. Verify the current package/dependency/toolchain state.
6. Inspect Zed's current available skills, MCP/context servers, built-in tools, and extensions available to this environment.
7. Identify which additional capabilities would materially improve this project.

## Capability installation policy

You are authorized to INSTALL additional development capabilities when they materially improve the project, but use this order:

1. Zed built-in tools
2. existing project-local Skills
3. official/current Zed-supported MCP/context servers
4. well-maintained Skills from the open agent skills ecosystem
5. Zed Extensions
6. other external tooling only when clearly justified

Do not install capabilities merely because they exist.

Before installing anything external:

- state why it is needed
- state what permissions/network access it requires
- prefer well-maintained, relevant, security-reviewed options
- avoid duplicate tools that solve the same problem
- do not weaken the frozen asset boundary

The project owner has authorized necessary tools/extensions/MCP installation for this project, provided they are relevant and clearly justified.

## Important limitations to discover and report

Explicitly check whether any limitation affects:

- GPT-5.6 Sol tool calling
- Zed Agent Profiles
- Skills invocation
- project-local Skills discovery
- MCP availability
- browser automation
- visual/browser inspection
- Three.js/WebGL debugging
- Meshopt decoding
- local HTTP development server
- Windows/PowerShell compatibility
- large GLB inspection
- parallel agents/subagents

If a capability is unavailable, do not pretend it exists. Record the limitation and provide the best supported alternative.

## Runtime audit

The current `web-test/` is a diagnostic harness, not the final product UI.

Audit it for factual correctness before treating it as a baseline.

Pay particular attention to:

- stage → clip mapping
- M2_SSD versus STORAGE
- SECONDARY_OUT mapping
- FINAL_EXPLODE representation
- cable-specific actions
- reset implementation
- semantic node identification
- raw runtime node/mesh counts versus semantic counts
- debug UI versus product UI
- lighting

The exported GLB currently contains 21 animations. Do not assume a public `FINAL_EXPLODE` animation exists just because the manifest has a FINAL_EXPLODE presentation stage; inspect the actual animation list and design the runtime around the exported truth.

## Frozen boundary

Absolutely do not modify:

- `build/animated.blend`
- `build/detail.blend`
- `build/export/pc_anatomy_master.glb`
- `build/export/pc_anatomy_web_final.glb`
- the approved manifests

Do not solve WebGL problems by changing the asset.

## W0 deliverable

Produce:

1. repository audit
2. runtime harness audit
3. Zed environment/capability audit
4. recommended tool/Skill/MCP/Extension setup
5. exact limitations discovered
6. proposed production WebGL architecture
7. proposed folder structure
8. implementation phases
9. validation gates
10. installation/setup actions you recommend

Do not implement the production UI.

STOP after the audit and environment plan.
