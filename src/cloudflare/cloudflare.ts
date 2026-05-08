import type { D1Database } from "@cloudflare/workers-types"
import type { DefaultRow, Connection } from "../api/api.types"

export class CloudflareConnection implements Connection {
  private readonly d1: D1Database

  constructor(d1: D1Database) {
    this.d1 = d1
  }

  async query<Row = DefaultRow>(sql: string) {
    return (await this.d1.prepare(sql).run()).results as Row[]
  }

  async script(statements: string[]) {
    await this.d1.batch(statements.map((s) => this.d1.prepare(s)))
  }
}
