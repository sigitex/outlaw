// oxlint-disable typescript/no-explicit-any
import type { BinaryOperator, UnaryOperator, Delete, Connection } from "../api"
import type { TableData } from "../schemaBuilder"
import type { DeleteCommand } from "./queryBuilders.types"
import { generateDelete } from "../queryGenerator"
import { addWhereClause } from "./addWhereClause"
import { Mappings } from "./Mappings"

/** Constructs declarative `DELETE` statements. */
export class DeleteBuilder implements Delete<any, any> {
  connection: Connection
  table: TableData
  command: DeleteCommand

  constructor(connection: Connection, table: TableData) {
    this.connection = connection
    this.table = table
    this.command = { table: table.name }
  }

  async execute(): Promise<any> {
    const result = await this.connection.query(generateDelete(this.command))
    return this.command.returning
      ? Mappings.results(this.table, result)
      : result
  }

  returning(all: "*"): Delete<any, any[]>
  returning(...columns: string[]): Delete<any, Pick<any, any>[]>
  returning(...columns: ("*" | string)[]): Delete<any, any[]> {
    this.command.returning = columns[0] === "*" ? ["*"] : columns
    return this
  }

  where(column: string, value: any): this
  where(column: string, operator: UnaryOperator): this
  where(column: string, operator: BinaryOperator, value: any): this
  where(column: any, operator: any, value?: any): this {
    addWhereClause(column, this.table, this.command, operator, value)
    return this
  }
}
