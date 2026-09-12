import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import {
  CowboyConnection,
  createDatabase,
  createIndex,
  createSchema,
  createTable,
  createView,
  generateCreateIndex,
  generateCreateTable,
  generateSelect,
  integer,
  text,
  type Connection,
  type DatabaseApi,
  type SelectQueryBuilder,
} from "../src"
import { BunConnection } from "../src/bun"

const users = createTable("users", {
  id: integer.primaryKey,
  name: text.notNull,
  managerId: integer,
  active: integer.map.boolean.notNull,
})
const posts = createTable("posts", {
  id: integer.primaryKey,
  userId: integer.notNull,
  title: text.notNull,
  published: integer.map.boolean.notNull,
  createdAt: integer.map.timestamp.notNull,
  date: text.map.date,
  payload: text.map.json<{ ok: boolean }>().notNull,
})
const profiles = createTable("profiles", {
  id: text.notNull,
  userId: integer.notNull,
  title: text,
  active: text.map.json<{ enabled: boolean }>().notNull,
})
const schema = createSchema({ users, posts, profiles })
let sqlite: Database
let statements: string[]
let connection: Connection
let db: DatabaseApi<typeof schema.tables>

beforeEach(() => {
  sqlite = new Database(":memory:")
  statements = []
  connection = {
    async query<Row>(sql: string): Promise<Row[]> {
      statements.push(sql)
      return sqlite.query(sql).all() as Row[]
    },
    async script(sql) {
      for (const statement of sql) {
        sqlite.run(statement)
      }
    },
  }
  db = createDatabase(connection, schema)
  for (const table of [users, posts, profiles]) {
    sqlite.run(generateCreateTable(table.$meta))
  }
  sqlite.run(`
    insert into users values
      (1, 'Wyatt', null, 1), (2, 'Doc', 1, 0), (3, 'Jane', 1, 1);
    insert into posts values
      (10, 1, 'Hello', 1, 1000, '2024-01-01T00:00:00.000Z', '{"ok":true}'),
      (20, 2, 'World', 0, 2000, null, '{"ok":false}'),
      (30, 4, 'Orphan', 1, 3000, '2024-02-01T00:00:00.000Z', '{"ok":true}');
    insert into profiles values
      ('p1', 1, 'Hello', '{"enabled":true}'),
      ('p2', 5, 'Other', '{"enabled":false}');
  `)
})

afterEach(() => {
  sqlite.close()
})

for (const [method, sqlJoin] of [
  ["join", "join"],
  ["leftJoin", "left join"],
  ["rightJoin", "right join"],
  ["fullJoin", "full join"],
  ["crossJoin", "cross join"],
] as const) {
  describe(method, () => {
    test("matches SQLite with ON", async () => {
      await matches(
        db.users[method](posts)
          .on(users.id, "=", posts.userId)
          .select(users.name, posts.title),
        `select users.name, posts.title from users ${sqlJoin} posts on users.id = posts.userId`,
      )
    })

    test("accepts no constraint", async () => {
      await matches(
        db.users[method](posts).select(users.name, posts.title),
        `select users.name, posts.title from users ${sqlJoin} posts`,
      )
    })

    test("preserves common and qualified USING outputs", async () => {
      await matches(
        db.posts[method](profiles)
          .using("userId")
          .select("userId", posts.id.as("postId"), profiles.id.as("profileId")),
        `select userId, posts.id as postId, profiles.id as profileId from posts ${sqlJoin} profiles using(userId)`,
      )
    })

    test("executes an anonymous projected subquery inline", async () => {
      await matches(
        db.users[method](db.posts.select("userId", "title"))
          .on("users.id", "=", "userId")
          .select("name", "title"),
        `select name, title from users ${sqlJoin} (select userId, title from posts) on users.id = userId`,
      )
      expect(statements).toHaveLength(1)
    })
  })
}

