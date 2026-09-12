import type { Connection } from "./api.types"
import type { TableData } from "../schemaBuilder"
import { SourceBuilder } from "../queryBuilder/SourceBuilder"

export class DatabaseView extends SourceBuilder {
  constructor(connection: Connection, tableData: TableData) {
    super({ kind: "table", name: tableData.name, tableData }, connection)
  }
}
