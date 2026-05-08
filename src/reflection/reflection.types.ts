export type TableListType = "table" | "view" | "shadow" | "virtual"

export type TableListItem = {
  readonly schema: string
  readonly name: string
  readonly type: TableListType
  /** Number of columns **/
  readonly ncol: number
  /** WITHOUT ROWID */
  readonly wr: number
  strict: number
}
