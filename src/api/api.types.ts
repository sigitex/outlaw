// oxlint-disable typescript/consistent-type-definitions
// oxlint-disable typescript/no-explicit-any
import type { BINARY_OPERATORS, UNARY_OPERATORS } from "../queryBuilder"
import type {
  BuildColumn,
  BuildTable,
  BuildView,
  ColumnRef,
  SchemaMembers,
  TablesOf,
  ViewsOf,
} from "../schemaBuilder"

// Utilities

export type ElementOf<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never

export type InsertRecord<R> = Partial<R> &
  Pick<
    R,
    {
      [P in keyof R]: R[P] extends Exclude<R[P], null> ? P : never
    }[keyof R]
  >

// Deconstruction

export type ColumnsOf<BT> =
  BT extends BuildTable<infer Columns> ? Columns : never

export type ColumnTypeOf<BC> =
  BC extends BuildColumn<infer Type, infer Constraints>
    ? Constraints extends "notNull" | "primaryKey"
      ? Type
      : Type | null
    : never

export type ColumnTypesOf<BCS> = {
  readonly [BCK in keyof BCS]: ColumnTypeOf<BCS[BCK]>
}

// API

export type DefaultRow = Record<string, unknown>

export type Connection = {
  readonly query: <Row = DefaultRow>(sql: string) => Promise<Row[]>
  readonly script: (statements: string[]) => Promise<void>
  readonly reset?: () => Promise<void>
}

export type DatabaseApi<M extends SchemaMembers> = {
  readonly [K in keyof TablesOf<M>]: TableApi<ColumnsOf<TablesOf<M>[K]>>
} & {
  readonly [K in keyof ViewsOf<M>]: ViewApi<ColumnsOfView<ViewsOf<M>[K]>>
} & {
  readonly connection: Connection
}

export type ColumnsOfView<BV> = BV extends BuildView<infer Columns> ? Columns : never

export type ViewApi<Columns> = {
  /** Issue a `SELECT *` query to the API. */
  select(all: "*"): Select<Columns, Columns>
  /** Issue a `SELECT` query to the API with the chosen columns. */
  select<Column extends keyof Columns>(
    ...columns: Column[]
  ): Select<Pick<Columns, Column>, Columns>
}

export type TableApi<Columns> = {
  /** Issue a `SELECT *` query to the API. */
  select(all: "*"): Select<Columns, Columns>
  /** Issue a `SELECT` query to the API with the chosen columns. */
  select<Column extends keyof Columns>(
    ...columns: Column[]
  ): Select<Pick<Columns, Column>, Columns>
  /** Issue an `INSERT` statement. */
  insert<InsertColumns extends Partial<ColumnTypesOf<Columns>>>(
    ...rows: InsertColumns[]
  ): Insert<InsertColumns, Columns, number>
  /** Issue an `UPDATE` statement. */
  update(row: Partial<ColumnTypesOf<Columns>>): Update<Columns, number>
  /** Issue a `DELETE` statement. */
  delete(): Delete<Columns, number>
}

/* Represents queries/statments with a `WHERE` clause. */
export interface HasWhereClause<Columns> {
  /** Add a condition where the given column equals the given value. */
  where<Column extends keyof Columns>(
    column: Column,
    value: Columns[Column],
  ): this
  /** Add a unary `WHERE` condition. */
  where<Column extends keyof Columns>(
    column: Column,
    operator: UnaryOperator,
  ): this
  /** Add a binary `WHERE` condition. */
  where<Column extends keyof Columns>(
    column: Column,
    operator: BinaryOperator,
    value: ColumnTypeOf<Columns[Column]>,
  ): this
}

/** Select query API. */
export interface Select<SelectColumns, Columns>
  extends HasWhereClause<Columns> {
  /** Issue the query, expecting an array of results. */
  fetch(): Promise<ColumnTypesOf<SelectColumns>[]>
  /** Issue the query, returning a single result, or throwing.. */
  first(): Promise<ColumnTypesOf<SelectColumns>>
  /** Add a `LIMIT` clause. */
  limit(n: number): this
  /** Add an `OFFSET` clause. */
  offset(n: number): this
  /** Add an `ORDER BY` sort expression. */
  orderBy(sorts: [keyof Columns, "asc" | "desc"][]): this

  /** Inner join on a table. */
  join<JC>(
    table: BuildTable<JC>,
  ): Select<SelectColumns & ColumnTypesOf<JC>, Columns & JC>
  /** Inner join on a subquery. */
  join<SC>(
    query: Select<SC, any>,
  ): Select<SelectColumns & ColumnTypesOf<SC>, Columns & SC>

  /** Left join on a table — joined columns become nullable. */
  leftJoin<JC>(
    table: BuildTable<JC>,
  ): Select<SelectColumns & Partial<ColumnTypesOf<JC>>, Columns & JC>
  /** Left join on a subquery — joined columns become nullable. */
  leftJoin<SC>(
    query: Select<SC, any>,
  ): Select<SelectColumns & Partial<ColumnTypesOf<SC>>, Columns & SC>

  /** Right join on a table. */
  rightJoin<JC>(
    table: BuildTable<JC>,
  ): Select<SelectColumns & ColumnTypesOf<JC>, Columns & JC>
  /** Right join on a subquery. */
  rightJoin<SC>(
    query: Select<SC, any>,
  ): Select<SelectColumns & ColumnTypesOf<SC>, Columns & SC>

  /** Cross join on a table. */
  crossJoin<JC>(
    table: BuildTable<JC>,
  ): Select<SelectColumns & ColumnTypesOf<JC>, Columns & JC>
  /** Cross join on a subquery. */
  crossJoin<SC>(
    query: Select<SC, any>,
  ): Select<SelectColumns & ColumnTypesOf<SC>, Columns & SC>

  /** Add an ON condition to the most recent join. */
  on(left: ColumnRef, operator: BinaryOperator, right: ColumnRef): this
}

/** Insert statement API. */
export interface Insert<InsertColumns, Columns, Returning> {
  /** Execute the statement. */
  execute(): Promise<Returning>
  /** Specify a `RETURNING *` clause. */
  returning(all: "*"): Insert<InsertColumns, Columns, ColumnTypesOf<Columns>[]>
  /** Specify a `RETURNING` clause with the chosen columns. */
  returning<Column extends keyof Columns>(
    ...columns: Column[]
  ): Insert<InsertColumns, Columns, ColumnTypesOf<Pick<Columns, Column>>[]>
}

/** Update statement API. */
export interface Update<Columns, Returning> extends HasWhereClause<Columns> {
  /** Execute the statement. */
  execute(): Promise<Returning>
  /** Specify a `RETURNING *` clause. */
  returning(all: "*"): Update<Columns, Columns[]>
  /** Specify a `RETURNING` clause with the chosen columns. */
  returning<Column extends keyof Columns>(
    columns: Column[],
  ): Update<Columns, Pick<Columns, Column>[]>
}

/** Delete statement API. */
export interface Delete<Columns, Returning> extends HasWhereClause<Columns> {
  /** Execute the statement. */
  execute(): Promise<Returning>
  /** Specify a `RETURNING *` clause. */
  returning(all: "*"): Delete<Columns, Columns[]>
  /** Specify a `RETURNING` clause with the chosen columns. */
  returning<Column extends keyof Columns>(
    columns: Column[],
  ): Delete<Columns, Pick<Columns, Column>[]>
}

export type UnaryOperator = ElementOf<typeof UNARY_OPERATORS>
export type BinaryOperator = ElementOf<typeof BINARY_OPERATORS>
