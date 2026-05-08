// oxlint-disable typescript/no-explicit-any
import { join, print } from "@sigitex/print"
import stableStringify from "fast-json-stable-stringify"
import { createHash } from "node:crypto"
import type { Connection } from "../api"
import { Format } from "../framework"
import { Mappings } from "../queryBuilder/Mappings"
import { generateDelete, generateInsert } from "../queryGenerator"
import { Reflector } from "../reflection"
import { text } from "../schemaBuilder/columnBuilders"
import { Fixture, type Fixtures } from "../schemaBuilder/createFixture"
import { createTable } from "../schemaBuilder/createTable"
import type { RefBy } from "../schemaBuilder/schemaBuilder.types"
import { generateCreateTable } from "../schemaGenerator"

const SEED_TABLE = "cowboy_seed"

const seedTable = createTable(SEED_TABLE, {
  name: text.primaryKey,
  hash: text.notNull,
})

export class CowboySeeder {
  private readonly connection: Connection
  private readonly seeds: Fixtures
  private readonly fixtures: Fixtures
  private readonly runFixtures: boolean
  private readonly reflect: Reflector

  constructor(
    connection: Connection,
    seeds: Fixtures,
    fixtures: Fixtures,
    runFixtures: boolean,
  ) {
    this.connection = connection
    this.seeds = seeds
    this.fixtures = fixtures
    this.runFixtures = runFixtures
    this.reflect = new Reflector(connection)
  }

  async seed() {
    console.log("🌱 checking for seed changes")
    const statements: string[] = []

    const hasSeedTable = await this.reflect.hasTable(SEED_TABLE)
    if (!hasSeedTable) {
      statements.push(generateCreateTable(seedTable.$meta).trim())
    }

    const existingHashes = hasSeedTable
      ? await this.connection.query<{ name: string; hash: string }>(
          `select name, hash from ${SEED_TABLE}`,
        )
      : []

    const hashMap = new Map(existingHashes.map((r) => [r.name, r.hash]))
    const combined = this.combineByTable()

    for (const [tableName, { table, rows }] of combined) {
      const hash = computeHash(rows)
      const existing = hashMap.get(tableName)
      if (existing === hash) {
        continue
      }

      console.log(`🌱 reseeding: ${tableName}`)
      statements.push(...generateReseed(tableName, table, rows))
      statements.push(upsertHash(tableName, hash))
    }

    if (statements.length > 0) {
      statements.unshift("PRAGMA defer_foreign_keys = on")
      await this.connection.script(statements)
    }
  }

  private combineByTable() {
    const combined = new Map<
      string,
      { table: Fixture<any>["table"]; rows: Record<string, unknown>[] }
    >()
    const allFixtures = {
      ...this.seeds,
      ...(this.runFixtures ? this.fixtures : {}),
    }

    for (const fixture of Object.values(allFixtures)) {
      const tableName: string = fixture.table.$meta.name
      const existing = combined.get(tableName)
      if (existing) {
        existing.rows.push(...fixture.rows)
      } else {
        combined.set(tableName, {
          table: fixture.table,
          rows: [...fixture.rows],
        })
      }
    }
    return combined
  }
}

function computeHash(rows: Record<string, unknown>[]) {
  const sanitized = rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const key in row) {
      const value = row[key]
      if (Fixture.isRefBy(value)) {
        out[key] =
          `ref:${value.table.$meta.name}.${String(value.column)}=${value.value}`
      } else {
        out[key] = value
      }
    }
    return out
  })
  const serialized = stableStringify(sanitized)
  return createHash("sha256").update(serialized).digest("hex")
}

function generateReseed(
  tableName: string,
  table: Fixture<any>["table"],
  rows: Record<string, unknown>[],
): string[] {
  const tableData = table.$meta
  const autoincrementCol = tableData.columns.find(
    (c: any) => c.primaryKey?.autoincrement,
  )?.name

  const deleteSQL = generateDelete({ table: tableName }).trim()
  if (rows.length === 0) {
    return [deleteSQL]
  }

  const strippedRows = autoincrementCol
    ? rows.map((row) => stripAutoincrement(row, autoincrementCol))
    : rows

  const processedRows = strippedRows.map((row) => {
    const mapped: Record<string, unknown> = {}
    for (const key in row) {
      const value = row[key]
      if (Fixture.isRefBy(value)) {
        continue
      }
      mapped[key] = value
    }
    return Mappings.row(tableData, mapped)
  })

  const hasRefBy = strippedRows.some((row) =>
    Object.values(row).some(Fixture.isRefBy),
  )

  if (!hasRefBy) {
    const columns = Object.keys(strippedRows[0])
    const insertSQL = generateInsert({
      table: tableName,
      columns,
      rows: processedRows,
    }).trim()
    return [deleteSQL, insertSQL]
  }

  return [
    deleteSQL,
    ...generateRefByInserts(tableName, tableData, strippedRows),
  ]
}

function generateRefByInserts(
  tableName: string,
  tableData: Fixture<any>["table"]["$meta"],
  rows: Record<string, unknown>[],
): string[] {
  const statements: string[] = []
  for (const row of rows) {
    const columns: string[] = []
    const values: string[] = []

    for (const key in row) {
      columns.push(key)
      const value = row[key]
      if (Fixture.isRefBy(value)) {
        values.push(refBySubquery(value))
      } else {
        const mapped = Mappings.row(tableData, { [key]: value })
        values.push(Format.value(mapped[key]))
      }
    }

    statements.push(
      print([
        "insert into ",
        Format.name(tableName),
        " (",
        join(", ", columns, Format.name),
        ") values (",
        values.join(", "),
        ")",
      ]),
    )
  }
  return statements
}

function refBySubquery(ref: RefBy) {
  const refTableName = ref.table.$meta.name
  const pk = ref.table.$meta.columns.find((c: any) => c.primaryKey)
  const pkColumn = pk ? pk.name : "id"
  return print([
    "(select ",
    Format.name(pkColumn),
    " from ",
    Format.name(refTableName),
    " where ",
    Format.name(ref.column as string),
    " = ",
    Format.value(ref.value),
    ")",
  ])
}

function stripAutoincrement(row: Record<string, unknown>, col: string) {
  if (row[col] !== 0) {
    return row
  }
  const { [col]: _, ...rest } = row
  return rest
}

function upsertHash(tableName: string, hash: string) {
  return print([
    "insert or replace into ",
    SEED_TABLE,
    " (name, hash) values (",
    Format.text(tableName),
    ", ",
    Format.text(hash),
    ")",
  ])
}
