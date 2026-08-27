# Zed Setup Guide — PC Anatomy Web Experience

## Goal

Configure Zed so the project has:

- always-on project instructions
- reusable project Skills
- a lead architecture thread
- specialized parallel threads when useful
- controlled terminal/edit permissions
- GPT-5.6 Sol as the lead model, where available through the configured provider

Zed's current documentation separates:

- Zed Agent
- Agent Profiles
- Tool Permissions
- Skills
- Instructions
- MCP

Use those mechanisms instead of putting every instruction into one prompt.

## 1. Open the project

Open the project directory:

`pc-components-manual/` (or repository root)

Ensure Zed treats it as a trusted worktree.

## 2. Add project instructions

Place:

`AGENTS.md`

at the project root.

Zed loads project `AGENTS.md` as persistent project instructions.

## 3. Add project Skills

Project-local Skills belong under:

`.agents/skills/`

Recommended roles:

`.agents/skills/lead-webgl-architect/SKILL.md`

`.agents/skills/visual-experience-engineer/SKILL.md`

`.agents/skills/interaction-engineer/SKILL.md`

`.agents/skills/education-ux-engineer/SKILL.md`

`.agents/skills/runtime-qa-engineer/SKILL.md`

`.agents/skills/release-integrator/SKILL.md`

Keep each SKILL.md focused. Put long reference material in the project root contracts.

## 4. Configure GPT-5.6 Sol

In Zed:

`agent: open settings`

Configure the appropriate LLM Provider/account and select GPT-5.6 Sol where it is available in the configured provider.

Do not hard-code an unverified model identifier in project files.

## 5. Create a Lead profile

Open Agent Profiles:

`agent: manage profiles`

Create a custom profile:

`PC Anatomy Lead`

Recommended base:

`Write`

The profile should allow:

- read/search
- edit
- terminal
- project Skills

Keep MCP disabled until a concrete need is identified.

## 6. Tool permissions

Do not globally auto-approve everything.

Recommended baseline:

- read/search: allow
- edit/write: allow inside the trusted project
- terminal: confirm initially
- delete/move: confirm
- fetch/web: confirm
- MCP: confirm

Once the workflow stabilizes, safely allow repetitive commands such as:

- npm install
- npm run dev
- npm test
- npm run build

while keeping destructive commands confirmed.

## 7. Thread structure

Use dedicated threads instead of one infinite thread.

Recommended:

`W0 — Architecture Audit`

`W1 — Rendering & Lighting`

`W2 — Animation Runtime`

`W3 — Component Interaction`

`W4 — Education UX`

`W5 — Performance & QA`

`W6 — Integration`

Parallel work is useful only where tasks do not edit the same files.

## 8. First thread

Start with:

`W0 — Architecture Audit`

Use the Lead WebGL Architect Skill.

The first request should be:

"Read AGENTS.md, PROJECT_CONTEXT.md, all contracts, the current web-test, and the exported GLB. Do not modify files. Produce an architecture audit and proposed implementation plan. Do not begin implementation."

## 9. Do not start with UI coding

The first implementation should not be a redesign sprint.

First establish:

- rendering architecture
- scene ownership
- animation controller
- selection abstraction
- debug mode
- component metadata
- camera system

Then build the product UI around those systems.

## 10. Browser runtime

Use the current `web-test` as the diagnostic baseline.

Do not discard it.

The final product UI should be a separate experience layer.

## 11. Recommended development order

W0:
audit + architecture

W1:
lighting + camera + scene presentation

W2:
animation controller

W3:
component selection/focus

W4:
education layer

W5:
polished UI

W6:
performance + accessibility + QA

W7:
integration into the actual application

## 12. Definition of done for the isolated experience

Do not integrate into the real website until:

- the model is visually readable
- the UI no longer feels like a debug console
- stage animations work
- reset works
- cable disconnect looks correct
- component selection works
- camera focus works
- keyboard/touch work
- no normal-operation console errors
- responsive layout passes
- performance is acceptable
- GLB remains immutable
