import { newline, print } from "@sigitex/print"
import type { Connection } from "../api"
import { Format } from "../framework"
import { Reflector } from "../reflection"
import type {
  BuildTable,
  BuildView,
  IndexData,
  SchemaMembers,
  Schema,
  TableData,
  ViewData,
} from "../schemaBuilder"
import { generateCreateTable } from "../schemaGenerator"
import { generateCreateIndex } from "../schemaGenerator/generateCreateIndex"
import { generateCreateView } from "../schemaGenerator/generateCreateView"
import { Compare } from "./Compare"
import type { SchemaHack } from "./cowboyMigration.types"

type Migratable = TableData | ViewData | IndexData
type MigratableType = "table" | "view" | "index"

const MIGRATION_TABLE = "cowboy_migration"

export class CowboyMigrator {
  private readonly connection: Connection
  private readonly schema: Schema<SchemaMembers>
  private readonly hacks: SchemaHack[]
  private readonly reflect: Reflector

  constructor(
    connection: Connection,
    schema: Schema<SchemaMembers>,
    hacks: SchemaHack[],
  ) {
    this.connection = connection
    this.schema = schema
    this.hacks = hacks
    this.reflect = new Reflector(connection)
  }

  async migrate() {
    console.log("🤠 checking for migrations")

    const hasMigrationTable = await this.reflect.hasTable(MIGRATION_TABLE)
    if (!hasMigrationTable) {
      await this.connection.script([
        "PRAGMA defer_foreign_keys = on",
        createMigrationTable(),
      ])
      this.reflect.invalidate()
    }

    // phase 1: execute hacks
    await this.executeHacks()

    // phase 2: schema convergence
    const statements: string[] = ["PRAGMA defer_foreign_keys = on"]
    for (const { $meta: table } of Object.values<BuildTable<unknown>>(
      this.schema.tables,
    )) {
      const isMissingTable = await this.reflect.isMissingTable(table.name)
      if (isMissingTable) {
        console.log(`🤠 creating table: ${table.name}`)
        statements.push(generateCreateTable(table).trim())
        statements.push(insertMigration("table", table))
      } else {
        const oldTable = await this.getTableData(table.name)
        const equal = Compare.table(oldTable, table)
        if (!equal) {
          const migration = migrateTable(oldTable, table, this.hacks)
          if (migration.length > 0) {
            console.log(`🤠 migrating table: ${table.name}`)
            statements.push(...migration)
            statements.push(updateMigration("table", table))
          }
        }
      }
    }
    if (statements.length > 1) {
      await this.connection.script(statements)
      this.reflect.invalidate()
    }

    // phase 3: views and indexes (after tables are converged)
    await this.convergeViewsAndIndexes()
  }

  private async convergeViewsAndIndexes() {
    const statements: string[] = []

    // Collect current schema view/index names for stale detection
    const schemaViewNames = new Set<string>()
    const schemaIndexNames = new Set<string>()

    // Views
    for (const member of Object.values(this.schema.views)) {
      const view = (member as BuildView).$meta
      schemaViewNames.add(view.name)
      const exists = await this.hasMigration(view.name)
      if (!exists) {
        console.log(`🤠 creating view: ${view.name}`)
        statements.push(generateCreateView(view).trim())
        statements.push(insertMigration("view", view))
      } else {
        const oldData = await this.getMigrationData(view.name)
        if (oldData !== JSON.stringify(view)) {
          console.log(`🤠 recreating view: ${view.name}`)
          statements.push(
            print(["drop view if exists ", Format.name(view.name)]),
          )
          statements.push(generateCreateView(view).trim())
          statements.push(updateMigration("view", view))
        }
      }
    }

    // Indexes
    for (const member of Object.values(this.schema.indexes)) {
      const index = (member as { $meta: IndexData }).$meta
      schemaIndexNames.add(index.name)
      const exists = await this.hasMigration(index.name)
      if (!exists) {
        console.log(`🤠 creating index: ${index.name}`)
        statements.push(generateCreateIndex(index).trim())
        statements.push(insertMigration("index", index))
      } else {
        const oldData = await this.getMigrationData(index.name)
        if (oldData !== JSON.stringify(index)) {
          console.log(`🤠 recreating index: ${index.name}`)
          statements.push(
            print(["drop index if exists ", Format.name(index.name)]),
          )
          statements.push(generateCreateIndex(index).trim())
          statements.push(updateMigration("index", index))
        }
      }
    }

    // Drop stale views/indexes that are tracked but no longer in schema
    const tracked = await this.getTrackedNonTables()
    for (const { name, type } of tracked) {
      if (type === "view" && !schemaViewNames.has(name)) {
        console.log(`🤠 dropping stale view: ${name}`)
        statements.push(print(["drop view if exists ", Format.name(name)]))
        statements.push(deleteMigration(name))
      }
      if (type === "index" && !schemaIndexNames.has(name)) {
        console.log(`🤠 dropping stale index: ${name}`)
        statements.push(print(["drop index if exists ", Format.name(name)]))
        statements.push(deleteMigration(name))
      }
    }

    if (statements.length > 0) {
      await this.connection.script(statements)
    }
  }

