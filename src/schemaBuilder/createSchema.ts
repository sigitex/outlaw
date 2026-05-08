import type { Schema, SchemaMembers } from "./schemaBuilder.types"

export function createSchema<M extends SchemaMembers>(
  members: M,
): Schema<M> {
  const tables: Record<string, unknown> = {}
  const views: Record<string, unknown> = {}
  const indexes: Record<string, unknown> = {}
  for (const [key, member] of Object.entries(members)) {
    switch (member.$kind) {
      case "table":
        tables[key] = member
        break
      case "view":
        views[key] = member
        break
      case "index":
        indexes[key] = member
        break
    }
  }
  return { tables, views, indexes } as Schema<M>
}
