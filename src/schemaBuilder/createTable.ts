import type { ColumnData, TableData } from "./metadata"
import type {
  BuildColumns,
  BuildColumnInner,
  BuildTable,
} from "./schemaBuilder.types"
import { Source } from "../queryBuilder/Source"

export function createTable<Columns extends BuildColumns, Name extends string>(
  name: Name,
  defineColumns: Columns,
): BuildTable<Columns, Name> {
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
  const defineTable = Object.assign(Source.create({ kind: "table", name, tableData: $meta }), {
    $kind: "table" as const, $meta, by, primaryKey, unique, check,
  }) as unknown as BuildTable<Columns, Name>
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
