// oxlint-disable typescript/no-explicit-any
import type { CheckExpression, ColumnData, ColumnRef, MappingData } from "./metadata"
import { Mapping } from "./Mapping"
import type {
  BuildColumn,
  BuildColumnInner,
  BuildColumnMap,
  BuildPrimaryKey,
} from "./schemaBuilder.types"

export const text: BuildColumn<string, never> = composeColumn({
  datatype: "text",
})
export const integer: BuildColumn<number, never> = composeColumn({
  datatype: "integer",
})
export const real: BuildColumn<number, never> = composeColumn({
  datatype: "real",
})
export const blob: BuildColumn<ArrayBuffer, never> = composeColumn({
  datatype: "blob",
})

function composeColumn(
  $meta: Partial<ColumnData>,
): BuildColumnInner & BuildPrimaryKey<any, never> {
  return {
    $meta,
    get notNull() {
      return composeColumn({ ...$meta, notNull: true })
    },
    get primaryKey() {
      return composeColumn({ ...$meta, primaryKey: { autoincrement: false } })
    },
    get autoincrement() {
      return composeColumn({ ...$meta, primaryKey: { autoincrement: true } })
    },
    default(sql) {
      return composeColumn({ ...$meta, default: sql })
    },
    check(expression: CheckExpression) {
      return composeColumn({ ...$meta, check: expression })
    },
    get unique() {
      return composeColumn({ ...$meta, unique: true })
    },
    get foreignKey() {
      return {
        references(ref: ColumnRef) {
          return composeColumn({
            ...$meta,
            foreignKey: ref,
          })
        },
      }
    },
    get map(): BuildColumnMap<any, never> {
      const custom = (mapping?: MappingData) =>
        composeColumn(mapping ? { ...$meta, mapping } : $meta)
      custom.boolean = composeColumn({ ...$meta, mapping: Mapping.boolean })
      custom.timestamp = composeColumn({ ...$meta, mapping: Mapping.timestamp })
      custom.date = composeColumn({ ...$meta, mapping: Mapping.date })
      custom.json = () => composeColumn({ ...$meta, mapping: Mapping.json() })
      return custom as BuildColumnMap<any, never>
    },
  }
}
