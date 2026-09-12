import { indent, join, newline, type Node } from "@sigitex/print"
import { Format } from "../framework"
import type {
  Condition,
  JoinClause,
  JoinTarget,
  ColumnIdentifier,
  SelectCondition,
} from "../queryBuilder"
import { generateSelectNode } from "./generateSelect"

export namespace Clause {
  export function where(conditions: (Condition | SelectCondition)[]): Node[] {
    return [
      "where ",
      indent(
        conditions.map((condition, index) => [
          index > 0 && " and ",
          typeof condition.column === "string"
            ? Format.name(condition.column)
            : identifier(condition.column),
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

  export function identifier(column: ColumnIdentifier): string {
    return column.table === undefined
      ? Format.identifier(column.column)
      : `${Format.identifier(column.table)}.${Format.identifier(column.column)}`
  }

  export function source(target: JoinTarget): Node {
    return [
      target.kind === "table"
        ? Format.identifier(target.name)
        : ["(", newline, indent([generateSelectNode(target.query)]), ")"],
      target.alias !== undefined && [" as ", Format.identifier(target.alias)],
    ]
  }

  export function joins(clauses: JoinClause[]): Node {
    return clauses.map((clause) => {
      const { type, on } = clause
      return [
        type,
        " ",
        source(clause.target),
        newline,
        on.length > 0 &&
          indent(
            on.map(({ left, operator, right }, index) => [
              index === 0 ? "on " : "and ",
              identifier(left),
              ` ${operator} `,
              identifier(right),
              newline,
            ]),
          ),
        clause.using?.length && [
          "using (",
          join(", ", clause.using, Format.identifier),
          ")",
          newline,
        ],
      ]
    })
  }
}
