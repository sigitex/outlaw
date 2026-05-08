import type {
  ColumnData,
  TableCheckData,
  TableConstraintData,
  TableData,
} from "../schemaBuilder"

export namespace Compare {
  export function table(ta: TableData, tb: TableData) {
    if (ta.columns.length !== tb.columns.length) {
      return false
    }
    if (ta.constraints.length !== tb.constraints.length) {
      return false
    }
    for (let c = 0; c < ta.columns.length; c++) {
      const ca = ta.columns[c]
      const cb = tb.columns[c]
      const equals = columnEquals(ca, cb)
      if (!equals) {
        return false
      }
    }
    for (let c = 0; c < ta.constraints.length; c++) {
      const ca = ta.constraints[c]
      const cb = tb.constraints[c]
      const equals = constraintEquals(ca, cb, ta, tb)
      if (!equals) {
        return false
      }
    }
    return true
  }

  function columnEquals(a: ColumnData, b: ColumnData) {
    return (
      a.name === b.name &&
      a.datatype === b.datatype &&
      a.default === b.default &&
      a.notNull === b.notNull &&
      a.unique === b.unique &&
      typeEquals(a.primaryKey, b.primaryKey) &&
      a.primaryKey?.autoincrement === b.primaryKey?.autoincrement &&
      typeEquals(a.foreignKey, b.foreignKey) &&
      a.foreignKey?.column === b.foreignKey?.column &&
      a.foreignKey?.table === b.foreignKey?.table &&
      resolveColumnCheck(a) === resolveColumnCheck(b)
    )
  }

  function constraintEquals(
    a: TableConstraintData,
    b: TableConstraintData,
    ta: TableData,
    tb: TableData,
  ) {
    if (a.type !== b.type) {
      return false
    }
    if (a.type === "check" && b.type === "check") {
      return (
        resolveTableCheck(a.expression, ta) ===
        resolveTableCheck(b.expression, tb)
      )
    }
    if (a.type !== "check" && b.type !== "check") {
      return a.columns.join(" ") === b.columns.join(" ")
    }
    return false
  }

  function resolveColumnCheck(col: ColumnData): string | undefined {
    if (col.check == null) {
      return undefined
    }
    return typeof col.check === "function"
      ? col.check(col.name, col)
      : col.check
  }

  function resolveTableCheck(
    expression: TableCheckData["expression"],
    table: TableData,
  ): string {
    if (typeof expression === "function") {
      const columnNames = Object.fromEntries(
        table.columns.map((c) => [c.name, c.name]),
      )
      return expression(columnNames, table)
    }
    return expression
  }

  function typeEquals(a: unknown, b: unknown) {
    return typeof a === typeof b
  }
}
