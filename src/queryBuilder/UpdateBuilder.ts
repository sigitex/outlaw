// oxlint-disable typescript/no-explicit-any
import type { BinaryOperator, Connection, UnaryOperator, Update } from "../api"
import { generateUpdate } from "../queryGenerator"
import type { TableData } from "../schemaBuilder"
import { addWhereClause } from "./addWhereClause"
import { Mappings } from "./Mappings"
import type { UpdateCommand } from "./queryBuilders.types"

/** Constructs declarative `UPDATE` statements. */
export class UpdateBuilder implements Update<any, any> {
  readonly connection: Connection
  readonly table: TableData
  readonly command: UpdateCommand

  constructor(
    connection: Connection,
    table: TableData,
    row: Record<string, unknown>,
  ) {
    this.connection = connection
    this.table = table
    this.command = { table: table.name, assignments: Mappings.row(table, row) }
  }

  async execute(): Promise<any> {
    const result = await this.connection.query(generateUpdate(this.command))
    return this.command.returning
      ? Mappings.results(this.table, result)
      : result
  }

  returning(all: "*"): Update<any, any[]>
  returning(...columns: string[]): Update<any, Pick<any, any>[]>
  returning(...columns: ("*" | string)[]): Update<any, any[]> {
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
