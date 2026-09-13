import type { Connection } from "../api/api.types"
import { generateSelect } from "../queryGenerator/generateSelect"
import { Mappings } from "./Mappings"
import { Projection } from "./Projection"
import { SelectQueryBuilder } from "./SelectQueryBuilder"
import type { SelectQuery } from "./queryBuilders.types"

export class SelectBuilder extends SelectQueryBuilder {
  readonly connection: Connection

  constructor(connection: Connection, query: SelectQuery) {
    super(query)
    this.connection = connection
  }

  async fetch() {
    const rows = await this.connection.query(generateSelect(this.query))
    return Mappings.results(
      { name: "", columns: Projection.columns(this.query), constraints: [] },
      rows,
    )
  }

  async first() {
    const results = await this.fetch()
    if (results[0] === undefined) {
      throw new Error(
        `Query did not return a result (table: "${this.query.source.tableData.name}").`,
      )
    }
    return results[0]
  }
}
