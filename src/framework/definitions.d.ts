declare module "sqlstring-sqlite" {
  export function escape(text: string | null | undefined): string
  export function escapeId(text: string | null | undefined): string
}
