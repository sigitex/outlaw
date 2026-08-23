import type {
  BuildTable,
  BuildView,
  SchemaMembers,
  Schema,
} from "../schemaBuilder"
import type {
  Connection,
  DatabaseApi,
  TransactionalConnection,
} from "./api.types"
import { DatabaseTable } from "./DatabaseTable"
import { DatabaseView } from "./DatabaseView"
import { UnsupportedTransactionError } from "./UnsupportedTransactionError"

export function createDatabase<M extends SchemaMembers, C extends Connection>(
  connection: C,
  schema: Schema<M>,
) {
  const api = {
    connection,
    transaction: async <Result>(
      work: (
        database: DatabaseApi<M, TransactionalConnection>,
      ) => Promise<Result>,
    ) => {
      const transaction = connection.transaction
      if (!transaction) {
        throw new UnsupportedTransactionError()
      }
      return transaction((scopedConnection) =>
        work(createDatabase(scopedConnection, schema)),
      )
    },
  }
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
  return api as DatabaseApi<M, C>
}
