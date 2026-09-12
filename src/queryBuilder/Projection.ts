import type { ColumnRef } from "../schemaBuilder/ColumnRef"
import type { ColumnData } from "../schemaBuilder/metadata"
import type { ColumnIdentifier, SelectQuery } from "./queryBuilders.types"
import { Source } from "./Source"

export type Projection = "*" | { column: ColumnIdentifier; alias?: string } | ColumnRef.Wildcard

export namespace Projection {
  export type Input = "*" | string | ColumnRef | ColumnRef.Aliased<string, string, string> | ColumnRef.Wildcard

  export function create(scope: Source.Scope, input: Input): Projection {
    if (input === "*") return input
    if (typeof input === "object" && "wildcard" in input) return { ...input }
    return {
      column: Source.identifier(scope, input),
      ...(typeof input === "object" && "alias" in input ? { alias: input.alias } : {}),
    }
  }

  export function columns(query: SelectQuery): ColumnData[] {
    const scope = Source.scope(query)
    const selected = query.selected.flatMap(projection => {
      if (projection === "*") return scope.output
      if ("wildcard" in projection) return scope.sources.filter(source => Source.qualifier(source) === projection.table).flatMap(source => source.tableData.columns)
      return Source.resolve(scope, projection.column).map(column => ({ ...column, name: projection.alias ?? column.name }))
    })
    const outputs = new Map<string, ColumnData[]>()
    for (const column of selected) {
      const existing = outputs.get(column.name)
      if (existing) existing.push(column)
      else outputs.set(column.name, [column])
    }
    return Array.from(outputs.values(), merge)
  }

  export function merge(columns: ColumnData[]): ColumnData {
    const first = columns[0]
    return {
      ...first,
      notNull: columns.every(column => column.notNull || !!column.primaryKey),
      primaryKey: undefined,
      mapping: columns.every(column => column.mapping === first.mapping) ? first.mapping : undefined,
    }
  }
}
