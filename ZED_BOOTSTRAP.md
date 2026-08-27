# ZED_BOOTSTRAP.md

## 1. Open the actual project root

Open the directory containing:

`AGENTS.md`

`PROJECT_CONTEXT.md`

`build/`

`scripts/`

`web-test/`

Do not open the nested handoff folder as the project root.

## 2. Trust the worktree

Project-local Skills are only loaded from trusted worktrees in Zed.

## 3. Configure Zed Agent

Use:

`agent: open settings`

Then configure your GPT-5.6 Sol provider/account if available.

Create/select a Write-style custom profile using:

`agent: manage profiles`

The project needs read/search/edit/terminal access, plus only the MCP/context servers actually justified by W0.

## 4. Manage Skills

Use:

`agent: manage skills`

Verify the project-local Skills under:

`.agents/skills/`

You can invoke them with `/skill-name` or `@skill` after installation.

## 5. Extensions

Use:

`zed: extensions`

Only install extensions that address an identified need.

## 6. MCP

Use:

`agent: open settings`

and inspect the MCP Servers section.

MCP is optional. Let W0 identify a concrete missing capability before adding servers.

## 7. First thread

Create:

`W0 — Architecture Audit`

Invoke:

`/lead-webgl-architect`

Explicitly add:

@AGENTS.md
@PROJECT_CONTEXT.md
@ASSET_CONTRACT.md
@ANIMATION_CONTRACT.md
@WEB_RUNTIME_CONTRACT.md
@UI_UX_VISION.md
@VALIDATION_MATRIX.md
@ZED_ENVIRONMENT_POLICY.md
@RUNTIME_HARNESS_KNOWN_ISSUES.md
@web-test/
@build/export/pc_anatomy_web_final.glb

Then send `W0_FIRST_PROMPT.md`.

## 8. Installation policy

The lead agent may install relevant Skills, MCP servers, or extensions after documenting:

- what gap the capability fills
- why the capability is better than built-in tools
- permissions/network requirements
- how it will be tested
- how it can be removed

No unrelated installations.

## 9. Keep production boundaries

Do not modify:

- animated.blend
- detail.blend
- pc_anatomy_master.glb
- pc_anatomy_web_final.glb

until the project owner explicitly authorizes an asset-phase change.
