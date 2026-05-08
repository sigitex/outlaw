// oxlint-disable typescript/no-explicit-any
import type { Connection, Insert } from "../api"
import type { TableData } from "../schemaBuilder"
import type { InsertCommand } from "./queryBuilders.types"
import { generateInsert } from "../queryGenerator"
import { Mappings } from "./Mappings"

/** Constructs declarative `INSERT` statements. */
export class InsertBuilder implements Insert<any, any, any> {
  readonly connection: Connection
  readonly table: TableData
  readonly command: InsertCommand

  constructor(connection: Connection, table: TableData, columns: string[], rows: Record<string, unknown>[]) {
    this.connection = connection
    this.table = table
    this.command = { table: table.name, columns, rows: rows.map((r) => Mappings.row(table, r)) }
  }

  async execute(): Promise<any> {
    const result = await this.connection.query(generateInsert(this.command))
    return this.command.returning ? Mappings.results(this.table, result) : result
  }

  returning(all: "*"): Insert<any, any, any[]>
  returning(...columns: string[]): Insert<any, any, any[]>
  returning(...columns: ("*" | string)[]) {
    this.command.returning = columns[0] === "*" ? ["*"] : columns
    return this
  }
}
