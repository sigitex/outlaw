import { join, newline, print } from "@sigitex/print"
import { Format } from "../framework"
import type { InsertCommand } from "../queryBuilder"
import { Clause } from "./Clause"

export function generateInsert({
  table,
  columns,
  rows,
  returning,
}: InsertCommand) {
  return print([
    "insert into ",
    Format.name(table),
    " (",
    join(", ", columns, Format.name),
    ")",
    newline,
    "values ",
    rows.map((row, i) => [
      i > 0 && ", ",
      "(",
      columns.map((col, c) => [c > 0 && ", ", Format.value(row[col])]),
      ")",
    ]),
    newline,
    returning && Clause.returning(returning),
  ])
}
