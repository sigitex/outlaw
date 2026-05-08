import { newline, print } from "@sigitex/print"
import { Format } from "../framework"
import type { DeleteCommand } from "../queryBuilder"
import { Clause } from "./Clause"

export function generateDelete({
  table,
  conditions,
  returning,
}: DeleteCommand) {
  return print([
    "delete from ",
    Format.name(table),
    newline,
    conditions?.length && Clause.where(conditions),
    returning && Clause.returning(returning),
  ])
}
