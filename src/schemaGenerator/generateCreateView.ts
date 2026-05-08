import { newline, print } from "@sigitex/print"
import { Format } from "../framework"
import type { ViewData } from "../schemaBuilder"

export function generateCreateView(view: ViewData) {
  return print([
    "create view ",
    Format.name(view.name),
    " as ",
    view.sql,
    newline,
  ])
}
