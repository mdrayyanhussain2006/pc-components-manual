# Zed Handoff Checklist

## Before opening Zed

- [ ] Copy the files from this handoff bundle into the project root.
- [ ] Confirm `AGENTS.md` is at project root.
- [ ] Confirm `.agents/skills/` exists.
- [ ] Confirm the approved GLB exists at `build/export/pc_anatomy_web_final.glb`.
- [ ] Do not overwrite the approved GLB.

## In Zed

- [ ] Open the actual project folder.
- [ ] Trust the worktree.
- [ ] Configure GPT-5.6 Sol through the configured provider/account.
- [ ] Create or select the `PC Anatomy Lead` profile.
- [ ] Use the `Write`-style tools for implementation threads.
- [ ] Keep destructive operations confirmed.
- [ ] Start thread: `W0 — Architecture Audit`.
- [ ] Load `lead-webgl-architect`.

## First run

- [ ] Send `W0_FIRST_PROMPT.md`.
- [ ] Do not allow implementation in W0.
- [ ] Review the architecture audit.
- [ ] Only then start W1 rendering/lighting.

## Phase discipline

W0:
Audit only.

W1:
Lighting + camera.

W2:
Animation runtime.

W3:
Selection + focus.

W4:
Education UX.

W5:
Product UI polish.

W6:
Performance + QA.

W7:
Real application integration.

## Final gate

- [ ] No model changes
- [ ] No animation regressions
- [ ] No console errors
- [ ] Cable disconnect remains correct
- [ ] Reset works
- [ ] Component selection works
- [ ] Lighting is readable
- [ ] UI is not debug-heavy
- [ ] Responsive behavior passes
- [ ] Performance is acceptable