  private async executeHacks() {
    if (this.hacks.length === 0) {
      return
    }

    const statements: string[] = ["PRAGMA defer_foreign_keys = on"]
    let dirty = false

    for (const hack of this.hacks) {
      switch (hack.type) {
        case "droppedTable": {
          if (await this.reflect.hasTable(hack.tableName)) {
            console.log(`🤠 dropping table: ${hack.tableName}`)
            statements.push(print(["drop table ", Format.name(hack.tableName)]))
            statements.push(deleteMigration(hack.tableName))
            dirty = true
          }
          break
        }
        case "renamedTable": {
          if (await this.reflect.hasTable(hack.fromTable)) {
            if (await this.reflect.hasTable(hack.toTable)) {
              // auto-recovery: previous hack-less migration created an empty
              // table under the new name — drop it so we can rename the old one
              console.log(`🤠 dropping stale table: ${hack.toTable}`)
              statements.push(print(["drop table ", Format.name(hack.toTable)]))
              statements.push(deleteMigration(hack.toTable))
            }
            console.log(
              `🤠 renaming table: ${hack.fromTable} → ${hack.toTable}`,
            )
            statements.push(
              print([
                "alter table ",
                Format.name(hack.fromTable),
                " rename to ",
                Format.name(hack.toTable),
              ]),
            )
            statements.push(renameMigration(hack.fromTable, hack.toTable))
            dirty = true
          }
          break
        }
        case "droppedColumn": {
          if (await this.reflect.hasTable(hack.tableName)) {
            const tableData = await this.getTableData(hack.tableName)
            const columnExists = tableData.columns.some(
              ({ name }) => name === hack.columnName,
            )
            if (columnExists) {
              console.log(
                `🤠 dropping column: ${hack.tableName}.${hack.columnName}`,
              )
              statements.push(
                print([
                  "alter table ",
                  Format.name(hack.tableName),
                  " drop column ",
                  Format.name(hack.columnName),
                ]),
              )
              const updated: TableData = {
                ...tableData,
                columns: tableData.columns.filter(
                  ({ name }) => name !== hack.columnName,
                ),
              }
              statements.push(updateMigration("table", updated))
              dirty = true
            }
          }
          break
        }
        case "renamedColumn": {
          if (await this.reflect.hasTable(hack.fromTable)) {
            const tableData = await this.getTableData(hack.fromTable)
            const columnExists = tableData.columns.some(
              ({ name }) => name === hack.fromColumn,
            )
            if (columnExists) {
              console.log(
                `🤠 renaming column: ${hack.fromTable}.${hack.fromColumn} → ${hack.toColumn}`,
              )
              statements.push(
                print([
                  "alter table ",
                  Format.name(hack.fromTable),
                  " rename column ",
                  Format.name(hack.fromColumn),
                  " to ",
                  Format.name(hack.toColumn),
                ]),
              )
              const updated: TableData = {
                ...tableData,
                columns: tableData.columns.map((col) =>
                  col.name === hack.fromColumn
                    ? { ...col, name: hack.toColumn }
                    : col,
                ),
              }
              statements.push(updateMigration("table", updated))
              dirty = true
            }
          }
          break
        }
      }
    }

    if (dirty) {
      await this.connection.script(statements)
      this.reflect.invalidate()
    }
  }

  private async getTableData(tableName: string) {
    const results = await this.connection.query<{ data: string }>(`
      select data from ${MIGRATION_TABLE}
      where name = ${Format.text(tableName)}
    `)
    return JSON.parse(results[0].data) as TableData
  }

