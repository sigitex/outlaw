import type { BinaryOperator, Connection } from "../api/api.types"
import type { ColumnRef } from "../schemaBuilder/ColumnRef"
import { Projection } from "./Projection"
import { QuerySource } from "./QuerySource"
import { SelectBuilder } from "./SelectBuilder"
import { SelectQueryBuilder } from "./SelectQueryBuilder"
import type { JoinType, SelectQuery } from "./queryBuilders.types"

export class QuerySourceBuilder {
  private readonly query: SelectQuery
  private readonly connection?: Connection

  constructor(
    source: QuerySource.Data,
    connection?: Connection,
    query?: SelectQuery,
  ) {
    this.query = query ?? { source, selected: ["*"] }
    this.connection = connection
  }

  select(...columns: Projection.Input[]) {
    const query = QuerySource.snapshot(this.query)
    const scope = QuerySource.scope(query)
    query.selected = columns.length
      ? columns.map((column) => Projection.create(scope, column))
      : ["*"]
    return this.connection
      ? new SelectBuilder(this.connection, query)
      : new SelectQueryBuilder(query)
  }

  join(target: QuerySource.Input) {
    return this.addJoin("join", target)
  }
  leftJoin(target: QuerySource.Input) {
    return this.addJoin("left join", target)
  }
  rightJoin(target: QuerySource.Input) {
    return this.addJoin("right join", target)
  }
  fullJoin(target: QuerySource.Input) {
    return this.addJoin("full join", target)
  }
  crossJoin(target: QuerySource.Input) {
    return this.addJoin("cross join", target)
  }

  on(
    left: string | ColumnRef,
    operator: BinaryOperator,
    right: string | ColumnRef,
  ) {
    const query = QuerySource.snapshot(this.query)
    const scope = QuerySource.scope(query)
    query.joins![query.joins!.length - 1].on.push({
      left: QuerySource.identifier(scope, left),
      operator,
      right: QuerySource.identifier(scope, right),
    })
    return new QuerySourceBuilder(query.source, this.connection, query)
  }

  using(...columns: string[]) {
    const query = QuerySource.snapshot(this.query)
    query.joins![query.joins!.length - 1].using = columns
    return new QuerySourceBuilder(query.source, this.connection, query)
  }

  private addJoin(type: JoinType, input: QuerySource.Input) {
    const query = QuerySource.snapshot(this.query)
    query.joins ??= []
    query.joins.push({ type, target: QuerySource.target(input), on: [] })
    return new QuerySourceBuilder(query.source, this.connection, query)
  }
}
