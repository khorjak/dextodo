# dexTodo

[![GitHub repo](https://img.shields.io/badge/GitHub-khorjak%2Fdextodo-blue?logo=github)](https://github.com/khorjak/dextodo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Terminal todo list built on [OpenTUI](https://github.com/sst/opentui), run with [Bun](https://bun.sh). Data is stored in a local SQLite database at `~/.dextodo/todos.sqlite`.

## Install & run

```bash
bun install
bun start
```

## Keybindings

| Key      | Action                                            |
| -------- | -------------------------------------------------- |
| `Tab`    | Switch focus between Active and Completed sections |
| `↑` / `↓`| Move selection                                     |
| `a`      | Add a new todo (title, then optional due date)     |
| `Enter`  | Modify the selected todo (title and/or due date)   |
| `s`      | Mark the selected Active todo as started            |
| `c`      | Mark the selected Active todo as completed          |
| `d`      | Delete the selected Completed todo                  |
| `q`      | Quit                                                |

Due dates use `YYYY-MM-DD`. Leaving the due-date prompt blank means no date.

## Sections

- **Active** — todos not yet completed (pending or started), sorted by due date.
- **Completed** — todos marked completed, most recently completed first.

## Build a standalone binary

```bash
bun run build            # dist/dextodo.exe (Windows x64)
bun run build:linux
bun run build:macos-arm64
bun run build:macos-x64
bun run build:all
```