test("source and projection aliases do not mutate schema metadata", () => {
  const before = JSON.stringify(users.$meta)
  const managers = users.as("managers")
  expect(JSON.stringify(users.$meta)).toBe(before)
  expect(users.id.table).toBe("users")
  expect(managers.id.table).toBe("managers")
  expect(users.id.as("userId").alias).toBe("userId")
  expect(users.all).toEqual({ table: "users", wildcard: true })
})

test("foreign-key and index metadata remain plain serializable data", () => {
  const linked = createTable("linked", {
    userId: integer.foreignKey.references(users.id),
  })
  expect(linked.$meta.columns[0].foreignKey).toEqual({
    table: "users",
    column: "id",
  })
  const serialized = JSON.stringify(linked.$meta)
  expect(JSON.parse(serialized).columns[0].foreignKey).toEqual({
    table: "users",
    column: "id",
  })
  expect(generateCreateTable(linked.$meta)).toContain(
    "foreign key (`userId`) references `users` (`id`)",
  )
  const index = createIndex("linked_idx").on(linked.userId)
  expect(index.$meta).toEqual({
    kind: "index",
    name: "linked_idx",
    table: "linked",
    columns: ["userId"],
    unique: false,
  })
  sqlite.run(generateCreateTable(linked.$meta))
  sqlite.run(generateCreateIndex(index.$meta))
})

test("repeated ON comparisons use AND and accept mixed refs and strings", async () => {
  await matches(
    db.users
      .join(posts)
      .on("users.id", "=", posts.userId)
      .on("name", "!=", "title")
      .select("name", "title"),
    "select name, title from users join posts on users.id = posts.userId and name != title",
  )
})

test("WHERE strings are values rather than ON column identifiers", async () => {
  await matches(
    db.users
      .join(posts)
      .on(users.id, "=", posts.userId)
      .select("name", "title")
      .where("title", "name"),
    "select name, title from users join posts on users.id = posts.userId where title = 'name'",
  )
  expect(statements[0]).toContain("`title` = 'name'")
})

test("bare joined-column filters do not qualify to the base source", async () => {
  await matches(
    db.users
      .join(posts)
      .on(users.id, "=", posts.userId)
      .select("name", "title")
      .where("title", "Hello"),
    "select name, title from users join posts on users.id = posts.userId where title = 'Hello'",
  )
})

test("ORDER BY precedes LIMIT and OFFSET", async () => {
  await matches(
    db.users
      .fullJoin(posts)
      .on(users.id, "=", posts.userId)
      .select(users.name, posts.title)
      .orderBy([[posts.title, "asc"]])
      .limit(2)
      .offset(1),
    "select users.name, posts.title from users full join posts on users.id = posts.userId order by posts.title asc limit 2 offset 1",
  )
})

test("LIMIT zero remains zero", async () => {
  await matches(
    db.users.select("name").limit(0),
    "select name from users limit 0",
  )
})

test("self-join aliases work in ON, SELECT, WHERE and ORDER BY", async () => {
  const managers = users.as("managers")
  await matches(
    db.users
      .leftJoin(managers)
      .on(users.managerId, "=", managers.id)
      .select(users.name.as("employeeName"), managers.name.as("managerName"))
      .where(managers.name, "Wyatt")
      .orderBy([["employeeName", "asc"]]),
    "select users.name as employeeName, managers.name as managerName from users left join users as managers on users.managerId = managers.id where managers.name = 'Wyatt' order by employeeName asc",
  )
})

test("successive joins retain left-to-right SQLite semantics", async () => {
  await matches(
    db.users
      .join(posts)
      .rightJoin(profiles)
      .on(posts.userId, "=", profiles.userId)
      .select(
        users.name,
        posts.title.as("postTitle"),
        profiles.id.as("profileId"),
      ),
    "select users.name, posts.title as postTitle, profiles.id as profileId from users join posts right join profiles on posts.userId = profiles.userId",
  )
})

test("duplicate ordinary output names follow connection behavior", async () => {
  await matches(
    db.users.join(profiles).select(users.id, profiles.id),
    "select users.id, profiles.id from users join profiles",
  )
})

