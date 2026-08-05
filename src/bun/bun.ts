import type { Database } from "bun:sqlite"
import type {
  Connection,
  DefaultRow,
  TransactionalConnection,
  TransactionWork,
} from "../api/api.types"

type TransactionState = {
  active: boolean
  nextSavepoint: number
}

export class BunConnection implements Connection {
  private readonly db: Database
  private pending = Promise.resolve()

  constructor(db: Database) {
    this.db = db
  }

  async query<Row = DefaultRow>(sql: string) {
    return this.exclusive(() => query<Row>(this.db, sql))
  }

  async script(statements: string[]) {
    await this.exclusive(() => script(this.db, statements, "BEGIN"))
  }

  async transaction<Result>(work: TransactionWork<Result>) {
    return this.exclusive(async () => {
      await run(this.db, "BEGIN IMMEDIATE")
      const state: TransactionState = { active: true, nextSavepoint: 0 }
      const connection = new BunTransactionConnection(this.db, state)

      try {
        const result = await work(connection)
        connection.close()
        await run(this.db, "COMMIT")
        return result
      } catch (error) {
        connection.close()
        await run(this.db, "ROLLBACK")
        throw error
      } finally {
        state.active = false
      }
    })
  }

  private async exclusive<Result>(work: () => Promise<Result>) {
    const previous = this.pending
    let release!: () => void
    this.pending = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous
    try {
      return await work()
    } finally {
      release()
    }
  }
}

class BunTransactionConnection implements TransactionalConnection {
  private readonly db: Database
  private readonly state: TransactionState
  private active = true

  constructor(db: Database, state: TransactionState) {
    this.db = db
    this.state = state
  }

  async query<Row = DefaultRow>(sql: string) {
    this.assertActive()
    return query<Row>(this.db, sql)
  }

  async script(statements: string[]) {
    this.assertActive()
    await this.transaction(async (connection) => {
      for (const statement of statements) {
        await connection.query(statement)
      }
    })
  }

  async transaction<Result>(work: TransactionWork<Result>) {
    this.assertActive()
    const name = `outlaw_transaction_${++this.state.nextSavepoint}`
    await run(this.db, `SAVEPOINT ${name}`)
    const connection = new BunTransactionConnection(this.db, this.state)

    try {
      const result = await work(connection)
      connection.close()
      await run(this.db, `RELEASE SAVEPOINT ${name}`)
      return result
    } catch (error) {
      connection.close()
      await run(this.db, `ROLLBACK TO SAVEPOINT ${name}`)
      await run(this.db, `RELEASE SAVEPOINT ${name}`)
      throw error
    }
  }

  close() {
    this.active = false
  }

  private assertActive() {
    if (!this.active || !this.state.active) {
      throw new Error("Transaction connection is no longer active.")
    }
  }
}

async function query<Row>(db: Database, sql: string) {
  return db.query(sql).all() as Row[]
}

async function run(db: Database, sql: string) {
  db.run(sql)
}

async function script(db: Database, statements: string[], begin: "BEGIN") {
  await run(db, begin)
  try {
    for (const statement of statements) {
      await run(db, statement)
    }
    await run(db, "COMMIT")
  } catch (error) {
    await run(db, "ROLLBACK")
    throw error
  }
}
