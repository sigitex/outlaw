// oxlint-disable typescript/no-explicit-any
// oxlint-disable typescript/method-signature-style
// oxlint-disable typescript/consistent-type-definitions
import type { BINARY_OPERATORS, UNARY_OPERATORS } from "../queryBuilder"
import type {
  InferColumn,
  SchemaMembers,
  TablesOf,
  ViewsOf,
} from "../schemaBuilder"
import type { QueryScope } from "../queryBuilder/QueryScope"

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
  BT extends { readonly $columns: infer Columns } ? Columns : never

export type ColumnTypesOf<BCS> = {
  readonly [BCK in keyof BCS]: InferColumn<BCS[BCK]>
}

// API

export type DefaultRow = Record<string, unknown>

export type ConnectionOperations = {
  readonly query: <Row = DefaultRow>(sql: string) => Promise<Row[]>
  readonly script: (statements: string[]) => Promise<void>
}

export type TransactionWork<Result> = (
  connection: TransactionalConnection,
) => Promise<Result>

export type Transaction = <Result>(
  work: TransactionWork<Result>,
) => Promise<Result>

export type TransactionalConnection = ConnectionOperations & {
  readonly transaction: Transaction
}

export type Connection = ConnectionOperations & {
  readonly reset?: () => Promise<void>
  readonly transaction?: Transaction
}

export type DatabaseApi<
  M extends SchemaMembers,
  C extends Connection = Connection,
> = {
  readonly [K in keyof TablesOf<M>]: TableApi<ColumnsOf<TablesOf<M>[K]>, QueryScope.Of<TablesOf<M>[K]>["name"]>
} & {
  readonly [K in keyof ViewsOf<M>]: ViewApi<QueryScope.Of<ViewsOf<M>[K]>["columns"], QueryScope.Of<ViewsOf<M>[K]>["name"]>
} & {
  readonly connection: C
  readonly transaction: <Result>(
    work: (
      database: DatabaseApi<M, TransactionalConnection>,
    ) => Promise<Result>,
  ) => Promise<Result>
}

export type ColumnsOfView<BV> =
  QueryScope.Of<BV>["columns"]

export type ViewApi<Columns extends QueryScope.Columns, Name extends string = string> = QueryScope.Composition<QueryScope.Initial<QueryScope.State<Name, Columns>>, true>

export type TableApi<Columns, Name extends string = string> = QueryScope.Composition<QueryScope.Initial<QueryScope.State<Name, QueryScope.SchemaColumns<Columns>>>, true> & {
  /** Issue an `INSERT` statement. */
  insert<InsertColumns extends Partial<ColumnTypesOf<Columns>>>(
    ...rows: [InsertColumns, ...InsertColumns[]]
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
    value: InferColumn<Columns[Column]>,
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
    value: InferColumn<Columns[Column]>,
  ): this
}

export type Select<SelectColumns extends QueryScope.Columns, Scope extends QueryScope> = QueryScope.Selection<SelectColumns, Scope, true>

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
  returning(all: "*"): Update<Columns, ColumnTypesOf<Columns>[]>
  /** Specify a `RETURNING` clause with the chosen columns. */
  returning<Column extends keyof Columns>(
    ...columns: Column[]
  ): Update<Columns, ColumnTypesOf<Pick<Columns, Column>>[]>
}

/** Delete statement API. */
export interface Delete<Columns, Returning> extends HasWhereClause<Columns> {
  /** Execute the statement. */
  execute(): Promise<Returning>
  /** Specify a `RETURNING *` clause. */
  returning(all: "*"): Delete<Columns, ColumnTypesOf<Columns>[]>
  /** Specify a `RETURNING` clause with the chosen columns. */
  returning<Column extends keyof Columns>(
    ...columns: Column[]
  ): Delete<Columns, ColumnTypesOf<Pick<Columns, Column>>[]>
}

export type UnaryOperator = ElementOf<typeof UNARY_OPERATORS>
export type BinaryOperator = ElementOf<typeof BINARY_OPERATORS>
