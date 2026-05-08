import { join, newline, print } from "@sigitex/print"
import { Format } from "../framework"
import type { IndexData } from "../schemaBuilder"

export function generateCreateIndex(index: IndexData) {
  return print([
    "create ",
    index.unique && "unique ",
    "index ",
    Format.name(index.name),
    " on ",
    Format.name(index.table),
    " (",
    join(", ", index.columns, Format.name),
    ");",
    newline,
  ])
}
