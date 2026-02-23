# LeasePlatform Agent Workflow

This file defines the default collaboration workflow for Codex in this repository.

## Git Mode (MVP)

1. Default branch is `main`.
2. No extra branches unless:
   - user explicitly asks for a branch/PR, or
   - there is a high risk of mixing unrelated local changes.
3. One task = one small commit.
4. Stage files explicitly (`git add <file1> <file2> ...`), never broad add for routine work.
5. Do not include unrelated modified files in the commit.
6. After each completed task:
   - commit,
   - push,
   - report commit hash and exact file list to the user.

## Safety Rules

1. Always check `git status --short` before staging.
2. If unrelated changes exist, keep them untouched.
3. Never run destructive git commands (`reset --hard`, forced checkout) unless user explicitly requests.
4. Do not rewrite history (`push --force`) unless user explicitly requests.

## Communication Rules

1. Keep updates short and concrete.
2. Before edits, state what files will be changed.
3. After push, provide:
   - branch,
   - commit hash,
   - changed files,
   - next action for user (if needed).
