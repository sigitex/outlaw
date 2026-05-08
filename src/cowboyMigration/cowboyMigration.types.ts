export type SchemaHack =
| RenamedTable
| RenamedColumn
| DroppedTable
| DroppedColumn

export type RenamedTable = {
  readonly type: "renamedTable"
  readonly fromTable: string
  readonly toTable: string
}

export type RenamedColumn = {
  readonly type: "renamedColumn"
  readonly fromTable: string
  readonly fromColumn: string
  readonly toColumn: string
}

export type DroppedTable = {
  readonly type: "droppedTable"
  readonly tableName: string
}

export type DroppedColumn = {
  readonly type: "droppedColumn"
  readonly tableName: string
  readonly columnName: string
}
