import type { Database } from "bun:sqlite"
import type { DefaultRow, Connection } from "../api/api.types"

export class BunConnection implements Connection {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  async query<Row = DefaultRow>(sql: string) {
    return this.db.query(sql).all() as Row[]
  }

  async script(statements: string[]) {
    this.db.run("BEGIN")
    try {
      for (const s of statements) {
        this.db.run(s)
      }
      this.db.run("COMMIT")
    } catch (error) {
      this.db.run("ROLLBACK")
      throw error
    }
  }
}
