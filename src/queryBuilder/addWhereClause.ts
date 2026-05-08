// oxlint-disable typescript/no-explicit-any
import type { TableData } from "../schemaBuilder"
import type { Condition } from "./queryBuilders.types"
import { Mappings } from "./Mappings"
import { isBinaryOperator, isUnaryOperator } from "./operators"

/** Constructs `WHERE` clauses. */
export function addWhereClause(
  column: string,
  table: TableData,
  query: { conditions?: Condition[] },
  operator: any,
  value?: any,
) {
  if (query.conditions === undefined) {
    query.conditions = []
  }
  if (value !== undefined && isBinaryOperator(operator)) {
    query.conditions.push({
      column,
      arity: 2,
      operator,
      value: Mappings.conditionValue(table, column, value),
    })
  } else if (isUnaryOperator(operator)) {
    query.conditions.push({ column, arity: 1, operator })
  } else {
    query.conditions.push({
      column,
      arity: 2,
      operator: "=",
      value: Mappings.conditionValue(table, column, operator),
    })
  }
}
