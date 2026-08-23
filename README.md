# Outlaw

A trigger-happy SQLite framework. Type-safe, schema-first, with automatic migrations.

```
bun add @sigitex/outlaw
```

Attempts to mirror Sqlite syntax *very* closely. Currently works with Bun and Cloudflare Functions.

Define your schema in code, and Outlaw's [cowboy migrations](#cowboy-migrations) automatically diff and converge your database on startup -- no migration files, no CLI steps. Just change your schema and go.

> **Note:** This package exports TypeScript sources directly. A TypeScript-compatible runtime or bundler (Bun, etc.) is required.

## Quick Start

```ts
// 1. Define your schema
const users = createTable("users", {
  id: integer.primaryKey.autoincrement,
  name: text.notNull,
  email: text.notNull.unique,
})

const schema = createSchema({ users })

// 2. Create a connection with auto-migration
const bun = new BunConnection(new Database("app.db"))
const connection = new CowboyConnection(bun, schema)

// 3. Use the typed database API
const db = createDatabase(connection, schema)

await db.users.insert({ name: "Wyatt", email: "wyatt@earp.com" }).execute()

const allUsers = await db.users.select("*").fetch()
const user = await db.users.select("*").where("id", 1).first()
```

## Schema Definition

### Tables

Define tables with `createTable`. Each column uses a builder chain starting from a base type.

```ts
import { createTable, text, integer, real, blob } from "@sigitex/outlaw"

const products = createTable("products", {
  id: integer.primaryKey.autoincrement,
  name: text.notNull,
  description: text,               // nullable by default
  price: real.notNull,
  image: blob,
  sku: text.notNull.unique,
})
```

#### Column Types

| Builder   | SQLite Type | TypeScript Type |
|-----------|-------------|-----------------|
| `text`    | TEXT        | `string`        |
| `integer` | INTEGER     | `number`        |
| `real`    | REAL        | `number`        |
| `blob`    | BLOB        | `ArrayBuffer`   |

#### Column Modifiers

Modifiers are chained as properties or method calls:

```ts
text.notNull                          // NOT NULL
integer.primaryKey                    // PRIMARY KEY
integer.primaryKey.autoincrement      // PRIMARY KEY AUTOINCREMENT
text.unique                           // UNIQUE
text.default("'unknown'")             // DEFAULT 'unknown'
text.check("length(name) > 0")       // CHECK constraint
integer.foreignKey.references(other.id) // FOREIGN KEY
```

Each modifier can only be used once per column -- the type system removes it after use.

#### Type Mappings

Map SQLite storage types to richer TypeScript types:

```ts
const events = createTable("events", {
  id: integer.primaryKey.autoincrement,
  active: integer.notNull.map.boolean,     // stored as 0/1, typed as boolean
  createdAt: integer.notNull.map.timestamp, // stored as epoch ms, typed as Date
  scheduledFor: text.map.date,              // stored as ISO string, typed as Date
  metadata: text.map.json<{ tags: string[] }>(), // stored as JSON string, typed as object
})
```

#### Table Constraints

Add composite constraints after column definitions:

```ts
const memberships = createTable("memberships", {
  userId: integer.notNull.foreignKey.references(users.id),
  groupId: integer.notNull.foreignKey.references(groups.id),
})
  .primaryKey("userId", "groupId")
  .unique("userId", "groupId")
  .check("userId != groupId")
```

### Views

Define views from query builders on existing tables:

```ts
import { createView } from "@sigitex/outlaw"

const activeUsers = createView("active_users",
  users.select("id", "name").where("active", 1)
)
```

### Indexes

```ts
import { createIndex, createUniqueIndex } from "@sigitex/outlaw"

const emailIndex = createUniqueIndex("idx_users_email").on(users.email)
const nameIndex = createIndex("idx_users_name").on(users.name)
```

### Schema

Group tables, views, and indexes into a schema:

```ts
import { createSchema } from "@sigitex/outlaw"

const schema = createSchema({
  users,
  products,
  memberships,
  activeUsers,
  emailIndex,
  nameIndex,
})
```

## Connections

Outlaw abstracts over any SQLite connection via the `Connection` interface:

```ts
type Connection = {
  query<Row>(sql: string): Promise<Row[]>
  script(statements: string[]): Promise<void>
  transaction?<Result>(
    work: (connection: TransactionalConnection) => Promise<Result>,
  ): Promise<Result>
}
```

Two built-in adapters are provided:

### Bun

```ts
import { BunConnection } from "@sigitex/outlaw/bun"
import { Database } from "bun:sqlite"

const connection = new BunConnection(new Database("app.db"))
```

### Cloudflare D1

