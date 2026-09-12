import { print } from "@sigitex/print"
import { generateSelectNode } from "../queryGenerator/generateSelect"
import type { SelectQueryBuilder } from "../queryBuilder/SelectQueryBuilder"
import { Projection } from "../queryBuilder/Projection"
import type { QueryScope } from "../queryBuilder/QueryScope"
import { Source } from "../queryBuilder/Source"
import type { TableData, ViewData } from "./metadata"
import type { BuildView } from "./schemaBuilder.types"

export function createView<
  Name extends string,
  Columns extends QueryScope.Columns,
>(
  name: Name,
  queryBuilder: { readonly $type: QueryScope.State<"", Columns> },
): BuildView<Columns, Name> {
  const builder = queryBuilder as unknown as SelectQueryBuilder
  const sql = print([generateSelectNode(builder.query)])
  const $meta: ViewData = { kind: "view", name, sql }
  const $tableData: TableData = {
    name,
    columns: Projection.columns(builder.query),
    constraints: [],
  }
  return Object.assign(
    Source.create({ kind: "table", name, tableData: $tableData }),
    {
      $kind: "view" as const,
      $meta,
      $tableData,
    },
  ) as unknown as BuildView<Columns, Name>
}