  private async hasMigration(name: string) {
    const results = await this.connection.query<{ name: string }>(`
      select name from ${MIGRATION_TABLE}
      where name = ${Format.text(name)}
    `)
    return results.length > 0
  }

  private async getMigrationData(name: string) {
    const results = await this.connection.query<{ data: string }>(`
      select data from ${MIGRATION_TABLE}
      where name = ${Format.text(name)}
    `)
    return results[0]?.data
  }

  private async getTrackedNonTables() {
    return this.connection.query<{ name: string; type: string }>(`
      select name, type from ${MIGRATION_TABLE}
      where type != 'table'
    `)
  }
}

function createMigrationTable() {
  return `
    create table ${MIGRATION_TABLE} (
      id integer primary key autoincrement,
      timestamp integer not null,
      type string not null,
      name string not null unique,
      data string not null
    )
  `
}

function insertMigration(type: MigratableType, data: Migratable) {
  const json = JSON.stringify(data)
  return `
    insert into ${MIGRATION_TABLE} (
      timestamp,
      type,
      name,
      data
    )
    values (
      ${Format.NOW},
      '${type}',
      ${Format.text(data.name)},
      ${Format.text(json)}
    )
  `
}

function updateMigration(_type: MigratableType, data: Migratable) {
  const json = JSON.stringify(data)
  return `
    update ${MIGRATION_TABLE}
    set timestamp = ${Format.NOW},
        data = ${Format.text(json)}
    where name = ${Format.text(data.name)}
  `
}

function deleteMigration(tableName: string) {
  return `
    delete from ${MIGRATION_TABLE}
    where name = ${Format.text(tableName)}
  `
}

function renameMigration(fromName: string, toName: string) {
  return `
    update ${MIGRATION_TABLE}
    set timestamp = ${Format.NOW},
        name = ${Format.text(toName)}
    where name = ${Format.text(fromName)}
  `
}

function migrateTable(
  oldTable: TableData,
  newTable: TableData,
  hacks: SchemaHack[],
): string[] {
  const interimName = `__interim_${newTable.name}`
  const renames = hacks
    .filter((hack) => hack.type === "renamedColumn")
    .filter(({ fromTable }) => fromTable === newTable.name)
  // oxlint-disable-next-line unicorn/no-array-reduce
  const mappings = newTable.columns.reduce<{ from: string; to: string }[]>(
    (mappings, column) => {
      const oldColumnExists = oldTable.columns.some(
        ({ name }) => name === column.name,
      )
      const rename = renames.find((rename) => rename.toColumn === column.name)
      const renamesOldColumn =
        !!rename &&
        oldTable.columns.some(({ name }) => name === rename.fromColumn)
      if (!oldColumnExists && !renamesOldColumn) {
        return mappings
      }
      return [
        // biome-ignore lint/performance/noAccumulatingSpread: small n
        ...mappings,
        {
          from: renamesOldColumn ? rename.fromColumn : column.name,
          to: column.name,
        },
      ]
    },
    [],
  )
  const orphaned = oldTable.columns.filter((col) => {
    const isMapped = mappings.some((m) => m.from === col.name)
    const isDropped = hacks.some(
      (h) =>
        h.type === "droppedColumn" &&
        h.tableName === newTable.name &&
        h.columnName === col.name,
    )
    return !isMapped && !isDropped
  })
  if (orphaned.length > 0) {
    const names = orphaned.map((c) => c.name).join(", ")
    console.error(
      `🤠 refusing to migrate ${newTable.name}: columns [${names}] would be lost — add renamed.column() or dropped.column() hacks`,
    )
    return []
  }
  return [
    generateCreateTable({ ...newTable, name: interimName }).trim(),
    print([
      "insert into ",
      Format.name(interimName),
      " (",
      mappings.map((mapping, m) => [m > 0 && ", ", Format.name(mapping.to)]),
      ")",
      newline,
      "select ",
      mappings.map((mapping, m) => [m > 0 && ", ", Format.name(mapping.from)]),
      " from ",
      Format.name(oldTable.name),
    ]),
    print(["drop table ", Format.name(oldTable.name)]),
    print([
      "alter table ",
      Format.name(interimName),
      " rename to ",
      Format.name(newTable.name),
    ]),
  ]
}
