import { indent, newline, print } from "@sigitex/print"
import { Format } from "../framework"
import type { CheckExpression, ColumnData, TableData } from "../schemaBuilder"

export function generateCreateTable(table: TableData) {
  const columnNames = Object.fromEntries(table.columns.map(c => [c.name, c.name]))
  return print([
    "create table ",
    Format.name(table.name),
    " (",
    indent(
      table.columns.map((column, c) => [
        c > 0 && [",", newline],
        Format.name(column.name),
        " ",
        column.datatype,
        column.primaryKey && [
          " primary key",
          column.primaryKey.autoincrement && " autoincrement",
        ],
        column.notNull && " not null",
        column.unique && " unique",
        column.default && [" default ", column.default],
        column.check && [" check(", resolveColumnCheck(column.check, column), ")"],
      ]),
      table.columns
        .filter(({ foreignKey }) => foreignKey)
        .map((column) => [
          ",",
          newline,
          "foreign key (",
          Format.name(column.name),
          ") references ",
          Format.name(column.foreignKey?.table),
          " (",
          Format.name(column.foreignKey?.column),
          ")",
        ]),
      table.constraints.map((constraint) => [
        ",",
        newline,
        constraint.type === "primaryKey" && "primary key",
        constraint.type === "unique" && "unique",
        (constraint.type === "primaryKey" || constraint.type === "unique") && [
          " (",
          constraint.columns.map((fkColumn, c) => [
            c > 0 && ", ",
            Format.name(fkColumn),
          ]),
          ")",
        ],
        constraint.type === "check" && [
          "check(",
          typeof constraint.expression === "function"
            ? constraint.expression(columnNames, table)
            : constraint.expression,
          ")",
        ],
      ]),
    ),
    ");",
    newline,
  ])
}

function resolveColumnCheck(check: CheckExpression, column: ColumnData): string {
  return typeof check === "function" ? check(column.name, column) : check
}
