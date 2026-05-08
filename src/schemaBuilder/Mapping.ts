export type Mapping<From, To> = {
  from(value: From): To
  to(value: To): From
}

export namespace Mapping {
  export const boolean: Mapping<number, boolean> = {
    from(n) {
      return n !== 0
    },
    to(b) {
      return b ? 1 : 0
    },
  }

  export const timestamp: Mapping<number, Date> = {
    from(n) {
      return new Date(n)
    },
    to(d) {
      return d.getTime()
    },
  }

  export const date: Mapping<string, Date> = {
    from(s) {
      return new Date(s)
    },
    to(d) {
      return d.toISOString()
    },
  }

  export function json<T>(): Mapping<string, T> {
    return {
      from(s) {
        return JSON.parse(s) as T
      },
      to(o) {
        return JSON.stringify(o)
      },
    }
  }
}
