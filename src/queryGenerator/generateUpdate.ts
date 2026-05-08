import { indent, newline, print } from "@sigitex/print"
import { Format } from "../framework"
import type { UpdateCommand } from "../queryBuilder"
import { Clause } from "./Clause"

export function generateUpdate({
  table,
  assignments,
  conditions,
  returning,
}: UpdateCommand) {
  const columns = Object.keys(assignments)
  return print([
    "update ",
    Format.name(table),
    newline,
    "set ",
    indent(
      columns.map((col, i) => [
        i > 0 && [",", newline],
        Format.name(col),
        " = ",
        Format.value(assignments[col]),
      ]),
    ),
    conditions?.length && Clause.where(conditions),
    returning && Clause.returning(returning),
  ])
}
