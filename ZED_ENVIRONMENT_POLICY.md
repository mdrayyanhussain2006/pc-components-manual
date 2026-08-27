# ZED_ENVIRONMENT_POLICY.md

## Official Zed operating model

Zed Agent uses:

- LLM Providers for model access
- Agent Profiles for tool availability
- Tool Permissions for approval/deny/allow behavior
- Skills for reusable workflows
- Instructions for always-on project guidance
- MCP for external/custom context and tools
- Extensions for editor functionality and, where offered, MCP servers

Keep these responsibilities separate.

## Context convention

Prefer explicit `@` context for important files/directories/symbols/threads/URLs.

Recommended core context:

@AGENTS.md
@PROJECT_CONTEXT.md
@ASSET_CONTRACT.md
@ANIMATION_CONTRACT.md
@WEB_RUNTIME_CONTRACT.md
@UI_UX_VISION.md
@VALIDATION_MATRIX.md

Use `@web-test/` when auditing runtime code.

Use `@build/export/pc_anatomy_web_final.glb` when inspecting the approved asset.

## Slash command convention

Use slash commands for reusable Skills/workflows, for example:

/lead-webgl-architect
/runtime-qa-engineer

Use Zed command-palette actions for environment actions, for example:

agent: new thread
agent: manage profiles
agent: manage skills
agent: open settings
zed: extensions

Do not invent command names. Check the installed Zed command catalog if uncertain.

## Capability strategy

Do not install a "tool stack" blindly.

Install only capabilities that fill an identified gap.

Preferred categories:

### Skills
Use project-local Skills first.

Potential external candidates for later evaluation:

- frontend-design
- agent-browser
- vercel-react-best-practices
- web-design-guidelines
- improve-codebase-architecture
- find-skills

The open skills ecosystem currently provides these kinds of reusable packages, but every external Skill must be inspected before installation.

### MCP
MCP is appropriate for external context/tool access that the built-in Zed tools do not provide.

Do not add MCP merely for novelty.

For browser inspection, a browser automation MCP may become useful if the installed model/environment cannot adequately validate the runtime through normal Zed tools.

### Extensions
Use the Zed Extension Gallery for language support, themes, debuggers, snippets, and available MCP/agent integrations.

Do not install themes or cosmetic extensions as a substitute for product UX work.

## Permissions

Default philosophy:

- safe reads/searches: allow
- project edits: allow in the trusted worktree
- normal dev commands: allow once verified
- installs/network: confirm initially
- destructive delete/move: always confirm
- secrets/environment-file access: always confirm
- external MCP actions: confirm until trust is established

The project owner has explicitly authorized relevant installs, but authorization does not mean every available tool should be installed.

## Frozen asset rule

No capability installation may alter:

- Blender sources
- approved GLB
- manifests
- animation source files

All WebGL improvements happen in runtime/application code.

## Known capability limitations to check

Report the actual installed environment rather than assuming:

- Zed version
- GPT-5.6 Sol availability and tool calling
- available Skills
- available MCP servers
- browser automation access
- Windows terminal/shell behavior
- Node/npm/pnpm availability
- Three.js tooling
- Meshopt support
- WebGL debugging
- visual screenshot/browser capture

When a limitation exists, document it and adapt the workflow.
