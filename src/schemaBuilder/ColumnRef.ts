export type ColumnRef<Table extends string = string, Column extends string = string> = {
  readonly table: Table
  readonly column: Column
  as<Alias extends string>(alias: Alias): ColumnRef.Aliased<Table, Column, Alias>
}

export namespace ColumnRef {
  export type Aliased<Table extends string, Column extends string, Alias extends string> =
    ColumnRef<Table, Column> & { readonly alias: Alias }

  export type Wildcard<Table extends string = string> = {
    readonly table: Table
    readonly wildcard: true
  }

  export function create<Table extends string, Column extends string>(table: Table, column: Column): ColumnRef<Table, Column> {
    return {
      table,
      column,
      as(alias) {
        return { ...create(table, column), alias }
      },
    }
  }
}
