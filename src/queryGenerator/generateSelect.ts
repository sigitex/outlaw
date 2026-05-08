import { indent, join, newline, type Node, print } from "@sigitex/print"
import { Format } from "../framework"
import type { JoinClause, OrderBySort, SelectQuery } from "../queryBuilder"
import { Clause } from "./Clause"

export function generateSelect(query: SelectQuery) {
  return print([generateSelectNode(query)])
}

export function generateSelectNode({
  selected,
  table,
  conditions,
  limit,
  offset,
  orderBy,
  joins,
}: SelectQuery): Node {
  const hasJoins = !!joins?.length
  const aliasMap = hasJoins ? buildAliasMap(table, joins!) : undefined
  return [
    "select ",
    selected &&
      join(", ", selected, (col: string) =>
        hasJoins ? qualifyColumn(table, col) : Format.name(col),
      ),
    !selected &&
      (hasJoins ? allColumnsQualified(table, joins!, aliasMap!) : "*"),
    newline,
    "from ",
    Format.name(table),
    newline,
    hasJoins && Clause.joins(joins!, aliasMap!),
    conditions?.length &&
      Clause.where(conditions, hasJoins ? table : undefined),
    limit && ["limit ", Format.number(limit), newline],
    offset && ["offset ", Format.number(offset), newline],
    orderBy && orderByClause(orderBy),
  ]
}

function buildAliasMap(
  baseTable: string,
  joins: JoinClause[],
): Map<JoinClause, string> {
  const map = new Map<JoinClause, string>()
  const used = new Set([baseTable])

  for (const clause of joins) {
    const sourceName =
      clause.target.kind === "table" ? clause.target.name : clause.target.table
    let alias = sourceName
    let i = 1
    while (used.has(alias)) {
      alias = `${sourceName}_${i++}`
    }
    used.add(alias)
    map.set(clause, alias)
  }
  return map
}

function qualifyColumn(baseTable: string, column: string): string {
  return `${Format.name(baseTable)}.${Format.name(column)}`
}

function allColumnsQualified(
  table: string,
  joins: JoinClause[],
  aliasMap: Map<JoinClause, string>,
): Node {
  const names = [table, ...joins.map((j) => aliasMap.get(j)!)]
  return names.map((t, i) => [i > 0 && ", ", Format.name(t), ".*"])
}

function orderByClause(orderBy: OrderBySort[]): Node {
  return [
    "order by ",
    indent(
      orderBy.map(({ column, direction }, index) => [
        index > 0 && ", ",
        Format.name(column),
        " ",
        direction,
        newline,
      ]),
    ),
  ]
}
