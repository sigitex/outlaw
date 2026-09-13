import type { BinaryOperator, Connection } from "../api/api.types"
import type { ColumnRef } from "../schemaBuilder/ColumnRef"
import { Projection } from "./Projection"
import { Source } from "./Source"
import { SelectBuilder } from "./SelectBuilder"
import { SelectQueryBuilder } from "./SelectQueryBuilder"
import type { JoinType, SelectQuery } from "./queryBuilders.types"

export class SourceBuilder {
  private readonly query: SelectQuery
  private readonly connection?: Connection

  constructor(
    source: Source.Data,
    connection?: Connection,
    query?: SelectQuery,
  ) {
    this.query = query ?? { source, selected: ["*"] }
    this.connection = connection
  }

  select(...columns: Projection.Input[]) {
    const query = Source.snapshot(this.query)
    const scope = Source.scope(query)
    query.selected = columns.length
      ? columns.map((column) => Projection.create(scope, column))
      : ["*"]
    return this.connection
      ? new SelectBuilder(this.connection, query)
      : new SelectQueryBuilder(query)
  }

  join(target: Source.Input) {
    return this.addJoin("join", target)
  }
  leftJoin(target: Source.Input) {
    return this.addJoin("left join", target)
  }
  rightJoin(target: Source.Input) {
    return this.addJoin("right join", target)
  }
  fullJoin(target: Source.Input) {
    return this.addJoin("full join", target)
  }
  crossJoin(target: Source.Input) {
    return this.addJoin("cross join", target)
  }

  on(
    left: string | ColumnRef,
    operator: BinaryOperator,
    right: string | ColumnRef,
  ) {
    const query = Source.snapshot(this.query)
    const scope = Source.scope(query)
    query.joins![query.joins!.length - 1].on.push({
      left: Source.identifier(scope, left),
      operator,
      right: Source.identifier(scope, right),
    })
    return new SourceBuilder(query.source, this.connection, query)
  }

  using(...columns: string[]) {
    const query = Source.snapshot(this.query)
    query.joins![query.joins!.length - 1].using = columns
    return new SourceBuilder(query.source, this.connection, query)
  }

  private addJoin(type: JoinType, input: Source.Input) {
    const query = Source.snapshot(this.query)
    query.joins ??= []
    query.joins.push({ type, target: Source.target(input), on: [] })
    return new SourceBuilder(query.source, this.connection, query)
  }
}
