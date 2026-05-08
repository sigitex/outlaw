import type { Connection } from "../api"
import type { TableListItem } from "./reflection.types"

export class Reflector {
  private readonly connection: Connection
  private tableListItems: TableListItem[] | undefined = undefined

  constructor(connection: Connection) {
    this.connection = connection
  }

  async hasTable(tableName: string) {
    return (await this.getTableList()).some(
      ({ name, type }) => type === "table" && name === tableName,
    )
  }

  async isMissingTable(tableName: string) {
    return !(await this.hasTable(tableName))
  }

  async hasView(viewName: string) {
    return (await this.getTableList()).some(
      ({ name, type }) => type === "view" && name === viewName,
    )
  }

  async hasIndex(indexName: string) {
    const results = await this.connection.query<{ name: string }>(
      `select name from sqlite_master where type = 'index' and name = '${indexName}'`,
    )
    return results.length > 0
  }

  invalidate() {
    this.tableListItems = undefined
  }

  private async getTableList() {
    if (this.tableListItems === undefined) {
      const results =
        await this.connection.query<TableListItem>("pragma table_list")
      this.tableListItems = results.filter(({ schema }) => schema === "main")
    }
    return this.tableListItems
  }
}
