import type { ColumnRef } from "../schemaBuilder/ColumnRef"
import type { ColumnData } from "../schemaBuilder/metadata"
import type { ColumnIdentifier, SelectQuery } from "./queryBuilders.types"
import { QuerySource } from "./QuerySource"

export type Projection =
  | "*"
  | { column: ColumnIdentifier; alias?: string }
  | ColumnRef.Wildcard

export namespace Projection {
  export type Input =
    | "*"
    | string
    | ColumnRef
    | ColumnRef.Aliased<string, string, string>
    | ColumnRef.Wildcard

  export function create(scope: QuerySource.Scope, input: Input): Projection {
    if (input === "*") {
      return input
    }
    if (typeof input === "object" && "wildcard" in input) {
      return { ...input }
    }
    const column = QuerySource.identifier(scope, input)
    const alias =
      typeof input === "object" && "alias" in input
        ? input.alias
        : column.table === undefined && scope.coalesced.has(column.column)
          ? column.column
          : undefined
    return {
      column,
      ...(alias !== undefined ? { alias } : {}),
    }
  }

  export function columns(query: SelectQuery): ColumnData[] {
    const scope = QuerySource.scope(query)
    const selected = query.selected.flatMap((projection) => {
      if (projection === "*") {
        return scope.output
      }
      if ("wildcard" in projection) {
        return scope.sources
          .filter(
            (source) => QuerySource.qualifier(source) === projection.table,
          )
          .flatMap((source) => source.tableData.columns)
      }
      return QuerySource.resolve(scope, projection.column).map((column) =>
        renameColumn(column, projection.alias ?? column.name),
      )
    })
    const outputs = new Map<string, ColumnData[]>()
    for (const column of selected) {
      const existing = outputs.get(column.name)
      if (existing) {
        existing.push(column)
      } else {
        outputs.set(column.name, [column])
      }
    }
    return Array.from(outputs.values(), merge)
  }

  export function merge(columns: ColumnData[]): ColumnData {
    const first = columns[0]
    return {
      ...first,
      notNull: columns.every((column) => column.notNull || !!column.primaryKey),
      primaryKey: undefined,
      mapping: columns.every((column) => column.mapping === first.mapping)
        ? first.mapping
        : undefined,
    }
  }

  function renameColumn(column: ColumnData, name: string): ColumnData {
    return { ...column, name }
  }
}
