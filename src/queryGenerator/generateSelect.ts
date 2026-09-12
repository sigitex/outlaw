import { join, newline, type Node, print } from "@sigitex/print"
import { Format } from "../framework"
import type { SelectQuery } from "../queryBuilder/queryBuilders.types"
import { Clause } from "./Clause"

export function generateSelect(query: SelectQuery) {
  return print([generateSelectNode(query)])
}

export function generateSelectNode(query: SelectQuery): Node {
  return [
    "select ",
    join(", ", query.selected, projection => {
      if (projection === "*") return "*"
      if ("wildcard" in projection) return [Format.identifier(projection.table), ".*"]
      return [Clause.identifier(projection.column), projection.alias !== undefined && [" as ", Format.identifier(projection.alias)]]
    }),
    newline,
    "from ", Clause.source(query.source), newline,
    query.joins?.length && Clause.joins(query.joins),
    query.conditions?.length && Clause.where(query.conditions),
    query.orderBy?.length && [
      "order by ",
      join(", ", query.orderBy, sort => [Clause.identifier(sort.column), " ", sort.direction]),
      newline,
    ],
    query.limit !== undefined && ["limit ", Format.number(query.limit), newline],
    query.offset !== undefined && ["offset ", Format.number(query.offset), newline],
  ]
}
