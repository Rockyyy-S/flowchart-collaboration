# Project Guidelines

## Workspace Status
- This repository is currently in the discovery/documentation phase.
- There is no runnable application code, dependency manifest, or test suite yet.
- Do not invent build/test commands when they are not present.

## Source of Truth
- Use `raw-data/关于流程图驱动的项目协作管理软件的初始想法.md` as the primary problem statement.
- Use files under `raw-data/各大AI聊天工具根据我的想法给出来的落地方案/` as external-solution references.
- Treat `.history/` as editor history only, not as canonical project documentation.

## Working Conventions
- Prefer Chinese for explanations, summaries, and generated documentation unless the user asks otherwise.
- Keep outputs practical and implementation-oriented: requirements, architecture options, trade-offs, and execution steps.
- When consolidating or comparing方案, preserve traceability by citing source filenames.
- For new docs, keep Markdown structure clear and stable (`#`, `##`, short sections, actionable bullets).

## Build and Test
- No standard build/test workflow exists yet.
- If implementation files are introduced later, first detect stack-specific commands from manifests (`package.json`, `pyproject.toml`, etc.) before running anything.

## Scope Boundaries
- Do not perform destructive cleanup or remove existing research notes unless explicitly requested.
- Prefer additive edits: create new synthesis docs or append clearly labeled sections.
- If assumptions are required, state them explicitly and keep them minimal.
