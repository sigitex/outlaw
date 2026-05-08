import type { ColumnRef, IndexData } from "./metadata"
import type { BuildIndex } from "./schemaBuilder.types"

export function createIndex(name: string): IndexOn {
  return {
    on(...columns: ColumnRef[]) {
      return finalize(name, columns, false)
    },
  }
}

export function createUniqueIndex(name: string): IndexOn {
  return {
    on(...columns: ColumnRef[]) {
      return finalize(name, columns, true)
    },
  }
}

type IndexOn = {
  on(...columns: ColumnRef[]): BuildIndex
}

function finalize(name: string, columns: ColumnRef[], unique: boolean): BuildIndex {
  const $meta: IndexData = {
    kind: "index",
    name,
    table: columns[0].table,
    columns: columns.map(c => c.column),
    unique,
  }
  return { $kind: "index", $meta }
}
