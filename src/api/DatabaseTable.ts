// oxlint-disable typescript/no-explicit-any
import type { Delete, Connection, Insert, Update } from "./api.types"
import type { TableData } from "../schemaBuilder"
import { DeleteBuilder, InsertBuilder, UpdateBuilder } from "../queryBuilder"
import { QuerySourceBuilder } from "../queryBuilder/QuerySourceBuilder"
import type { QuerySource } from "../queryBuilder/QuerySource"
import type { Projection } from "../queryBuilder/Projection"

export class DatabaseTable {
  private readonly connection: Connection
  private table: TableData
  private readonly source: QuerySource.Data

  constructor(connection: Connection, table: TableData) {
    this.connection = connection
    this.table = table
    this.source = { kind: "table", name: table.name, tableData: table }
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
