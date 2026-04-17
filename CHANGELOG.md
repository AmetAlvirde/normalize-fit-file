# Changelog

All notable changes to this project are documented in this file.

## [1.2.0] - 2026-04-17

### Changed

- **`compare` CLI**: Takes **two required positional arguments** (paths to normalized JSON or YAML). Comparison reports use **dynamic keys** derived from each input file’s **basename** (not fixed `garmin` / `ffp` labels). Default report output is **`./comparison-report.<format>`**; use **`-f`** / **`-o`** for format and path (see `normalize-fit-file help`).
- **Documentation**: [README.md](README.md), [docs/followup-key-aliasing.md](docs/followup-key-aliasing.md), and [docs/stryd-fit-fields.md](docs/stryd-fit-fields.md) updated to match current CLI behavior (default output paths next to the working directory, **JSON/YAML** options, raw **`-raw`** sibling files, and the compare workflow).
