// oxlint-disable typescript/consistent-type-definitions -- review
import type { BinaryOperator, UnaryOperator } from "../api/api.types"
import type { QuerySource } from "./QuerySource"
import type { Projection } from "./Projection"

export type ColumnIdentifier = { table?: string; column: string }
export type SelectCondition =
  | (Omit<UnaryCondition, "column"> & { column: ColumnIdentifier })
  | (Omit<BinaryCondition, "column"> & { column: ColumnIdentifier })

/** Represents a select query. */
export interface SelectQuery {
  /** Table this query is performed on. */
  source: QuerySource.Data
  /** Limit clause. */
  limit?: number
  /** Offset clause. */
  offset?: number
  /** Conditions of the SELECT. */
  conditions?: SelectCondition[]
  /** Which columns are being selected in this query. */
  selected: Projection[]
  /** Order By clause */
  orderBy?: { column: ColumnIdentifier; direction: "asc" | "desc" }[]
  /** Join clauses. */
  joins?: JoinClause[]
}

export type JoinType =
  | "join"
  | "left join"
  | "right join"
  | "full join"
  | "cross join"

export type JoinTarget = QuerySource.Data

export interface JoinClause {
  /** The type of join. */
  type: JoinType
  /** The target being joined — a table or a subquery. */
  target: JoinTarget
  /** Join conditions (ON clause). */
  on: JoinOn[]
  using?: string[]
}

export interface JoinOn {
  /** Left side of the ON condition. */
  left: ColumnIdentifier
  /** The comparison operator. */
  operator: BinaryOperator
  /** Right side of the ON condition. */
  right: ColumnIdentifier
}

/** Represents an update command. */
export interface UpdateCommand {
  /** Table being UPDATEd. */
  table: string
  /** Column-value assignments. */
  assignments: Record<string, unknown>
  /** Conditions of the UPDATE. */
  conditions?: Condition[]
  /** Returning clause. */
  returning?: string[]
}

/** Represents an insert command. */
export interface InsertCommand {
  /** Table being INSERTed to. */
  table: string
  /** Column names. */
  columns: string[]
  /** Row values to insert. */
  rows: Record<string, unknown>[]
  /** Returning clause. */
  returning?: string[]
}

/** Represents a delete command. */
export interface DeleteCommand {
  table: string
  conditions?: Condition[]
  returning?: string[]
}

export interface OrderBySort {
  column: string
  direction: "asc" | "desc"
}

/* Represents a condition. */
export type Condition = UnaryCondition | BinaryCondition

/** A unary condition. */
export interface UnaryCondition {
  column: string
  arity: 1
  operator: UnaryOperator
}

/** A binary condition. */
export interface BinaryCondition {
  column: string
  arity: 2
  operator: BinaryOperator
  // oxlint-disable-next-line typescript/no-explicit-any
  value: any
}
