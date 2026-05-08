import type { BuildTable, BuildView, SchemaMembers, Schema } from "../schemaBuilder"
import type { Connection, DatabaseApi } from "./api.types"
import { DatabaseTable } from "./DatabaseTable"
import { DatabaseView } from "./DatabaseView"

export function createDatabase<M extends SchemaMembers>(
  connection: Connection,
  schema: Schema<M>,
) {
  const api = { connection }
  for (const [property, member] of Object.entries(schema.tables)) {
    const table = member as BuildTable<unknown>
    Object.defineProperty(api, property, {
      value: new DatabaseTable(connection, table.$meta),
    })
  }
  for (const [property, member] of Object.entries(schema.views)) {
    const view = member as BuildView
    Object.defineProperty(api, property, {
      value: new DatabaseView(connection, view.$tableData),
    })
  }
  return api as DatabaseApi<M>
}