test("qualified wildcards do not append unrelated joined columns", async () => {
  const query = db.users
    .join(posts)
    .on(users.id, "=", posts.userId)
    .select(users.all, posts.title)
  expect((await query.fetch())[0]).toEqual({
    id: 1,
    name: "Wyatt",
    managerId: null,
    active: true,
    title: "Hello",
  })
  expect(sqlOf(query)).toContain("select `users`.*, `posts`.`title`")
})

describe("USING wildcard and common-column semantics", () => {
  const leftKeys = createTable("left_keys", {
    userId: integer.notNull,
    groupId: integer.notNull,
    leftValue: text.notNull,
  })
  const rightKeys = createTable("right_keys", {
    userId: integer.notNull,
    groupId: integer.notNull,
    rightValue: text.notNull,
  })

  beforeEach(() => {
    sqlite.run(generateCreateTable(leftKeys.$meta))
    sqlite.run(generateCreateTable(rightKeys.$meta))
    sqlite.run(
      "insert into left_keys values(1, 1, 'left'), (2, 1, 'unmatched left')",
    )
    sqlite.run(
      "insert into right_keys values(1, 1, 'right'), (3, 1, 'unmatched right')",
    )
  })

  for (const [method, sqlJoin] of [
    ["join", "join"],
    ["leftJoin", "left join"],
    ["rightJoin", "right join"],
    ["fullJoin", "full join"],
  ] as const) {
    test(`${method} emits actual star with multi-column USING`, async () => {
      const keysDb = createDatabase(
        connection,
        createSchema({ leftKeys, rightKeys }),
      )
      const query = keysDb.leftKeys[method](rightKeys)
        .using("userId", "groupId")
        .select("*")
      await matches(
        query,
        `select * from left_keys ${sqlJoin} right_keys using(userId, groupId)`,
      )
      expect(sqlOf(query)).toStartWith("select *\n")
    })

    test(`${method} keeps common and source-specific keys separate`, async () => {
      const keysDb = createDatabase(
        connection,
        createSchema({ leftKeys, rightKeys }),
      )
      await matches(
        keysDb.leftKeys[method](rightKeys)
          .using("userId")
          .select(
            "userId",
            leftKeys.userId.as("leftKey"),
            rightKeys.userId.as("rightKey"),
          ),
        `select userId, left_keys.userId as leftKey, right_keys.userId as rightKey from left_keys ${sqlJoin} right_keys using(userId)`,
      )
    })
  }

  test("same-name aliases apply only to coalesced bare projections", () => {
    const keysDb = createDatabase(
      connection,
      createSchema({ leftKeys, rightKeys }),
    )
    const composition = keysDb.leftKeys.fullJoin(rightKeys).using("userId")
    expect(sqlOf(composition.select("userId"))).toContain(
      "`userId` as `userId`",
    )
    expect(sqlOf(composition.select(leftKeys.userId))).not.toContain(" as ")
    expect(sqlOf(composition.select("*"))).not.toContain(" as ")
  })

  for (const [method, sqlJoin] of [
    ["leftJoin", "left join"],
    ["rightJoin", "right join"],
  ] as const) {
    test(`coalesced keys survive a subsequent ${method}`, async () => {
      const keysDb = createDatabase(
        connection,
        createSchema({ leftKeys, rightKeys }),
      )
      const thirdKeys = rightKeys.as("thirdKeys")
      const composition = keysDb.leftKeys.fullJoin(rightKeys).using("userId")
      await matches(
        composition[method](thirdKeys).using("userId").select("userId"),
        `select userId from left_keys full join right_keys using(userId) ${sqlJoin} right_keys as thirdKeys using(userId)`,
      )
    })
  }

  test("coalesced keys remain usable through subqueries", async () => {
    const keysDb = createDatabase(
      connection,
      createSchema({ leftKeys, rightKeys }),
    )
    const common = keysDb.leftKeys
      .fullJoin(rightKeys)
      .using("userId")
      .select("userId")
      .as("common")
    await matches(
      keysDb.rightKeys
        .join(common)
        .on(rightKeys.userId, "=", common.userId)
        .select(common.userId),
      "select common.userId from right_keys join (select userId from left_keys full join right_keys using(userId)) as common on right_keys.userId = common.userId",
    )
  })

  test("nullable common keys retain SQL nulls", async () => {
    const shared = createTable("shared_nullable", {
      userId: integer,
      marker: text.notNull,
    })
    sqlite.run(generateCreateTable(shared.$meta))
    sqlite.run(
      "insert into shared_nullable values(null, 'nullable'), (4, 'four')",
    )
    const keysDb = createDatabase(connection, createSchema({ leftKeys }))
    await matches(
      keysDb.leftKeys.fullJoin(shared).using("userId").select("userId"),
      "select userId from left_keys full join shared_nullable using(userId)",
    )
  })
})

