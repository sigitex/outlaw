import { indent, join, newline, type Node } from "@sigitex/print"
import { Format } from "../framework"
import type { Condition, JoinClause, JoinTarget } from "../queryBuilder"
import type { ColumnRef } from "../schemaBuilder"
import { generateSelectNode } from "./generateSelect"

export namespace Clause {
  export function where(conditions: Condition[], baseTable?: string): Node[] {
    return [
      "where ",
      indent(
        conditions.map((condition, index) => [
          index > 0 && " and ",
          baseTable
            ? qualifyColumn(baseTable, condition.column)
            : Format.name(condition.column),
          " ",
          condition.operator,
          condition.arity === 2 && [" ", Format.value(condition.value)],
          newline,
        ]),
      ),
    ]
  }

  export function returning(columns: string[]): Node {
    if (columns.length === 1 && columns[0] === "*") {
      return ["returning *", newline]
    }
    return ["returning ", join(", ", columns, Format.name), newline]
  }

  export function joins(
    clauses: JoinClause[],
    aliasMap: Map<JoinClause, string>,
  ): Node {
    return clauses.map((clause) => {
      const { type, on } = clause
      const alias = aliasMap.get(clause)!
      return [
        type,
        " ",
        formatTarget(clause.target, alias),
        newline,
        on.length > 0 &&
          indent(
            on.map(({ left, operator, right }, index) => [
              index === 0 ? "on " : "and ",
              formatRef(left),
              ` ${operator} `,
              formatRef(right),
              newline,
            ]),
          ),
      ]
    })
  }
}

function formatTarget(target: JoinTarget, alias: string): Node {
  if (target.kind === "table") {
    return Format.name(target.name)
  }
  return [
    "(",
    newline,
    indent([generateSelectNode(target.query)]),
    ") as ",
    Format.name(alias),
  ]
}

function formatRef(ref: ColumnRef): string {
  return `${Format.name(ref.table)}.${Format.name(ref.column)}`
}

function qualifyColumn(baseTable: string, column: string): string {
  return `${Format.name(baseTable)}.${Format.name(column)}`
}
