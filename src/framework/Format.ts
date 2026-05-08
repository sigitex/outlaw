import * as SqlString from "sqlstring-sqlite"

export namespace Format {
  export const NOW = "strftime('%Y-%m-%dT%H:%M:%S.%fZ', 'now')"

  export function text(text: string) {
    return SqlString.escape(text)
  }

  export function name(name: string | null | undefined) {
    return SqlString.escapeId(name)
  }

  export function number(number: number) {
    if (typeof number !== "number" && typeof number !== "bigint") {
      throw new Error("Not a number.")
    }
    const s = number.toString()
    return number < 0 ? `(${s})` : s
  }

  export function value(value: unknown): string {
    if (value === null || value === undefined) {
      return "null"
    }
    if (typeof value === "number" || typeof value === "bigint") {
      return Format.number(Number(value))
    }
    return Format.text(String(value))
  }
}