test("mapped projections decode under aliases and preserve outer and stored nulls", async () => {
  const rows = await db.users
    .leftJoin(posts)
    .on(users.id, "=", posts.userId)
    .select(
      users.name,
      posts.published.as("visible"),
      posts.createdAt.as("created"),
      posts.date.as("date"),
      posts.payload.as("data"),
    )
    .orderBy([[users.id, "asc"]])
    .fetch()
  expect(rows).toEqual([
    {
      name: "Wyatt",
      visible: true,
      created: new Date(1000),
      date: new Date("2024-01-01"),
      data: { ok: true },
    },
    {
      name: "Doc",
      visible: false,
      created: new Date(2000),
      date: null,
      data: { ok: false },
    },
    { name: "Jane", visible: null, created: null, date: null, data: null },
  ])
})

test("filters use the identified joined source's storage mapping", async () => {
  await matches(
    db.users
      .join(posts)
      .on(users.id, "=", posts.userId)
      .select(posts.title)
      .where(posts.createdAt, new Date(1000))
      .where("posts.published", true)
      .where(posts.payload, { ok: true }),
    "select posts.title from users join posts on users.id = posts.userId where posts.createdAt = 1000 and posts.published = 1 and posts.payload = '{\"ok\":true}'",
  )
})

test("incompatible mapped collisions remain undecoded", async () => {
  await matches(
    db.users.join(profiles).select(users.active, profiles.active),
    "select users.active, profiles.active from users join profiles",
  )
})

test("distinct mapped aliases preserve both decoded values", async () => {
  const row = await db.users
    .join(profiles)
    .select(users.active.as("userActive"), profiles.active.as("profileActive"))
    .first()
  expect(row).toEqual({ userActive: true, profileActive: { enabled: true } })
})

test("aliased and anonymous subqueries snapshot filters and preserve mappings", async () => {
  const filtered = db.posts
    .select("userId", "title", posts.published.as("visible"))
    .where("published", true)
  const published = filtered.as("publishedPosts")
  const embedded = db.users
    .leftJoin(published)
    .on(users.id, "=", published.userId)
    .select(users.name, published.title, published.visible)
  const anonymous = db.users
    .join(filtered)
    .on("users.id", "=", "userId")
    .select("title", "visible")
  filtered
    .where("title", "Orphan")
    .limit(1)
    .orderBy([["title", "desc"]])
  expect(await embedded.fetch()).toEqual([
    { name: "Wyatt", title: "Hello", visible: true },
    { name: "Doc", title: null, visible: null },
    { name: "Jane", title: null, visible: null },
  ])
  expect(await anonymous.fetch()).toEqual([{ title: "Hello", visible: true }])
  expect(sqlOf(anonymous)).not.toMatch(/\)\s+as /i)
  expect(sqlOf(embedded)).toContain(") as `publishedPosts`")
  expect(published.as("renamed").title.table).toBe("renamed")
  expect(published.title.table).toBe("publishedPosts")
})

