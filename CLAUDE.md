# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

dexTodo: a terminal todo-list app built on [OpenTUI](https://github.com/sst/opentui) (`@opentui/core`), run with Bun. Single-window app, no build step — TypeScript is run directly by Bun and only typechecked (not compiled) via `tsc`. Data persists in a SQLite database via Bun's built-in `bun:sqlite`.

## Commands

```bash
bun install                    # install deps
bun run src/index.ts           # run (or: bun start)
bun run --watch src/index.ts   # dev, restarts on save (or: bun dev)
bunx tsc --noEmit               # typecheck (tsconfig has noEmit: true, strict: true)
bun run build                  # compile standalone dist/dextodo.exe (Windows x64)
bun run build:linux            # compile dist/dextodo-linux-x64
bun run build:macos-arm64      # compile dist/dextodo-macos-arm64
bun run build:macos-x64        # compile dist/dextodo-macos-x64
bun run build:all              # compile all of the above
```

There is no test suite and no lint config in this repo — don't assume `bun test` or a linter exists.

## Keeping docs in sync

Update `README.md` (user-facing usage/keybindings) and this file (architecture/dev commands) as part of the same change whenever code changes make them stale.

## Architecture

Everything lives flat in `src/`, one file per concern:

- `index.ts` — entry point: opens the `TodoStore` (SQLite), creates the renderer, constructs `App`.
- `db.ts` — `TodoStore`: all SQLite access (`bun:sqlite`). Owns schema creation and every query (`listActive`, `listCompleted`, `add`, `update`, `markStarted`, `markCompleted`, `remove`). No other file touches the database directly.
- `app.ts` — the whole UI. Two `SelectRenderable` lists (Active / Completed) inside bordered `BoxRenderable`s, a shared `PromptBar` for text input, and all key routing.
- `promptBar.ts` — one-shot bottom bar (label + input), resolves a `Promise<string | null>` on Enter/Escape. Reused sequentially for every text prompt (add title, add due date, edit title, edit due date) rather than having a bespoke modal per field.
- `dateUtil.ts` — strict `YYYY-MM-DD` parsing (`parseDate`, rejects overflow dates like `2026-02-30` that `Date` would otherwise silently roll forward) and stamp formatting.
- `types.ts` — the `Todo`/`TodoStatus` shape shared between `db.ts` and `app.ts`.

### Data model

`todos` table: `id`, `title`, `due_date` (nullable, optional target date set at creation or edit), `status` (`pending` | `started` | `completed`), `started_at`, `completed_at`, `created_at`. The **Active** section is every row with `status != 'completed'` (both `pending` and `started`); the **Completed** section is `status = 'completed'`. There is no "reopen" path back to Active — the only exit from Completed is a permanent `remove` (delete), not a status change.

Database file defaults to `~/.dextodo/todos.sqlite` (see `TodoStore.defaultPath()`) so the todo list is a single global list, not per-directory — pass a path to the `TodoStore` constructor to override (used by tests/tooling).

### Key routing

`App` registers one listener, `renderer.keyInput.on("keypress", ...)`, same pattern as dexEdit: it must run its own dispatch (overlay-gated early returns) since OpenTUI runs plain `.on()` listeners before the focused renderable's `handleKeyPress`, and `key.preventDefault()` stops the event from reaching the focused widget.

- `Tab` cycles focus between the Active and Completed `SelectRenderable`s (only `Active`'s selection is a valid target for `s`/`c`; only `Completed`'s selection is a valid target for `d`).
- `a` → add flow (title prompt, then due-date prompt prefilled with `todayStamp()`; canceling the title aborts, canceling the date just skips it, clearing the prefill before Enter means no due date).
- Selecting an item (`Enter`, via `SelectRenderableEvents.ITEM_SELECTED`) → modify flow, prefilled with current title/due date.
- `s` marks the selected Active item started (no-op unless it's currently `pending`).
- `c` marks the selected Active item completed.
- `d` → delete flow for the selected Completed item (no-op unless focus is on Completed): prompts `Delete "title"? (y/N)` via the shared `PromptBar` (any answer other than `y`/`Y`, including cancel, aborts). No "undo" path once confirmed — matches the spec's add / modify / mark started / mark completed / delete-completed scope.
- `q` quits.

### Reading OpenTUI's API

`@opentui/core` ships only compiled output + `.d.ts` files in `node_modules/@opentui/core` — no bundled docs, no source. The `.d.ts` files (`renderables/Select.d.ts`, `renderables/Input.d.ts`, `Renderable.d.ts`, `renderer.d.ts`) are the primary reference. For behavior not obvious from types alone, grep the compiled chunks (`index.js`, `index-7z5n7k9m.js`, `index-za1krqsf.js`) — deterministically-named esbuild output, not obfuscated.
