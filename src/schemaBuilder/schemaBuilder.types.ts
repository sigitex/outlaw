// oxlint-disable typescript/no-explicit-any
import type { CheckExpression, ColumnData, ColumnRef, IndexData, TableData, ViewData } from "./metadata"
import type { Mapping } from "./Mapping"

export type SchemaMembers = {
  readonly [key: string]: AnyBuildTable | BuildView<any> | BuildIndex
}

export type TablesOf<M extends SchemaMembers> = {
  [K in keyof M as M[K] extends AnyBuildTable ? K : never]: M[K]
}

export type ViewsOf<M extends SchemaMembers> = {
  [K in keyof M as M[K] extends BuildView<any> ? K : never]: M[K]
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

export type InferColumn<BC> = BC extends BuildColumn<infer Type, infer Defined>
  ? "notNull" extends Defined
    ? Type
    : "primaryKey" extends Defined
      ? Type
      : Type | null
  : never

export type InferTable<BT> = BT extends BuildTable<infer Columns>
  ? { [K in keyof Columns]: InferColumn<Columns[K]> }
  : never

export type RefBy = {
  readonly _tag: "RefBy"
  readonly table: AnyBuildTable
  readonly column: string
  readonly value: unknown
}

type BuildTableDSL<DefineColumns> = {
  readonly $kind: "table"
  primaryKey: (...columns: (keyof DefineColumns)[]) => BuildTable<DefineColumns>
  unique: (...columns: (keyof DefineColumns)[]) => BuildTable<DefineColumns>
  check: (expression: string | ((columns: ColumnNames<DefineColumns>, table: TableData) => string)) => BuildTable<DefineColumns>
  select(all: "*"): SchemaSelect<DefineColumns, DefineColumns>
  select<C extends keyof DefineColumns>(...columns: C[]): SchemaSelect<Pick<DefineColumns, C>, DefineColumns>
  readonly by: {
    readonly [K in keyof DefineColumns]: (
      value: InferColumn<DefineColumns[K]>,
    ) => RefBy
  }
  readonly $meta: TableData
  readonly infer: InferTable<BuildTable<DefineColumns>>
}

export type BuildTable<DefineColumns> = BuildTableDSL<DefineColumns> & {
  readonly [K in keyof DefineColumns]: ColumnRef
}

export type AnyBuildTable = {
  readonly $kind: "table"
  readonly $meta: TableData
  readonly [key: string]: unknown
}

// oxlint-disable-next-line no-unused-vars
export type BuildView<SelectColumns = unknown> = {
  readonly $kind: "view"
  readonly $meta: ViewData
  readonly $tableData: TableData
}

export type BuildIndex = {
  readonly $kind: "index"
  readonly $meta: IndexData
}

/** Schema-level select builder — tracks column types without requiring a connection. */
export type SchemaSelect<SelectColumns, Columns> = {
  where<Column extends keyof Columns>(column: Column, value: unknown): SchemaSelect<SelectColumns, Columns>
  where<Column extends keyof Columns>(column: Column, operator: string): SchemaSelect<SelectColumns, Columns>
  where<Column extends keyof Columns>(column: Column, operator: string, value: unknown): SchemaSelect<SelectColumns, Columns>
  orderBy(sorts: [keyof Columns, "asc" | "desc"][]): SchemaSelect<SelectColumns, Columns>
  limit(n: number): SchemaSelect<SelectColumns, Columns>
  offset(n: number): SchemaSelect<SelectColumns, Columns>
  join<JC>(table: BuildTable<JC>): SchemaSelect<SelectColumns & JC, Columns & JC>
  leftJoin<JC>(table: BuildTable<JC>): SchemaSelect<SelectColumns & JC, Columns & JC>
  on(left: ColumnRef, operator: string, right: ColumnRef): SchemaSelect<SelectColumns, Columns>
}

export type BuildColumn<Type, Defined extends string> = Omit<
  {
    readonly notNull: BuildColumn<Type, Defined | "notNull">
    readonly primaryKey: BuildColumn<Type, Defined | "primaryKey"> &
      BuildPrimaryKey<Type, Defined | "primaryKey">
    readonly default: (sql: string) => BuildColumn<Type, Defined | "default">
    readonly unique: BuildColumn<Type, Defined | "unique">
    readonly check: (expression: CheckExpression) => BuildColumn<Type, Defined | "check">
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
