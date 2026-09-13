// oxlint-disable typescript/no-explicit-any
import type {
  CheckExpression,
  ColumnData,
  ColumnRef,
  IndexData,
  TableData,
  ViewData,
} from "./metadata"
import type { Mapping } from "./Mapping"
import type { QuerySource } from "../queryBuilder/QuerySource"
import type { QueryScope } from "../queryBuilder/QueryScope"

export type SchemaMembers = {
  readonly [key: string]: AnyBuildTable | AnyBuildView | BuildIndex
}

export type TablesOf<M extends SchemaMembers> = {
  [K in keyof M as M[K] extends AnyBuildTable ? K : never]: M[K]
}

export type ViewsOf<M extends SchemaMembers> = {
  [K in keyof M as M[K] extends AnyBuildView ? K : never]: M[K]
}

export type IndexesOf<M extends SchemaMembers> = {
  [K in keyof M as M[K] extends BuildIndex ? K : never]: M[K]
}

export type Schema<M extends SchemaMembers> = {
  readonly tables: TablesOf<M>
  readonly views: ViewsOf<M>
  readonly indexes: IndexesOf<M>
}

export type ColumnNames<Columns> = { readonly [K in keyof Columns]: string }

export type BuildColumns = {
  readonly [columnName: string]: BuildColumn<any, any>
}

export type InferColumn<BC> = BC extends {
  readonly $value?: infer Type
  readonly $defined?: infer Defined
}
  ? "notNull" extends Defined
    ? Type
    : "primaryKey" extends Defined
      ? Type
      : Type | null
  : never

export type InferTable<BT> = BT extends { readonly $columns: infer Columns }
  ? { [K in keyof Columns]: InferColumn<Columns[K]> }
  : never

export type RefBy = {
  readonly _tag: "RefBy"
  readonly table: AnyBuildTable
  readonly column: string
  readonly value: unknown
}

type BuildTableDSL<DefineColumns, Name extends string> = {
  readonly $kind: "table"
  readonly $columns: DefineColumns
  primaryKey: (
    ...columns: (keyof DefineColumns)[]
  ) => BuildTable<DefineColumns, Name>
  unique: (
    ...columns: (keyof DefineColumns)[]
  ) => BuildTable<DefineColumns, Name>
  check: (
    expression:
      | string
      | ((columns: ColumnNames<DefineColumns>, table: TableData) => string),
  ) => BuildTable<DefineColumns, Name>
  readonly by: {
    readonly [K in keyof DefineColumns]: (
      value: InferColumn<DefineColumns[K]>,
    ) => RefBy
  }
  readonly $meta: TableData
  readonly infer: {
    [Key in keyof DefineColumns]: InferColumn<DefineColumns[Key]>
  }
}

export type BuildTable<
  DefineColumns,
  Name extends string = string,
> = BuildTableDSL<DefineColumns, Name> &
  QuerySource<Name, QueryScope.SchemaColumns<DefineColumns>>

export type AnyBuildTable = {
  readonly $kind: "table"
  readonly $meta: TableData
  readonly [key: string]: unknown
}

export type BuildView<
  SelectColumns extends QueryScope.Columns = QueryScope.Columns,
  Name extends string = string,
> = QuerySource<Name, SelectColumns> & {
  readonly $kind: "view"
  readonly $meta: ViewData
  readonly $tableData: TableData
}

export type AnyBuildView = {
  readonly $kind: "view"
  readonly $meta: ViewData
  readonly $tableData: TableData
}

export type BuildIndex = {
  readonly $kind: "index"
  readonly $meta: IndexData
}

export type SchemaSelect<
  SelectColumns extends QueryScope.Columns,
  Scope extends QueryScope,
> = QueryScope.Selection<SelectColumns, Scope>

export type BuildColumn<Type, Defined extends string> = Omit<
  {
    readonly $value?: Type
    readonly $defined?: Defined
    readonly notNull: BuildColumn<Type, Defined | "notNull">
    readonly primaryKey: BuildColumn<Type, Defined | "primaryKey"> &
      BuildPrimaryKey<Type, Defined | "primaryKey">
    readonly default: (sql: string) => BuildColumn<Type, Defined | "default">
    readonly unique: BuildColumn<Type, Defined | "unique">
    readonly check: (
      expression: CheckExpression,
    ) => BuildColumn<Type, Defined | "check">
    readonly foreignKey: BuildForeignKey<Type, Defined>
    readonly map: BuildColumnMap<Type, Defined>
  },
  Defined
>

export type BuildColumnInner = BuildColumn<any, never> & {
  $meta: Partial<ColumnData>
}

export type BuildPrimaryKey<Type, Defined extends string> = {
  readonly autoincrement: BuildColumn<Type, Defined>
}

export type BuildForeignKey<Type, Defined extends string> = {
  readonly references: (
    ref: ColumnRef,
  ) => BuildColumn<Type, Defined | "foreignKey">
}

export type BuildColumnMap<Type, Defined extends string> = {
  readonly boolean: BuildColumn<boolean, Defined | "map">
  readonly timestamp: BuildColumn<Date, Defined | "map">
  readonly date: BuildColumn<Date, Defined | "map">
  readonly json: <T>() => BuildColumn<T, Defined | "map">
} & {
  <To>(mapping: Mapping<Type, To>): BuildColumn<To, Defined | "map">
  <To>(): BuildColumn<To, Defined | "map">
}
