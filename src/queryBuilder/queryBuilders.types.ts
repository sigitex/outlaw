// oxlint-disable typescript/consistent-type-definitions -- review
import type { BinaryOperator, UnaryOperator } from "../api/api.types"
import type { ColumnRef, TableData } from "../schemaBuilder"

/** Represents a select query. */
export interface SelectQuery {
  /** Table this query is performed on. */
  table: string
  /** Limit clause. */
  limit?: number
  /** Offset clause. */
  offset?: number
  /** Conditions of the SELECT. */
  conditions?: Condition[]
  /** Which columns are being selected in this query. */
  selected?: string[]
  /** Order By clause */
  orderBy?: OrderBySort[]
  /** Join clauses. */
  joins?: JoinClause[]
}

export type JoinType = "join" | "left join" | "right join" | "cross join"

export type JoinTarget =
  | { kind: "table"; name: string; tableData: TableData }
  | {
      kind: "subquery"
      table: string
      query: SelectQuery
      tableData: TableData
    }

export interface JoinClause {
  /** The type of join. */
  type: JoinType
  /** The target being joined — a table or a subquery. */
  target: JoinTarget
  /** Join conditions (ON clause). */
  on: JoinOn[]
}

export interface JoinOn {
  /** Left side of the ON condition. */
  left: ColumnRef
  /** The comparison operator. */
  operator: BinaryOperator
  /** Right side of the ON condition. */
  right: ColumnRef
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
