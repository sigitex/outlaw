// oxlint-disable typescript/no-explicit-any

export const UNARY_OPERATORS = [
  "is null",
  "is not null",
] as const

export const BINARY_OPERATORS = [
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "like",
  "not like",
  "glob",
  "not glob",
  "match",
  "not match",
  "regexp",
  "not regexp",
  "in",
  "not in",
  "is",
  "is not",
] as const

export function isUnaryOperator(o: string) {
  return UNARY_OPERATORS.includes(o as any)
}

export function isBinaryOperator(o: string) {
  return BINARY_OPERATORS.includes(o as any)
}
