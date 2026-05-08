import type { MappingData, TableData } from "../schemaBuilder"

export namespace Mappings {
  export function row(
    table: TableData,
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    const mapped: Record<string, unknown> = {}
    for (const key in row) {
      const column = findColumn(table, key)
      mapped[key] = column?.mapping ? column.mapping.to(row[key]) : row[key]
    }
    return mapped
  }

  export function conditionValue(
    table: TableData,
    column: string,
    value: unknown,
  ): unknown {
    const col = findColumn(table, column)
    return col?.mapping ? col.mapping.to(value) : value
  }

  export function results(
    tables: TableData | TableData[],
    rows: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    const tableList = Array.isArray(tables) ? tables : [tables]
    const mappings = new Map<string, MappingData>()
    for (const table of tableList) {
      for (const col of table.columns) {
        if (col.mapping && !mappings.has(col.name)) {
          mappings.set(col.name, col.mapping)
        }
      }
    }
    if (mappings.size === 0) {
      return rows
    }
    return rows.map((row) => {
      const mapped: Record<string, unknown> = { ...row }
      for (const [name, mapping] of mappings) {
        if (name in mapped) {
          mapped[name] = mapping.from(mapped[name])
        }
      }
      return mapped
    })
  }
}

function findColumn(table: TableData, name: string) {
  return table.columns.find((c) => c.name === name)
}
