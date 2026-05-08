// oxlint-disable typescript/no-explicit-any
import type { BinaryOperator, Select, UnaryOperator } from "../api"
import type { BuildTable, ColumnRef, TableData } from "../schemaBuilder"
import { addWhereClause } from "./addWhereClause"
import type { JoinTarget, JoinType, SelectQuery } from "./queryBuilders.types"

/** Base query builder for constructing declarative `SELECT` statements without a connection. */
export class SelectQueryBuilder {
  readonly table: TableData
  readonly query: SelectQuery

  constructor(table: TableData, columns: "*" | string[]) {
    this.table = table
    this.query = { table: table.name }
    if (Array.isArray(columns)) {
      this.query.selected = columns
    }
  }

  limit(n: number) {
    this.query.limit = n
    return this
  }

  offset(n: number) {
    this.query.offset = n
    return this
  }

  where(column: string, value: any): this
  where(column: string, operator: UnaryOperator): this
  where(column: string, operator: BinaryOperator, value: any): this
  where(column: string, operator: any, value?: any) {
    addWhereClause(column, this.table, this.query, operator, value)
    return this
  }

  orderBy(sorts: [string, "asc" | "desc"][]): this {
    this.query.orderBy = sorts.map(([column, direction]) => ({
      column,
      direction,
    }))
    return this
  }

  private addJoin(type: JoinType, target: JoinTarget): this {
    if (!this.query.joins) {
      this.query.joins = []
    }
    this.query.joins.push({ type, target, on: [] })
    return this
  }

  join(target: BuildTable<any> | Select<any, any>): this {
    return this.addJoin("join", resolveTarget(target))
  }

  leftJoin(target: BuildTable<any> | Select<any, any>): this {
    return this.addJoin("left join", resolveTarget(target))
  }

  rightJoin(target: BuildTable<any> | Select<any, any>): this {
    return this.addJoin("right join", resolveTarget(target))
  }

  crossJoin(target: BuildTable<any> | Select<any, any>): this {
    return this.addJoin("cross join", resolveTarget(target))
  }

  on(left: ColumnRef, operator: BinaryOperator, right: ColumnRef): this {
    const joins = this.query.joins
    if (!joins?.length) {
      throw new Error("on() called without a preceding join")
    }
    joins[joins.length - 1].on.push({ left, operator, right })
    return this
  }
}

export function resolveTarget(
  target: BuildTable<any> | Select<any, any>,
): JoinTarget {
  if ("$meta" in target) {
    return { kind: "table", name: target.$meta.name, tableData: target.$meta }
  }
  const builder = target as unknown as SelectQueryBuilder
  return {
    kind: "subquery",
    table: builder.query.table,
    query: { ...builder.query },
    tableData: builder.table,
  }
}
