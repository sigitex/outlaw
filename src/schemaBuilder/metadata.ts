// oxlint-disable typescript/no-explicit-any
export type Text = "text"
export type Integer = "integer"
export type Real = "real"
export type Blob = "blob"

export type Datatype = Text | Integer | Real | Blob

export type JSType = string | number | ArrayBuffer

export type MappingData = { from(value: any): any; to(value: any): any }

export type TableData = {
  readonly name: string
  readonly columns: ColumnData[]
  readonly constraints: TableConstraintData[]
}

export type CheckExpression = string | ((name: string, column: ColumnData) => string)

export type ColumnData = {
  readonly name: string
  readonly datatype: Datatype
  readonly notNull: boolean
  readonly primaryKey: PrimaryKeyData | undefined
  readonly default: string | undefined
  readonly unique: boolean
  readonly foreignKey: ForeignKeyData | undefined
  readonly mapping: MappingData | undefined
  readonly check: CheckExpression | undefined
}

export type ColumnRef = {
  readonly table: string
  readonly column: string
}

export type ForeignKeyData = ColumnRef

export type TableConstraintData = TablePrimaryKeyData | TableUniqueData | TableCheckData

export type TablePrimaryKeyData = {
  readonly type: "primaryKey"
  readonly columns: string[]
}

export type TableUniqueData = {
  readonly type: "unique"
  readonly columns: string[]
}

export type TableCheckData = {
  readonly type: "check"
  readonly expression: string | ((columns: Record<string, string>, table: TableData) => string)
}

export type PrimaryKeyData = {
  readonly autoincrement: boolean
}

export type IndexData = {
  readonly kind: "index"
  readonly name: string
  readonly table: string
  readonly columns: string[]
  readonly unique: boolean
}

export type ViewData = {
  readonly kind: "view"
  readonly name: string
  readonly sql: string
}
