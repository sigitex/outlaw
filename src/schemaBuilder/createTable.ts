import type { ColumnData, ColumnRef, TableData } from "./metadata"
import type {
  BuildColumns,
  BuildColumnInner,
  BuildTable,
} from "./schemaBuilder.types"
import { SelectQueryBuilder } from "../queryBuilder/SelectQueryBuilder"

export function createTable<Columns extends BuildColumns>(
  name: string,
  defineColumns: Columns,
): BuildTable<Columns> {
  const columns = Object.entries(defineColumns).map<ColumnData>(
    ([name, define]) => {
      const meta = (define as BuildColumnInner).$meta
      return {
        name,
        datatype: meta.datatype!,
        default: meta.default,
        foreignKey: meta.foreignKey,
        notNull: !!meta.notNull,
        primaryKey: meta.primaryKey,
        unique: !!meta.unique,
        mapping: meta.mapping,
        check: meta.check,
      }
    },
  )
  const $meta: TableData = {
    name,
    columns,
    constraints: [],
  }
  const by = new Proxy({}, {
    get(_, col: string) {
      return (value: unknown) => ({
        _tag: "RefBy" as const,
        table: defineTable,
        column: col,
        value,
      })
    },
  })
  function select(...columns: ("*" | string)[]) {
    if (columns[0] === "*" || columns.length === 0) {
      return new SelectQueryBuilder($meta, "*")
    }
    return new SelectQueryBuilder($meta, columns)
  }
  const defineTable = { $kind: "table" as const, $meta, by, primaryKey, unique, check, select } as unknown as BuildTable<Columns>
  for (const col of Object.keys(defineColumns)) {
    // oxlint-disable-next-line typescript/no-explicit-any
    ;(defineTable as any)[col] = { table: name, column: col } satisfies ColumnRef
  }
  return defineTable

  function primaryKey(...columns: (keyof Columns)[]) {
    $meta.constraints.push({
      type: "primaryKey",
      columns: columns as string[],
    })
    return defineTable
  }

  function unique(...columns: (keyof Columns)[]) {
    $meta.constraints.push({
      type: "unique",
      columns: columns as string[],
    })
    return defineTable
  }

  function check(expression: string | ((columns: Record<string, string>, table: TableData) => string)) {
    $meta.constraints.push({
      type: "check",
      expression,
    })
    return defineTable
  }
}
