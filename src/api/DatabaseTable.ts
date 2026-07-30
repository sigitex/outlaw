// oxlint-disable typescript/no-explicit-any
import type {
  Delete,
  Connection,
  Insert,
  Select,
  TableApi,
  Update,
} from "./api.types"
import type { TableData } from "../schemaBuilder"
import {
  DeleteBuilder,
  InsertBuilder,
  SelectBuilder,
  UpdateBuilder,
} from "../queryBuilder"

export class DatabaseTable implements TableApi<any> {
  private connection: Connection
  private table: TableData

  constructor(connection: Connection, table: TableData) {
    this.connection = connection
    this.table = table
  }

  select(all: "*"): Select<any, any>
  select<Column extends string>(
    ...columns: Column[]
  ): Select<Pick<any, any>, any>
  select(...columns: ("*" | string)[]): Select<any, any> {
    const selected = columns[0] === "*" || columns.length === 0 ? "*" : columns
    return new SelectBuilder(this.connection, this.table, selected)
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
    return new InsertBuilder(this.connection, this.table, columns, rows)
  }

  update(row: Partial<any>): Update<any, number> {
    return new UpdateBuilder(this.connection, this.table, row)
  }

  delete(): Delete<TableData, number> {
    return new DeleteBuilder(this.connection, this.table)
  }
}
