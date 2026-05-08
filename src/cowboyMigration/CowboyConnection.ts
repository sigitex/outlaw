import type { Fixtures, Schema, SchemaMembers, Seeds } from "../schemaBuilder"
import type { Connection, DefaultRow } from "../api"
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
  private shotFirst = false

  constructor(raw: Connection, schema: Schema<SchemaMembers>, options?: CowboyOptions) {
    this.raw = raw
    this.schema = schema
    this.options = options ?? {}
  }

  async query<Row = DefaultRow>(sql: string) {
    if (!this.shotFirst) {
      await this.shotgun()
    }
    return this.raw.query(sql) as Promise<Row[]>
  }

  async script(statements: string[]) {
    if (!this.shotFirst) {
      await this.shotgun()
    }
    await this.raw.script(statements)
  }

  async reset() {
    this.shotFirst = false
  }

  private async shotgun() {
    this.shotFirst = true
    await new CowboyMigrator(this.raw, this.schema, this.options.hacks ?? []).migrate()
    const hasSeeds = this.options.seeds || (this.options.runFixtures && this.options.fixtures)
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
