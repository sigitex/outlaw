// oxlint-disable typescript/no-explicit-any
import type { Connection, Select } from "../api"
import type { TableData } from "../schemaBuilder"
import { generateSelect } from "../queryGenerator"
import { Mappings } from "./Mappings"
import { SelectQueryBuilder } from "./SelectQueryBuilder"

/** Constructs declarative `SELECT` statements with connection-based execution. */
export class SelectBuilder extends SelectQueryBuilder implements Select<any, any> {
  readonly connection: Connection

  constructor(
    connection: Connection,
    table: TableData,
    columns: "*" | string[],
  ) {
    super(table, columns)
    this.connection = connection
  }

  async fetch(): Promise<any[]> {
    const rows = await this.connection.query(generateSelect(this.query))
    const tables = [
      this.table,
      ...(this.query.joins?.map((j) => j.target.tableData) ?? []),
    ]
    return Mappings.results(tables, rows)
  }

  async first(): Promise<any> {
    const results = await this.fetch()
    if (results[0] === undefined) {
      throw new Error(
        `Query did not return a result (table: "${this.table.name}").`,
      )
    }
    return results[0]
  }
}
