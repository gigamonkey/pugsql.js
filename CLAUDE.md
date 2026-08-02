# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Test**: `npm test` (runs `node test.js` — no framework, plain assertions)
- **Format**: `npx prettier --write .` (or `make pretty`)
- **Release**: `make release` (tests, bumps version, tags, pushes; the tag push triggers the npm publish workflow). Bump level: `make release VERSION=minor` etc., defaults to patch.

## Architecture

pugsql.js is a SQLite query management library for Node.js. It loads SQL queries defined in `.sql` files (with comment-based metadata) and exposes them as methods on a database wrapper object.

### Key modules

- **pugsql.js** — Main library. Exports the `DB` class which wraps `better-sqlite3`. Parses `.sql` files for query definitions in the format `-- :name queryName :kind(optional_arg)` and attaches them as methods. Query kinds: `run`, `changes`, `lastRowID`, `insert`, `get`, `all`, `one`, `list`, `exists`.
- **puglify.js** — CLI tool (executable). Introspects a SQLite database schema and auto-generates standard CRUD `.sql` query files. Uses `data/puglify.sql` for its own metadata queries.
- **test.js** — Smoke tests using a manual `expect()` helper. Uses `schema.sql` and `queries.sql` to set up a test database (`db.db`).

### Conventions

- ES modules (`"type": "module"`) throughout.
- Private class members use `#` prefix.
- No linting, no TypeScript, no test framework — intentionally lightweight.
- `better-sqlite3` is the sole database driver; the library is SQLite-only.
