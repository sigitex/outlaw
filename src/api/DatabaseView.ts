// oxlint-disable typescript/no-explicit-any
import type { Connection, Select, ViewApi } from "./api.types"
import type { TableData } from "../schemaBuilder"
import { SelectBuilder } from "../queryBuilder"

export class DatabaseView implements ViewApi<any> {
  private connection: Connection
  private tableData: TableData

  constructor(connection: Connection, tableData: TableData) {
    this.connection = connection
    this.tableData = tableData
  }

  select(all: "*"): Select<any, any>
  select<Column extends string>(columns: Column[]): Select<Pick<any, any>, any>
  select(
    columns: "*" | string[],
  ): Select<any, any> | Select<Pick<any, any>, any> {
    return new SelectBuilder(this.connection, this.tableData, columns)
  }
}
