// oxlint-disable typescript/consistent-type-definitions
declare global {
  interface Console {
    log(...args: unknown[]): void
    error(...args: unknown[]): void
    warn(...args: unknown[]): void
    info(...args: unknown[]): void
    debug(...args: unknown[]): void
  }

  var console: Console
}

export {}
