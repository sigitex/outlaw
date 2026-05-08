// oxlint-disable typescript/no-explicit-any
import { print } from "@sigitex/print"
import { generateSelectNode } from "../queryGenerator/generateSelect"
import type { SelectQueryBuilder } from "../queryBuilder/SelectQueryBuilder"
import type { TableData, ViewData } from "./metadata"
import type { BuildView, SchemaSelect } from "./schemaBuilder.types"

export function createView<SelectColumns>(
  name: string,
  queryBuilder: SchemaSelect<SelectColumns, any>,
): BuildView<SelectColumns> {
  const builder = queryBuilder as unknown as SelectQueryBuilder
  const sql = print([generateSelectNode(builder.query)])
  const $meta: ViewData = { kind: "view", name, sql }
  const allColumns = [
    ...builder.table.columns,
    ...(builder.query.joins?.flatMap(j => j.target.tableData.columns) ?? []),
  ]
  const $tableData: TableData = { name, columns: allColumns, constraints: [] }
  return { $kind: "view", $meta, $tableData }
}
