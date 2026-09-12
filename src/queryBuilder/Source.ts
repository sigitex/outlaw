import type { Connection } from "../api/api.types"
import { ColumnRef } from "../schemaBuilder/ColumnRef"
import type { ColumnData, TableData } from "../schemaBuilder/metadata"
import type { QueryScope } from "./QueryScope"
import type { SelectQuery, ColumnIdentifier } from "./queryBuilders.types"
import { SourceBuilder } from "./SourceBuilder"
import { Projection } from "./Projection"

export type Source<Name extends string, Columns extends QueryScope.Columns> = {
  readonly $source: Source.Data
  readonly $type: QueryScope.State<Name, Columns>
  readonly all: ColumnRef.Wildcard<Name>
  as<Alias extends string>(alias: Alias): Source<Alias, Columns>
} & {
  readonly [Key in keyof Columns & string]: ColumnRef<Name, Key>
} & QueryScope.Composition<QueryScope.Initial<QueryScope.State<Name, Columns>>>

export namespace Source {
  export type Data = (
    | { kind: "table"; name: string }
    | { kind: "subquery"; query: SelectQuery }
  ) & { alias?: string; tableData: TableData }

  export type Target = { readonly $type: QueryScope.State }
  export type Input = { readonly $source: Data } | { readonly query: SelectQuery }
  export type Scope = { sources: Data[]; output: ColumnData[] }

  export function create(data: Data, connection?: Connection): Source<string, QueryScope.Columns> {
    const source = snapshotSource(data)
    const name = qualifier(source)
    const result = Object.assign(new SourceBuilder(source, connection), {
      $source: source,
      all: { table: name, wildcard: true as const },
      as(alias: string) {
        return create({ ...source, alias }, connection)
      },
    })
    for (const column of source.tableData.columns) {
      Object.defineProperty(result, column.name, { value: ColumnRef.create(name, column.name), enumerable: true })
    }
    return result as unknown as Source<string, QueryScope.Columns>
  }

  export function target(input: Input): Data {
    if ("$source" in input) {
      return snapshotSource(input.$source)
    }
    const query = snapshot(input.query)
    return { kind: "subquery", query, tableData: { name: "", columns: Projection.columns(query), constraints: [] } }
  }

  export function qualifier(source: Data): string {
    return source.alias ?? (source.kind === "table" ? source.name : "")
  }

  export function snapshot(query: SelectQuery): SelectQuery {
    return {
      ...query,
      source: snapshotSource(query.source),
      selected: query.selected.map(projection => projection === "*" ? projection : { ...projection }),
      conditions: query.conditions?.map(condition => ({ ...condition })),
      orderBy: query.orderBy?.map(sort => ({ ...sort })),
      joins: query.joins?.map(clause => ({
        ...clause,
        target: snapshotSource(clause.target),
        on: clause.on.map(condition => ({ ...condition })),
        using: clause.using?.slice(),
      })),
    }
  }

  export function scope(query: SelectQuery): Scope {
    let sources = [query.source]
    let output = query.source.tableData.columns.slice()
    for (const clause of query.joins ?? []) {
      const right = clause.target
      const leftOutput = output
      const extendLeft = clause.type === "right join" || clause.type === "full join"
      const extendRight = clause.type === "left join" || clause.type === "full join"
      if (extendLeft) {
        sources = sources.map(nullableSource)
        output = output.map(nullableColumn)
      }
      const incoming = extendRight ? nullableSource(right) : right
      sources.push(incoming)
      if (clause.using?.length) {
        const common = new Set(clause.using)
        output = output.map(column => {
          if (!common.has(column.name)) return column
          const left = leftOutput.find(candidate => candidate.name === column.name)!
          const rightColumn = right.tableData.columns.find(candidate => candidate.name === column.name)!
          if (clause.type === "right join") return rightColumn
          if (clause.type === "full join") return Projection.merge([left, rightColumn])
          return left
        })
        output.push(...incoming.tableData.columns.filter(column => !common.has(column.name)))
      } else {
        output.push(...incoming.tableData.columns)
      }
    }
    return { sources, output }
  }

  export function identifier(scope: Scope, input: string | ColumnRef): ColumnIdentifier {
    if (typeof input !== "string") return { table: input.table || undefined, column: input.column }
    if (scope.output.some(column => column.name === input)) return { column: input }
    for (const source of scope.sources) {
      const name = qualifier(source)
      if (name && input.startsWith(`${name}.`)) return { table: name, column: input.slice(name.length + 1) }
    }
    return { column: input }
  }

  export function resolve(scope: Scope, identifier: ColumnIdentifier): ColumnData[] {
    if (identifier.table === undefined) return scope.output.filter(column => column.name === identifier.column)
    return scope.sources.filter(source => qualifier(source) === identifier.table)
      .flatMap(source => source.tableData.columns.filter(column => column.name === identifier.column))
  }

  function snapshotSource(source: Data): Data {
    return {
      ...source,
      ...(source.kind === "subquery" ? { query: snapshot(source.query) } : {}),
      tableData: { ...source.tableData, columns: source.tableData.columns.slice(), constraints: source.tableData.constraints.slice() },
    }
  }

  function nullableColumn(column: ColumnData): ColumnData {
    return { ...column, notNull: false, primaryKey: undefined }
  }

  function nullableSource(source: Data): Data {
    return { ...source, tableData: { ...source.tableData, columns: source.tableData.columns.map(nullableColumn) } }
  }
}
