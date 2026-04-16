# Project Guidelines

## Workspace Status
- This repository is an active MVP workspace with runnable backend and frontend code.
- Current stack: NestJS API in `apps/api` and React + Vite web app in `apps/web`.
- Documentation remains a first-class artifact; keep code and docs consistent.

## Source of Truth
Use this priority order when context conflicts:
1. `docs/context/flowchart-collaboration-context.md` for current stage status, gates, and blockers.
2. `docs/architecture/flowchart-collaboration-architecture.md` for module boundaries and design constraints.
3. `docs/requirements/flowchart-collaboration-prd.md` for requirement baseline.
4. `apps/api/README.md` and `apps/web/README.md` for local run and API/UI usage details.
5. `raw-data/关于流程图驱动的项目协作管理软件的初始想法.md` and files under `raw-data/各大AI聊天工具根据我的想法给出来的落地方案/` as ideation/reference material.

Treat `.history/` as editor history only, not as canonical project documentation.

## Working Conventions
- Always add comments to any code written: functions, classes, key logic blocks, and non-obvious decisions must have inline or block comments in Chinese.
- Prefer Chinese for explanations, summaries, and generated documentation unless the user asks otherwise.
- Keep outputs practical and implementation-oriented: requirements, architecture options, trade-offs, and execution steps.
- Preserve traceability by citing source filenames when consolidating/comparing方案.
- Keep Markdown structure clear and stable (`#`, `##`, short sections, actionable bullets).
- Follow "Link, don't embed": reference existing docs under `docs/` instead of duplicating long content.
- Do not invent capabilities or status; if uncertain, state assumptions explicitly.

## Build and Test
Backend (`apps/api`):
- Install: `npm install`
- Dev: `npm run start:dev`
- Build: `npm run build`
- Prod run: `npm run start:prod`

Frontend (`apps/web`):
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

Current test status:
- No automated test scripts are defined in either package yet.
- Do not fabricate test commands; rely on existing scripts/docs and report verification limits clearly.

Run commands from each app directory instead of assuming a workspace-level script runner.

## Architecture Snapshot
- `apps/api/src/app.module.ts` wires core modules: auth, projects, flows, executions, documents, audit, notifications, shared.
- API base prefix is `/api/v1`; frontend dev server proxies `/api` to `http://localhost:3000`.
- MVP data persistence is still memory-first in the current implementation; treat restart data loss and release gates as active constraints unless docs state otherwise.

## Scope Boundaries
- Do not perform destructive cleanup or remove existing research notes unless explicitly requested.
- Prefer additive edits: create new synthesis docs or append clearly labeled sections.
- If assumptions are required, state them explicitly and keep them minimal.
- If a task touches release readiness, check gate status in context/QA/security/release docs before declaring "ready".
