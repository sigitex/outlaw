import type { Fixtures, Schema, SchemaMembers, Seeds } from "../schemaBuilder"
import type { Connection, DefaultRow, Transaction } from "../api"
import type { SchemaHack } from "./cowboyMigration.types"
import { CowboyMigrator } from "./CowboyMigrator"
import { CowboySeeder } from "./CowboySeeder"

export type CowboyOptions = {
  hacks?: SchemaHack[]
  seeds?: Seeds
  fixtures?: Fixtures
  runFixtures?: boolean
}

export class CowboyConnection implements Connection {
  private readonly raw: Connection
  private readonly schema: Schema<SchemaMembers>
  private readonly options: CowboyOptions
  private readiness?: Promise<void>
  readonly transaction?: Transaction

  constructor(
    raw: Connection,
    schema: Schema<SchemaMembers>,
    options?: CowboyOptions,
  ) {
    this.raw = raw
    this.schema = schema
    this.options = options ?? {}
    const transaction = raw.transaction?.bind(raw)
    if (transaction) {
      this.transaction = async (work) => {
        await this.ready()
        return transaction(work)
      }
    }
  }

  async query<Row = DefaultRow>(sql: string) {
    await this.ready()
    return this.raw.query(sql) as Promise<Row[]>
  }

  async script(statements: string[]) {
    await this.ready()
    await this.raw.script(statements)
  }

  async reset() {
    try {
      await this.readiness
    } catch {
      // A failed initialization is already reset by ready().
    }
    this.readiness = undefined
  }

  private ready() {
    if (this.readiness) {
      return this.readiness
    }

    const readiness = this.shotgun().catch((error: unknown) => {
      if (this.readiness === readiness) {
        this.readiness = undefined
      }
      throw error
    })
    this.readiness = readiness
    return readiness
  }

  private async shotgun() {
    await new CowboyMigrator(
      this.raw,
      this.schema,
      this.options.hacks ?? [],
    ).migrate()
    const hasSeeds =
      this.options.seeds || (this.options.runFixtures && this.options.fixtures)
    if (hasSeeds) {
      await new CowboySeeder(
        this.raw,
        this.options.seeds ?? {},
        this.options.fixtures ?? {},
        this.options.runFixtures ?? false,
      ).seed()
    }
  }
}