```ts
import { CloudflareConnection } from "@sigitex/outlaw/cloudflare"

// Inside a Cloudflare Worker
const connection = new CloudflareConnection(env.DB)
```

## Database API

`createDatabase` returns a typed object with an accessor for each table and view in the schema.

```ts
import { createDatabase } from "@sigitex/outlaw"

const db = createDatabase(connection, schema)
```

Every database API exposes `transaction`. Supported connections provide a fresh
database API bound to the transaction-scoped connection:

```ts
await db.transaction(async (tx) => {
  await tx.users.insert({ name: "Wyatt" }).execute()

  await tx.transaction(async (nested) => {
    await nested.products.insert({ name: "Hat" }).execute()
  })
})
```

Use only the callback's scoped database API until that callback ends. Bun
serializes root operations, uses `BEGIN IMMEDIATE`, and implements nested
callbacks with savepoints. Cloudflare D1 does not support interactive callback
transactions; `transaction` throws `UnsupportedTransactionError` before the
callback runs, while `script()` remains available through D1 batch.

### Select

```ts
// Select all columns
const rows = await db.users.select("*").fetch()

// Select specific columns
const names = await db.users.select("name", "email").fetch()

// Single result (throws if no match)
const user = await db.users.select("*").where("id", 1).first()

// Filtering
db.users.select("*")
  .where("name", "Wyatt")             // equality
  .where("age", ">=", 21)             // comparison operators
  .where("deletedAt", "is null")       // unary operators

// Sorting, pagination
db.users.select("*")
  .orderBy([["name", "asc"], ["id", "desc"]])
  .limit(10)
  .offset(20)
  .fetch()
```

### Joins

```ts
db.users.select("*")
  .join(posts).on(users.id, "=", posts.userId)
  .fetch()

db.users.select("*")
  .leftJoin(posts).on(users.id, "=", posts.userId)
  .fetch()
```

Join types: `join`, `leftJoin`, `rightJoin`, `crossJoin`. Each accepts a table or a subquery.

### Insert

```ts
// Single row
await db.users.insert({ name: "Doc", email: "doc@ok.com" }).execute()

// With returning
const [inserted] = await db.users
  .insert({ name: "Doc", email: "doc@ok.com" })
  .returning("*")
  .execute()
```

### Update

```ts
await db.users
  .update({ name: "Morgan" })
  .where("id", 3)
  .execute()

// With returning
const updated = await db.users
  .update({ name: "Morgan" })
  .where("id", 3)
  .returning("*")
  .execute()
```

### Delete

```ts
await db.users
  .delete()
  .where("id", 3)
  .execute()

// With returning
const deleted = await db.users
  .delete()
  .where("id", 3)
  .returning("*")
  .execute()
```

## Cowboy Migrations

Wrap any connection with `CowboyConnection` to enable automatic schema migration. On the first query, Outlaw diffs the database against your schema and applies changes -- creating missing tables, rebuilding tables whose columns have changed, and managing views and indexes.

```ts
import { CowboyConnection } from "@sigitex/outlaw"

const connection = new CowboyConnection(rawConnection, schema)
```

Schema metadata is stored in a `cowboy_migration` table. When columns change, Outlaw uses an interim table pattern: create the new table, copy data, drop the old one, rename.

### Schema Hacks

Destructive changes (renaming or dropping tables/columns) require explicit hints via `createSchemaHacker`, so data isn't silently lost:

```ts
import { createSchemaHacker } from "@sigitex/outlaw"

const hack = createSchemaHacker()

hack.renamed.table("old_users", "users")
hack.renamed.column("users", "firstName", "name")
hack.dropped.table("legacy_data")
hack.dropped.column("users", "deprecated_field")

const connection = new CowboyConnection(rawConnection, schema, {
  hacks: hack.hacks,
})
```

## Fixtures and Seeds

Pre-populate tables with `createFixture` (or its alias `createSeed`). Fixtures can use templates to provide default values and `RefBy` to reference rows in other tables.

```ts
import { createFixture } from "@sigitex/outlaw"

// Simple fixture
const userFixture = createFixture(users, [
  { name: "Wyatt", email: "wyatt@earp.com" },
  { name: "Doc", email: "doc@ok.com" },
])

// Fixture with a template for default values
const postFixture = createFixture(posts,
  { createdAt: () => Date.now() },   // template: default for createdAt
  [
    { title: "First Post", userId: users.by.id(1) },  // RefBy
    { title: "Second Post", userId: users.by.id(1) },
  ],
)

// Pass to CowboyConnection
const connection = new CowboyConnection(rawConnection, schema, {
  fixtures: { userFixture, postFixture },
  runFixtures: true,
})
```

## License

MIT
