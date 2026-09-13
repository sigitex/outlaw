import type { Connection } from "./api.types"
import type { TableData } from "../schemaBuilder"
import { QuerySourceBuilder } from "../queryBuilder/QuerySourceBuilder"
import type { QuerySource } from "../queryBuilder/QuerySource"
import type { Projection } from "../queryBuilder/Projection"

export class DatabaseView {
  private readonly connection: Connection
  private readonly source: QuerySource.Data

  constructor(connection: Connection, tableData: TableData) {
    this.connection = connection
    this.source = { kind: "table", name: tableData.name, tableData }
  }

  select(...columns: Projection.Input[]) {
    return new QuerySourceBuilder(this.source, this.connection).select(
      ...columns,
    )
  }

  join(target: QuerySource.Input) {
    return new QuerySourceBuilder(this.source, this.connection).join(target)
  }

  leftJoin(target: QuerySource.Input) {
    return new QuerySourceBuilder(this.source, this.connection).leftJoin(target)
  }

  rightJoin(target: QuerySource.Input) {
    return new QuerySourceBuilder(this.source, this.connection).rightJoin(
      target,
    )
  }

  fullJoin(target: QuerySource.Input) {
    return new QuerySourceBuilder(this.source, this.connection).fullJoin(target)
  }

  crossJoin(target: QuerySource.Input) {
    return new QuerySourceBuilder(this.source, this.connection).crossJoin(
      target,
    )
  }
}
