import type { Connection } from "./api.types"
import type { TableData } from "../schemaBuilder"
import { SourceBuilder } from "../queryBuilder/SourceBuilder"
import type { Source } from "../queryBuilder/Source"
import type { Projection } from "../queryBuilder/Projection"

export class DatabaseView {
  private readonly connection: Connection
  private readonly source: Source.Data

  constructor(connection: Connection, tableData: TableData) {
    this.connection = connection
    this.source = { kind: "table", name: tableData.name, tableData }
  }

  select(...columns: Projection.Input[]) {
    return new SourceBuilder(this.source, this.connection).select(...columns)
  }

  join(target: Source.Input) {
    return new SourceBuilder(this.source, this.connection).join(target)
  }

  leftJoin(target: Source.Input) {
    return new SourceBuilder(this.source, this.connection).leftJoin(target)
  }

  rightJoin(target: Source.Input) {
    return new SourceBuilder(this.source, this.connection).rightJoin(target)
  }

  fullJoin(target: Source.Input) {
    return new SourceBuilder(this.source, this.connection).fullJoin(target)
  }

  crossJoin(target: Source.Input) {
    return new SourceBuilder(this.source, this.connection).crossJoin(target)
  }
}
