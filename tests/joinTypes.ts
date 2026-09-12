import {
  createDatabase,
  createSchema,
  createTable,
  createView,
  integer,
  text,
  type Connection,
  type InferTable,
} from "../src"

export function joinTypes(connection: Connection) {
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
  const db = createDatabase(
    connection,
    createSchema({ users, posts, profiles }),
  )
  const managers = users.as("managers")
  type Literal = Assert<Equal<typeof users.id.table, "users">>
  type Alias = Assert<Equal<typeof managers.id.table, "managers">>
  type ProjectionAlias = Assert<
    Equal<ReturnType<typeof users.id.as<"userId">>["alias"], "userId">
  >
  type Inferred = Assert<Equal<InferTable<typeof users>["id"], number>>
  const single = db.users.select("id", "name").where("name", "Wyatt")
  type Single = Assert<Equal<Row<typeof single>, { id: number; name: string }>>
  const joined = db.users
    .join(posts)
    .on("users.id", "=", "posts.userId")
    .select("name", "title")
    .where("title", "Hello")
    .orderBy([["name", "asc"]])
    .limit(20)
    .offset(40)
  type Joined = Assert<
    Equal<Row<typeof joined>, { name: string; title: string }>
  >
  const mixed = db.users
    .join(posts)
    .on("users.id", "=", posts.userId)
    .select(users.all, posts.title)
  type Mixed = Assert<
    Equal<
      Row<typeof mixed>,
      {
        id: number
        name: string
        managerId: number | null
        active: boolean
        title: string
      }
    >
  >
  const left = db.users
    .leftJoin(posts)
    .on(users.id, "=", posts.userId)
    .select(
      users.name,
      posts.title,
      posts.createdAt.as("created"),
      posts.published,
      posts.date,
      posts.payload,
    )
  type Left = Assert<
    Equal<
      Row<typeof left>,
      {
        name: string
        title: string | null
        created: Date | null
        published: boolean | null
        date: Date | null
        payload: { ok: boolean } | null
      }
    >
  >
  const right = db.users
    .join(posts)
    .rightJoin(profiles)
    .select(users.name, posts.title, profiles.id.as("profileId"))
  type Right = Assert<
    Equal<
      Row<typeof right>,
      { name: string | null; title: string | null; profileId: string }
    >
  >
  const full = db.users.fullJoin(posts).select(users.name, posts.title)
  type Full = Assert<
    Equal<Row<typeof full>, { name: string | null; title: string | null }>
  >
  const self = db.users
    .leftJoin(managers)
    .on(users.managerId, "=", managers.id)
    .select(users.name.as("employee"), managers.name.as("manager"))
  type Self = Assert<
    Equal<Row<typeof self>, { employee: string; manager: string | null }>
  >
  const duplicates = db.users.join(profiles).select(users.id, profiles.id)
  type Duplicates = Assert<
    Equal<Row<typeof duplicates>, { id: number | string }>
  >
  const mappedDuplicates = db.users
    .join(profiles)
    .select(users.active, profiles.active)
  type MappedDuplicates = Assert<
    Equal<Row<typeof mappedDuplicates>, { active: unknown }>
  >
  const distinct = db.users
    .join(profiles)
    .select(users.active.as("userActive"), profiles.active.as("profileActive"))
  type Distinct = Assert<
    Equal<
      Row<typeof distinct>,
      { userActive: boolean; profileActive: { enabled: boolean } }
    >
  >
  const repeated = db.users.select(users.active, users.active)
  type Repeated = Assert<Equal<Row<typeof repeated>, { active: boolean }>>
  const sharedRight = db.posts
    .rightJoin(profiles)
    .using("userId")
    .select(
      "userId",
      posts.userId.as("leftKey"),
      profiles.userId.as("rightKey"),
    )
  type SharedRight = Assert<
    Equal<
      Row<typeof sharedRight>,
      { userId: number; leftKey: number | null; rightKey: number }
    >
  >
  const sharedFull = db.posts
    .fullJoin(profiles)
    .using("userId")
    .select("userId")
  type SharedFull = Assert<Equal<Row<typeof sharedFull>, { userId: number }>>
  const sharedLeft = db.posts
    .leftJoin(profiles)
    .using("userId")
    .select("userId")
  type SharedLeft = Assert<Equal<Row<typeof sharedLeft>, { userId: number }>>
  const sharedInner = db.posts.join(profiles).using("userId").select("userId")
  type SharedInner = Assert<Equal<Row<typeof sharedInner>, { userId: number }>>
  db.posts.crossJoin(profiles).using("userId", "id").select("*")
  db.users
    .crossJoin(posts)
    .on(users.id, "=", posts.userId)
    .on("name", "!=", "title")
    .select("*")
  db.users.join(posts).select("*")
  const subquery = db.posts
    .select("userId", "title", posts.published.as("visible"))
    .where("published", true)
  const published = subquery.as("publishedPosts")
  const sub = db.users
    .join(published)
    .on(users.id, "=", published.userId)
    .select(published.title, published.visible)
  type Sub = Assert<Equal<Row<typeof sub>, { title: string; visible: boolean }>>
  const anonymous = db.users
    .join(subquery)
    .on("users.id", "=", "userId")
    .select("title", "visible")
  type Anonymous = Assert<
    Equal<Row<typeof anonymous>, { title: string; visible: boolean }>
  >
  const view = createView(
    "joined_view",
    users
      .leftJoin(posts)
      .on(users.id, "=", posts.userId)
      .select(users.name.as("userName"), posts.published),
  )
  const viewDb = createDatabase(
    connection,
    createSchema({ users, posts, view }),
  )
  const viewRows = viewDb.view.select("*")
  type ViewRows = Assert<
    Equal<Row<typeof viewRows>, { userName: string; published: boolean | null }>
  >
  viewDb.view
    .join(users)
    .on(view.userName, "=", users.name)
    .select(view.published)
  db.users
    .join(posts)
    .select("name")
    .where(posts.published, true)
    .where("posts.createdAt", new Date())
    .orderBy([[posts.createdAt, "desc"]])
  db.users.select(users.id.as("userId")).orderBy([["userId", "desc"]])
  db.users.insert({ name: "Wyatt", active: true })
  db.users.update({ active: false }).where("id", 1)
  db.users.delete().where("name", "Wyatt")
  const dotted = createTable("dots", { "a.b": text.notNull })
  const dottedDb = createDatabase(connection, createSchema({ dotted }))
  const dottedRows = dottedDb.dotted.select("a.b")
  type Dotted = Assert<Equal<Row<typeof dottedRows>, { "a.b": string }>>

  // @ts-expect-error joins must precede executable SELECT
  db.users.select("*").join(posts)
  // @ts-expect-error joins must precede schema-level SELECT
  users.select("*").join(posts)
  // @ts-expect-error schema-level SELECT cannot execute
  users.select("*").fetch()
  // @ts-expect-error nonexistent column
  db.users.select("missing")
  // @ts-expect-error projection source is out of scope
  db.users.join(posts).select(profiles.id)
  // @ts-expect-error ON source is out of scope
  db.users.join(posts).on(profiles.id, "=", posts.id)
  // @ts-expect-error nonexistent qualified ON column
  db.users.join(posts).on("users.id", "=", "posts.missing")
  // @ts-expect-error USING requires common column names
  db.users.join(posts).using("name")
  // @ts-expect-error USING requires at least one column
  db.users.join(posts).using()
  // @ts-expect-error ON and USING are mutually exclusive
  db.users.join(posts).on(users.id, "=", posts.id).using("id")
  // @ts-expect-error USING and ON are mutually exclusive
  db.users.join(posts).using("id").on(users.id, "=", posts.id)
  // @ts-expect-error mapped boolean filters reject storage numbers
  db.users.join(posts).select("name").where(posts.published, 1)
  // @ts-expect-error string filters reject numbers
  db.users.select("name").where("name", 5)
  // @ts-expect-error mapped timestamp filters require Date
  db.users.join(posts).select("name").where("posts.createdAt", "yesterday")
  db.users
    .join(posts)
    .select("name")
    // @ts-expect-error ordering source is out of scope
    .orderBy([[profiles.id, "asc"]])
  // @ts-expect-error subqueries do not expose unprojected columns
  published.published.as("missing")
  // @ts-expect-error qualified subquery identifiers use projected names
  db.users.join(published).select("publishedPosts.published")
  // @ts-expect-error the original source is not in the outer query
  db.users.join(subquery).select(posts.title)
  // @ts-expect-error views expose only projected outputs
  viewDb.view.select("id")
  // @ts-expect-error joined SELECT does not expose CRUD methods
  db.users.join(posts).select("name").insert({ name: "x" })
  // @ts-expect-error ON right operands are columns, not literals
  db.users.join(posts).on(users.id, "=", true)
  // @ts-expect-error unrelated source is not introduced by an alias
  db.users.join(managers).select(posts.id)

  const sharedNullable = createTable("shared_nullable", {
    userId: integer,
    marker: text.notNull,
  })
  const nullableFull = db.posts
    .fullJoin(sharedNullable)
    .using("userId")
    .select("userId")
  type NullableFull = Assert<
    Equal<Row<typeof nullableFull>, { userId: number | null }>
  >
  const commonStar = db.posts
    .fullJoin(sharedNullable)
    .using("userId")
    .select("*")
  type CommonStar = Assert<
    Equal<Row<typeof commonStar>["userId"], number | null>
  >
  type CommonStarMarker = Assert<
    Equal<Row<typeof commonStar>["marker"], string | null>
  >
  const sharedThird = profiles.as("sharedThird")
  const commonRight = db.posts
    .fullJoin(sharedNullable)
    .using("userId")
    .rightJoin(sharedThird)
    .using("userId")
    .select("userId", posts.title)
  type CommonRight = Assert<
    Equal<Row<typeof commonRight>, { userId: number; title: string | null }>
  >
  const optionalKey = db.users
    .leftJoin(posts)
    .on(users.id, "=", posts.userId)
    .select(posts.id)
  type RequiredKey = Assert<
    Equal<Row<typeof optionalKey>, { id: number | null }>
  >
  const internalNames = createTable("internal", {
    query: text.notNull,
    connection: integer.notNull,
  })
  const internalView = createView(
    "internal_view",
    internalNames.select("query"),
  )
  const internalDb = createDatabase(connection, createSchema({ internalView }))
  const internalRows = internalDb.internalView.select("*")
  type InternalRows = Assert<Equal<Row<typeof internalRows>, { query: string }>>

  type Checks = [
    Literal,
    Alias,
    ProjectionAlias,
    Inferred,
    Single,
    Joined,
    Mixed,
    Left,
    Right,
    Full,
    Self,
    Duplicates,
    MappedDuplicates,
    Distinct,
    Repeated,
    SharedRight,
    SharedFull,
    SharedLeft,
    SharedInner,
    Sub,
    Anonymous,
    ViewRows,
    Dotted,
    NullableFull,
    CommonStar,
    CommonStarMarker,
    CommonRight,
    RequiredKey,
    InternalRows,
  ]
  return true satisfies Checks[number]
}

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false
type Assert<Value extends true> = Value
type Row<Query extends { fetch(): unknown }> =
  Awaited<ReturnType<Query["fetch"]>> extends (infer Value)[] ? Value : never
