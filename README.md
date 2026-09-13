# Outlaw

A trigger-happy SQLite framework. Type-safe, schema-first, with automatic migrations.

```
bun add @sigitex/outlaw
```

Attempts to mirror Sqlite syntax *very* closely. Currently works with Bun and Cloudflare Functions.

Define your schema in code, and Outlaw's [cowboy migrations](#cowboy-migrations) automatically diff and converge your database on startup.

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

Compose sources **before** selecting results. Examples in this section use a
`Connection` named `connection` and these schema definitions:

```ts
const users = createTable("users", {
  id: integer.primaryKey,
  name: text.notNull,
  managerId: integer,
})
const posts = createTable("posts", {
  id: integer.primaryKey,
  userId: integer.notNull,
  tenantId: integer.notNull,
  title: text.notNull,
  published: integer.map.boolean.notNull,
  createdAt: integer.map.timestamp.notNull,
})
const profiles = createTable("profiles", {
  userId: integer.notNull,
  tenantId: integer.notNull,
  bio: text,
})
const db = createDatabase(connection, createSchema({ users, posts, profiles }))
```

Strings work throughout joined queries. Bare names retain SQLite name resolution;
qualified strings identify a specific source. Only selected columns appear in the
result:

```ts
await db.users
  .join(posts)
  .on("users.id", "=", "posts.userId")
  .select("name", "title")
  .where("title", "Hello")
  .orderBy([["name", "asc"]])
  .limit(20)
  .offset(40)
  .fetch()
```

Refs and strings can be mixed. Projection aliases are optional; use them when
distinct output names are useful. `users.all` selects `users.*`, not every joined
column:

```ts
await db.users
  .leftJoin(posts)
  .on(users.id, "=", posts.userId)
  .select(users.id.as("userId"), posts.id.as("postId"), posts.title)
  .fetch()

await db.users
  .join(posts)
  .on("users.id", "=", posts.userId)
  .select(users.all, posts.title)
  .where(posts.published, true)
  .orderBy([[posts.createdAt, "desc"]])
  .fetch()
```

#### Join forms and constraints

`join`, `leftJoin`, `rightJoin`, `fullJoin`, and `crossJoin` each accept tables,
views, or SELECT subqueries. Constraints are optional for every form. Repeated
`on()` calls combine with `AND` on the latest join. `using()` accepts one or more
common column names and cannot be combined with `on()` on that same join.

```ts
await db.users.rightJoin(posts).on(users.id, "=", posts.userId)
  .select("name", "title").fetch()
await db.users.fullJoin(posts).on(users.id, "=", posts.userId)
  .select("name", "title").fetch()
await db.users.crossJoin(posts).select("name", "title").fetch()
await db.users.join(posts).select("name", "title").fetch()

await db.users.crossJoin(posts)
  .on(users.id, "=", posts.userId)
  .on(users.name, "!=", posts.title)
  .select("name", "title").fetch()

await db.posts.join(profiles).using("userId", "tenantId").select("*").fetch()
await db.posts.crossJoin(profiles).using("userId").select("userId").fetch()
await db.posts.fullJoin(profiles).using("userId").select("userId").fetch()
```

Both operands of `on(left, operator, right)` are **column identifiers**, including
strings. By contrast, the right-hand value of `where(column, value)` or
`where(column, operator, value)` is always a **literal value**, even if it happens
to equal a column name. Literal-value ON expressions are not supported.

`select("*")` emits an actual `*`, preserving SQLite's common-column suppression
with `USING`. Qualified refs and wildcards retain each source's own columns.
Unqualified common keys from right/full joins include surviving right-side values.
For explicitly projected common columns coalesced by `FULL JOIN ... USING`, Outlaw
emits a same-name `AS` solely to prevent SQLite from retaining identifier quotes in
the output key. No source names or distinct output names are invented.

`RIGHT JOIN` and `FULL JOIN` require **SQLite 3.39.0 or newer**. Outlaw does not probe
capabilities, emulate unsupported joins, validate rows, or preflight SQL structure.
SQLite errors, including ambiguous bare identifiers, propagate from the connection.
`NATURAL` joins and comma-separated sources are deferred. Join verification uses
local Bun SQLite; no live D1 verification is claimed.

#### Self-joins, subqueries, and views

Source aliases are explicit and non-mutating:

```ts
const managers = users.as("managers")
await db.users.leftJoin(managers)
  .on(users.managerId, "=", managers.id)
  .select(users.name.as("employeeName"), managers.name.as("managerName"))
  .orderBy([["employeeName", "asc"]])
  .fetch()
```

Subqueries expose only their projected outputs. Aliases remain optional; both
forms execute inline as part of one SELECT. Aliasing or embedding snapshots the
query, so later changes to the original builder do not alter an embedded query:

```ts
const publishedPosts = db.posts
  .select("id", "userId", "title", "createdAt")
  .where("published", true)
  .as("publishedPosts")

await db.users.join(publishedPosts)
  .on(users.id, "=", publishedPosts.userId)
  .select("name", publishedPosts.title, publishedPosts.createdAt)
  .fetch()

await db.users.join(db.posts.select("userId", "title"))
  .on("users.id", "=", "userId")
  .select("name", "title")
  .fetch()

const userPosts = createView("user_posts",
  users.leftJoin(posts).on(users.id, "=", posts.userId)
    .select(users.name.as("userName"), posts.title),
)
```

Schema-level queries need no connection. Add `userPosts` to `createSchema` to query
the view through the database API; it exposes only `userName` and nullable `title`.

#### Result types and duplicate names

Results stay flat. Left joins add `null` to incoming columns; right joins add
`null` to all accumulated left sources; full joins add it to both sides. Selected
properties remain required, never optional. For example, selecting `users.name`
and `posts.title` after a left join yields `{ name: string; title: string | null }`.

Mappings follow the selected source and output alias, including through subqueries
and views. Outer-join SQL nulls stay null; mapped values decode once at execution.
Filters use the referenced source's storage mapping.

Duplicate output names are allowed without aliases, nesting, or automatic
renaming. The connection's object-row behavior determines which duplicate value
survives; ordinary collisions have conservative union types. Incompatible mapping
collisions stay undecoded and are typed as `unknown`. Explicit distinct aliases
preserve precise field types when both values are needed.

#### Migrating the old join chain

`db.users.select(...).join(posts).on(...)` is removed, including schema-level
join-after-select calls. Move `select(...)` after source composition:

```ts
await db.users.join(posts).on(users.id, "=", posts.userId)
  .select(users.name, posts.title).fetch()
```

Joined columns are no longer implicitly appended to the projection. Select the
outputs needed explicitly, or use `*`/qualified wildcards. Existing single-table
SELECT and unrelated INSERT/UPDATE/DELETE chains retain their interfaces.

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
