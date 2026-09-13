import type { BinaryOperator, UnaryOperator } from "../api/api.types"
import type { ColumnRef } from "../schemaBuilder/ColumnRef"
import { QuerySource } from "./QuerySource"
import type { SelectQuery } from "./queryBuilders.types"
import { isBinaryOperator, isUnaryOperator } from "./operators"
import { Projection } from "./Projection"

export class SelectQueryBuilder {
  readonly query: SelectQuery

  constructor(query: SelectQuery) {
    this.query = query
  }

  as(name: string) {
    return QuerySource.create({ ...QuerySource.target(this), alias: name })
  }

  limit(count: number) {
    this.query.limit = count
    return this
  }

  offset(count: number) {
    this.query.offset = count
    return this
  }

  where(column: string | ColumnRef, value: unknown): this
  where(
    column: string | ColumnRef,
    operator: BinaryOperator | UnaryOperator,
    value?: unknown,
  ): this
  where(column: string | ColumnRef, operator: unknown, value?: unknown) {
    const scope = QuerySource.scope(this.query)
    const identifier = QuerySource.identifier(scope, column)
    this.query.conditions ??= []
    if (
      typeof operator === "string" &&
      isUnaryOperator(operator) &&
      arguments.length === 2
    ) {
      this.query.conditions.push({
        column: identifier,
        arity: 1,
        operator: operator as UnaryOperator,
      })
    } else {
      const binary =
        arguments.length === 3 &&
        typeof operator === "string" &&
        isBinaryOperator(operator)
      const operand = binary ? value : operator
      const columns = QuerySource.resolve(scope, identifier)
      const mapping = columns.length
        ? Projection.merge(columns).mapping
        : undefined
      this.query.conditions.push({
        column: identifier,
        arity: 2,
        operator: binary ? (operator as BinaryOperator) : "=",
        value: mapping && operand !== null ? mapping.to(operand) : operand,
      })
    }
    return this
  }

  orderBy(sorts: readonly (readonly [string | ColumnRef, "asc" | "desc"])[]) {
    const scope = QuerySource.scope(this.query)
    const outputs = Projection.columns(this.query)
    this.query.orderBy = sorts.map(([column, direction]) => ({
      column:
        typeof column === "string" &&
        outputs.some((output) => output.name === column)
          ? { column }
          : QuerySource.identifier(scope, column),
      direction,
    }))
    return this
  }
}
