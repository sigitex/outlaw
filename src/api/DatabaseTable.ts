// oxlint-disable typescript/no-explicit-any
import type { Delete, Connection, Insert, Select, TableApi, Update } from "./api.types"
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
  select<Column extends string>(columns: Column[]): Select<Pick<any, any>, any>
  select(
    columns: "*" | string[],
  ): Select<any, any> | Select<Pick<any, any>, any> {
    return new SelectBuilder(this.connection, this.table, columns)
  }

  insert(row: Partial<any>): Insert<any, any, number>
  insert<Column extends string | number | symbol>(
    columns: Column[],
    rows: Pick<any, Column>[],
  ): Insert<Column, any, number>
  insert(
    columnsOrRow: any,
    rows?: any,
  ): Insert<any, any, number> | Insert<any, any, number> {
    if (rows) {
      return new InsertBuilder(this.connection, this.table, columnsOrRow, rows)
    }
    const row = columnsOrRow as Record<string, unknown>
    return new InsertBuilder(this.connection, this.table, Object.keys(row), [row])
  }

  update(row: Partial<any>): Update<any, number> {
    return new UpdateBuilder(this.connection, this.table, row)
  }

  delete(): Delete<TableData, number> {
    return new DeleteBuilder(this.connection, this.table)
  }
}
