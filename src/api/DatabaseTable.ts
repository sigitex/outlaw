// oxlint-disable typescript/no-explicit-any
import type {
  Delete,
  Connection,
  Insert,
  Update,
} from "./api.types"
import type { TableData } from "../schemaBuilder"
import {
  DeleteBuilder,
  InsertBuilder,
  UpdateBuilder,
} from "../queryBuilder"
import { SourceBuilder } from "../queryBuilder/SourceBuilder"

export class DatabaseTable extends SourceBuilder {
  private readonly tableConnection: Connection
  private table: TableData

  constructor(connection: Connection, table: TableData) {
    super({ kind: "table", name: table.name, tableData: table }, connection)
    this.tableConnection = connection
    this.table = table
  }

  insert(...rows: [Partial<any>, ...Partial<any>[]]): Insert<any, any, number>
  insert(...rows: Record<string, unknown>[]): Insert<any, any, number> {
    const first = rows[0]
    if (!first) {
      throw new Error("insert() requires at least one row")
    }
    const columns = Object.keys(first)
    const expected = new Set(columns)
    for (const row of rows.slice(1)) {
      const rowColumns = Object.keys(row)
      if (
        rowColumns.length !== columns.length ||
        rowColumns.some((column) => !expected.has(column))
      ) {
        throw new Error("insert() rows must use the same columns")
      }
    }
    return new InsertBuilder(this.tableConnection, this.table, columns, rows)
  }

  update(row: Partial<any>): Update<any, number> {
    return new UpdateBuilder(this.tableConnection, this.table, row)
  }

  delete(): Delete<TableData, number> {
    return new DeleteBuilder(this.tableConnection, this.table)
  }
}