test("nested subqueries decode a custom mapping only once", async () => {
  let decodes = 0
  const mapped = createTable("mapped_source", {
    id: integer.notNull,
    value: integer.map({
      to: (value: { amount: number }) => value.amount,
      from: (value: number) => {
        decodes++
        return { amount: value }
      },
    }).notNull,
  })
  sqlite.run(generateCreateTable(mapped.$meta))
  sqlite.run("insert into mapped_source values(1, 12)")
  const mappedDb = createDatabase(connection, createSchema({ mapped }))
  const first = mappedDb.mapped.select("id", "value").as("firstSub")
  const second = db.users
    .join(first)
    .on(users.id, "=", first.id)
    .select(first.value.as("amount"))
    .as("secondSub")
  expect(
    await db.users.join(second).select(second.amount).limit(1).fetch(),
  ).toEqual([{ amount: { amount: 12 } }])
  expect(decodes).toBe(1)
})

test("embedded joined queries snapshot subsequent WHERE, ordering and pagination changes", async () => {
  const original = db.users
    .join(posts)
    .on(users.id, "=", posts.userId)
    .select(users.id.as("owner"), posts.title)
    .where(posts.published, true)
    .orderBy([[posts.title, "asc"]])
  const frozen = original.as("frozen")
  const query = db.users
    .join(frozen)
    .on(users.id, "=", frozen.owner)
    .select(frozen.title)
  original
    .where("posts.title", "Missing")
    .orderBy([[users.name, "desc"]])
    .offset(1)
    .limit(0)
  expect(await query.fetch()).toEqual([{ title: "Hello" }])
})

test("literal dots and quote characters are escaped as identifier components", async () => {
  const dotted = createTable("odd.table", {
    "a.b": text.notNull,
    "tick`name": text.notNull,
  })
  sqlite.run(
    "create table `odd.table` (`a.b` text not null, `tick``name` text not null)",
  )
  sqlite.run("insert into `odd.table` values('dot', 'tick')")
  const dottedDb = createDatabase(connection, createSchema({ dotted }))
  expect(
    await dottedDb.dotted
      .select("a.b", dotted["tick`name"])
      .where("a.b", "dot")
      .fetch(),
  ).toEqual([{ "a.b": "dot", "tick`name": "tick" }])
})

test("fetch submits one SELECT without validation queries", async () => {
  await db.users
    .join(posts)
    .on(users.id, "=", posts.userId)
    .select("name", "title")
    .fetch()
  expect(statements).toHaveLength(1)
  expect(statements[0]).toStartWith("select ")
})

test("SQLite ambiguity errors propagate unchanged", async () => {
  await expect(
    db.users.join(posts).select("name").where("id", 1).fetch(),
  ).rejects.toThrow("ambiguous column name: id")
  expect(statements).toHaveLength(1)
})

test("connection errors propagate without capability probes", async () => {
  const failure = new Error("unsupported right join")
  let queries = 0
  const errors = createDatabase(
    {
      async query() {
        queries++
        throw failure
      },
      async script() {},
    },
    schema,
  )
  try {
    await errors.users.rightJoin(posts).select(users.name).fetch()
    throw new Error("Expected connection error")
  } catch (error) {
    expect(error).toBe(failure)
  }
  expect(queries).toBe(1)
})

test("completed SELECTs do not inherit join methods", () => {
  expect("join" in db.users.select("*")).toBe(false)
  expect("join" in users.select("*")).toBe(false)
})

test("single-table SELECT and CRUD chains still execute", async () => {
  expect(await db.users.select("id", "name").where("id", 1).first()).toEqual({
    id: 1,
    name: "Wyatt",
  })
  await db.users.update({ name: "Doc updated" }).where("id", 2).execute()
  expect((await db.users.select("name").where("id", 2).first()).name).toBe(
    "Doc updated",
  )
  await db.users
    .insert({ id: 9, name: "Temporary", managerId: null, active: false })
    .execute()
  await db.users.delete().where("id", 9).execute()
  expect(await db.users.select("id").where("id", 9).fetch()).toEqual([])
})

