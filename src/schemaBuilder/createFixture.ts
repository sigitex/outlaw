// oxlint-disable typescript/no-explicit-any
import type { AnyBuildTable, InferTable, RefBy } from "./schemaBuilder.types"

export type Fixtures = {
  [key: string]: Fixture<any>
}

export type Seeds = Fixtures

export type FixtureRow<Table> = {
  [K in keyof InferTable<Table>]: InferTable<Table>[K] | RefBy
}

export type Fixture<Table> = {
  table: Table
  rows: FixtureRow<Table>[]
}

export namespace Fixture {
  export function isRefBy(value: unknown): value is RefBy {
    return (
      value != null &&
      typeof value === "object" &&
      (value as any)._tag === "RefBy"
    )
  }
}

// TODO: just call it Row<Table>, avoid this alias
type Row<Table> = InferTable<Table>

type AllowRefBy<T> = T | RefBy

export type FixtureTemplate<Table> = {
  [K in keyof Row<Table>]?: AllowRefBy<Row<Table>[K]> | (() => Row<Table>[K])
}

type TemplateKeys<Template> = keyof {
  [K in keyof Template as Template[K] extends undefined ? never : K]: true
}

type NullableKeys<T> = {
  [K in keyof T]: null extends T[K] ? K : never
}[keyof T]

type RequiredRows<Table, Template> = {
  [K in keyof Omit<
    Row<Table>,
    TemplateKeys<Template> | NullableKeys<Row<Table>>
  >]: AllowRefBy<Row<Table>[K]>
}

type OptionalRows<Table, Template> = Partial<{
  [K in (TemplateKeys<Template> | NullableKeys<Row<Table>>) &
    keyof Row<Table>]: AllowRefBy<Row<Table>[K]>
}>

export type FixtureRows<Table, Template> = RequiredRows<Table, Template> &
  OptionalRows<Table, Template>

export function createFixture<
  Table extends AnyBuildTable,
  const Template extends FixtureTemplate<Table>,
>(
  table: Table,
  template: Template,
  rows: FixtureRows<Table, Template>[],
): Fixture<Table>

export function createFixture<Table extends AnyBuildTable>(
  table: Table,
  rows: InferTable<Table>[],
): Fixture<Table>

export function createFixture(
  table: AnyBuildTable,
  templateOrRows: Record<string, unknown> | Record<string, unknown>[],
  maybeRows?: Record<string, unknown>[],
): Fixture<AnyBuildTable> {
  if (Array.isArray(templateOrRows)) {
    return { table, rows: templateOrRows } as any
  }

  const template = templateOrRows
  const rows = maybeRows!

  const nullableKeys = table.$meta.columns
    .filter((col) => !col.notNull && !col.primaryKey)
    .map((col) => col.name)

  return {
    table,
    rows: rows.map((row) => {
      const result: Record<string, unknown> = { ...row }
      for (const key of nullableKeys) {
        if (!(key in result) && !(key in template)) {
          result[key] = null
        }
      }
      for (const key in template) {
        if (key in row) {
          continue
        }
        const value = template[key]
        result[key] = typeof value === "function" ? value() : value
      }
      return result
    }),
  } as any
}

export const createSeed = createFixture
