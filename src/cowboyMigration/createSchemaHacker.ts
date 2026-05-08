import type { SchemaHack } from "./cowboyMigration.types"

export type SchemaHacker = ReturnType<typeof createSchemaHacker>

export function createSchemaHacker() {
  const hacks: SchemaHack[] = []
  return {
    get hacks() {
      return hacks
    },
    renamed: {
      table(fromTable: string, toTable: string) {
        hacks.push({ type: "renamedTable", fromTable, toTable })
      },
      column(fromTable: string, fromColumn: string, toColumn: string) {
        hacks.push({ type: "renamedColumn", fromTable, fromColumn, toColumn })
      },
    },
    dropped: {
      table(tableName: string) {
        hacks.push({ type: "droppedTable", tableName })
      },
      column(tableName: string, columnName: string) {
        hacks.push({ type: "droppedColumn", tableName, columnName })
      },
    },
  }
}