test("column refs cannot overwrite internal source state", async () => {
  const internal = createTable("internal_names", {
    id: integer.notNull,
    query: text.notNull,
    connection: text.notNull,
    addJoin: text.notNull,
  })
  sqlite.run(generateCreateTable(internal.$meta))
  sqlite.run(
    "insert into internal_names values(1, 'query', 'connection', 'join')",
  )
  const internalDb = createDatabase(connection, createSchema({ internal }))
  expect(await internalDb.internal.select("*").fetch()).toEqual([
    { id: 1, query: "query", connection: "connection", addJoin: "join" },
  ])
  const alias = internal.as("internalAlias")
  await matches(
    db.users.join(alias).on(users.id, "=", alias.id).select(alias.query),
    "select internalAlias.query from users join internal_names as internalAlias on users.id = internalAlias.id",
  )
  const view = createView(
    "internal_view",
    internal.join(users).on(internal.id, "=", users.id).select(internal.query),
  )
  expect(view.$meta.sql).toContain("`internal_names`.`query`")
})

test("joined views expose projected metadata and converge through Cowboy", async () => {
  const view = createView(
    "joined_view",
    users
      .leftJoin(posts)
      .on(users.id, "=", posts.userId)
      .select(users.name.as("userName"), posts.published.as("visible")),
  )
  expect(
    view.$tableData.columns.map((column) => [column.name, column.notNull]),
  ).toEqual([
    ["userName", true],
    ["visible", false],
  ])
  const managedSqlite = new Database(":memory:")
  try {
    const raw = new BunConnection(managedSqlite)
    const managedSchema = createSchema({ users, posts, view })
    const managed = createDatabase(
      new CowboyConnection(raw, managedSchema),
      managedSchema,
    )
    await managed.users
      .insert({ id: 1, name: "View user", managerId: null, active: true })
      .execute()
    expect(await managed.view.select("*").fetch()).toEqual([
      { userName: "View user", visible: null },
    ])
    await managed.posts
      .insert({
        id: 1,
        userId: 1,
        title: "View post",
        published: true,
        createdAt: new Date(1),
        date: new Date(0),
        payload: { ok: true },
      })
      .execute()
    expect(await managed.view.select("*").fetch()).toEqual([
      { userName: "View user", visible: true },
    ])
    const converged = createDatabase(
      new CowboyConnection(raw, managedSchema),
      managedSchema,
    )
    expect(await converged.view.select("*").fetch()).toEqual([
      { userName: "View user", visible: true },
    ])
    expect(
      await converged.view
        .join(users)
        .on(view.userName, "=", users.name)
        .select(view.visible)
        .fetch(),
    ).toEqual([{ visible: true }])
    const replacement = createView(
      "joined_view",
      users
        .leftJoin(posts)
        .on(users.id, "=", posts.userId)
        .select(users.name.as("userName"), posts.title),
    )
    const changedSchema = createSchema({ users, posts, view: replacement })
    const changed = createDatabase(
      new CowboyConnection(raw, changedSchema),
      changedSchema,
    )
    expect(await changed.view.select("userName", "title").fetch()).toEqual([
      { userName: "View user", title: "View post" },
    ])
    expect(managedSqlite.prepare("select * from joined_view").all()).toEqual([
      { userName: "View user", title: "View post" },
    ])
    const changedAgain = createDatabase(
      new CowboyConnection(raw, changedSchema),
      changedSchema,
    )
    expect(await changedAgain.view.select("userName", "title").fetch()).toEqual(
      [{ userName: "View user", title: "View post" }],
    )
  } finally {
    managedSqlite.close()
  }
})

async function matches(query: { fetch(): Promise<unknown[]> }, sql: string) {
  expect(await query.fetch()).toEqual(sqlite.query(sql).all())
}

function sqlOf(query: unknown) {
  return generateSelect((query as SelectQueryBuilder).query)
}
