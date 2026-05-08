# Outlaw

## Purpose
Type-safe SQLite library with schema-first design and automatic "cowboy migrations" (schema diffing + auto-migrate). Built for Cloudflare D1 but abstracts over any SQLite `Connection`.

## Architecture (8 modules)
- **Schema Builder** (`schemaBuilder/`) — declarative table/column definitions, fluent API with type narrowing (`text.notNull.unique`, `integer.primaryKey.autoincrement`). Uses `Omit<..., Defined>` to remove already-used modifiers.
- **Query Builder** (`queryBuilder/`) — fluent SELECT/INSERT/UPDATE/DELETE builders. All complete.
- **Query Generator** (`queryGenerator/`) — converts builder command objects → SQL strings. All complete.
- **Schema Generator** (`schemaGenerator/`) — generates CREATE TABLE SQL from `TableData` metadata. Complete.
- **Cowboy Migration** (`cowboyMigration/`) — auto-migration on first query via `CowboyConnection` wrapper. Diffs schema metadata stored as JSON in `cowboy_migration` table. Uses interim table pattern (create new, copy data, drop old, rename). `createSchemaHacker()` for manual rename/drop hints.
- **API** (`api/`) — `createDatabase(connection, schema)` → typed table access (`db.users.select(...)`)
- **Reflection** (`reflection/`) — `Reflector` class, runtime schema introspection via `PRAGMA table_list`
- **Framework** (`framework/`) — `Format` (SQL escaping via sqlstring-sqlite). SQL string building uses `print` from `@sigitex/print`.

## Key Files
- `src/api/createDatabase.ts` — database factory, `DatabaseApi<Tables>` type
- `src/api/DatabaseTable.ts` — `TableApi<Columns>` implementation (select/insert/update/delete)
- `src/api/D1Connection.ts` — Cloudflare D1 adapter
- `src/queryBuilder/SelectBuilder.ts` — complete fluent SELECT (where/limit/offset/orderBy/fetch/fetchOne)
- `src/queryBuilder/InsertBuilder.ts` — complete (columns, rows, returning)
- `src/queryBuilder/UpdateBuilder.ts` — complete (assignments, where, returning)
- `src/queryBuilder/DeleteBuilder.ts` — complete (where, returning)
- `src/queryGenerator/generateSelect.ts` — complete SQL generation
- `src/queryGenerator/generateInsert.ts` — complete SQL generation
- `src/queryGenerator/generateUpdate.ts` — complete SQL generation
- `src/queryGenerator/generateDelete.ts` — complete SQL generation
- `src/schemaBuilder/createTable.ts` — table builder with constraints
- `src/schemaBuilder/columnBuilders.ts` — column type builders (text/integer/real/blob)
- `src/cowboyMigration/CowboyConnection.ts` — connection wrapper that auto-migrates
- `src/cowboyMigration/CowboyMigrator.ts` — migration engine
- `src/cowboyMigration/Compare.ts` — schema comparison
- `src/framework/Format.ts` — SQL escaping

## Design Pattern
```
Schema Builders → TableData metadata
Query Builders → Command objects → Query Generators → SQL strings
CowboyConnection (intercepts first query, auto-migrates) → Connection.execute(sql)
```

## What's Complete
- Schema building (full type-safe fluent API)
- SELECT queries end-to-end (WHERE/ORDER BY/LIMIT/OFFSET)
- Schema generation (CREATE TABLE)
- Cowboy migrations (auto-create/rebuild tables, column renaming via hacks)
- Connection abstraction + D1 adapter
- Type inference (column types → query results, nullability)

## What's Incomplete

> Note: this is out of date

- **INSERT/UPDATE conflict clauses** — `OR REPLACE`, `OR IGNORE`, etc. not yet supported
- **Migration edge cases** — `hack.renamed.table().to()` partially stubbed, `hack.dropped.table()` unused
- **Future features** — views, indexes, column check constraints, seed data, type mappings (boolean/JSON/timestamp/date), versioned migrations

## Dependencies
- `sqlstring-sqlite` (^0.1.1) — SQL escaping
- `@cloudflare/workers-types` (dev) — D1 types
