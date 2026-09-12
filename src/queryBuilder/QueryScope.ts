import type { BinaryOperator, UnaryOperator } from "../api/api.types"
import type { ColumnRef } from "../schemaBuilder/ColumnRef"
import type { InferColumn } from "../schemaBuilder/schemaBuilder.types"
import type { Source } from "./Source"
import type { JoinType } from "./queryBuilders.types"

export type QueryScope = {
  sources: readonly QueryScope.State[]
  output: QueryScope.Entry
}

export namespace QueryScope {
  export type Column = { value: unknown; mapped: boolean }
  export type Columns = Record<string, Column>
  export type State<
    Name extends string = string,
    Fields extends Columns = Columns,
  > = {
    name: Name
    columns: Fields
  }
  export type Entry = {
    name: string
    value: unknown
    mapped: boolean
    origin: string
  }
  export type SchemaColumns<Fields> = {
    [Key in keyof Fields & string]: {
      value: InferColumn<Fields[Key]>
      mapped: Fields[Key] extends { readonly $defined?: infer Defined }
        ? "map" extends Defined
          ? true
          : false
        : false
    }
  }
  export type Of<Target> = Target extends {
    readonly $type: infer Shape extends State
  }
    ? Shape
    : never
  export type Initial<Shape extends State> = {
    sources: [Shape]
    output: Entries<Shape>
  }
  export type Entries<Shape extends State> = {
    [Key in keyof Shape["columns"] & string]: {
      value: Shape["columns"][Key]["value"]
      mapped: Shape["columns"][Key]["mapped"]
      name: Key
      origin: `${Shape["name"]}.${Key}`
    }
  }[keyof Shape["columns"] & string]

  export type Identifier<Scope extends QueryScope> =
    | Scope["output"]["name"]
    | SourceIdentifiers<Scope["sources"][number]>
  export type Projection<Scope extends QueryScope> =
    | Identifier<Scope>
    | "*"
    | Wildcards<Scope["sources"][number]>
  export type Resolve<Scope extends QueryScope, Input> = Input extends {
    table: infer Table
    column: infer Key
  }
    ? Qualified<Scope, Table, Key>
    : Input extends Scope["output"]["name"]
      ? Extract<Scope["output"], { name: Input }>
      : Input extends `${infer Table}.${infer Key}`
        ? Qualified<Scope, Table, Key>
        : never

  export type Project<
    Scope extends QueryScope,
    Inputs extends readonly unknown[],
  > = Collapse<
    Inputs extends readonly []
      ? Scope["output"]
      : ProjectEntry<Scope, Inputs[number]>
  >
  export type Values<Fields extends Columns> = {
    [Key in keyof Fields]: Fields[Key]["value"]
  }

  export type Join<
    Scope extends QueryScope,
    Right extends State,
    Kind extends JoinType,
  > = {
    sources: [
      ...ExtendSources<Scope["sources"], Kind>,
      ExtendRight<Right, Kind>,
    ]
    output:
      | ExtendLeft<Scope["output"], Kind>
      | Entries<ExtendRight<Right, Kind>>
  }
  export type Using<
    Scope extends QueryScope,
    Right extends State,
    Kind extends JoinType,
    Keys extends string,
  > = {
    sources: Join<Scope, Right, Kind>["sources"]
    output:
      | Exclude<Join<Scope, Right, Kind>["output"], { name: Keys }>
      | Common<Scope, Right, Kind, Keys>
  }

  export type Composition<
    Scope extends QueryScope,
    Executable extends boolean = false,
  > = {
    select<const Inputs extends readonly Projection<Scope>[]>(
      ...columns: Inputs
    ): Selection<Project<Scope, Inputs>, Scope, Executable>
    join<Target extends Source.Target>(
      target: Target,
    ): Joined<Scope, Of<Target>, "join", Executable>
    leftJoin<Target extends Source.Target>(
      target: Target,
    ): Joined<Scope, Of<Target>, "left join", Executable>
    rightJoin<Target extends Source.Target>(
      target: Target,
    ): Joined<Scope, Of<Target>, "right join", Executable>
    fullJoin<Target extends Source.Target>(
      target: Target,
    ): Joined<Scope, Of<Target>, "full join", Executable>
    crossJoin<Target extends Source.Target>(
      target: Target,
    ): Joined<Scope, Of<Target>, "cross join", Executable>
  }
  export type Joined<
    Left extends QueryScope,
    Right extends State,
    Kind extends JoinType,
    Executable extends boolean,
    Constraint extends "none" | "on" = "none",
  > = Composition<Join<Left, Right, Kind>, Executable> & {
    on(
      left: Identifier<Join<Left, Right, Kind>>,
      operator: BinaryOperator,
      right: Identifier<Join<Left, Right, Kind>>,
    ): Joined<Left, Right, Kind, Executable, "on">
  } & (Constraint extends "none"
      ? {
          using<
            const Keys extends readonly [
              Left["output"]["name"] & keyof Right["columns"] & string,
              ...(Left["output"]["name"] & keyof Right["columns"] & string)[],
            ],
          >(
            ...columns: Keys
          ): Composition<Using<Left, Right, Kind, Keys[number]>, Executable>
        }
      : {})

  export type Selection<
    Fields extends Columns,
    Scope extends QueryScope,
    Executable extends boolean = false,
  > = {
    readonly $type: State<"", Fields>
    as<Name extends string>(name: Name): Source<Name, Fields>
    where<const Input extends Identifier<Scope>>(
      column: Input,
      value: Value<Resolve<Scope, NoInfer<Input>>> | UnaryOperator,
    ): Selection<Fields, Scope, Executable>
    where<const Input extends Identifier<Scope>>(
      column: Input,
      operator: BinaryOperator,
      value: Value<Resolve<Scope, NoInfer<Input>>>,
    ): Selection<Fields, Scope, Executable>
    orderBy(
      sorts: readonly (readonly [
        Identifier<Scope> | (keyof Fields & string),
        "asc" | "desc",
      ])[],
    ): Selection<Fields, Scope, Executable>
    limit(count: number): Selection<Fields, Scope, Executable>
    offset(count: number): Selection<Fields, Scope, Executable>
  } & (Executable extends true
    ? {
        fetch(): Promise<Values<Fields>[]>
        first(): Promise<Values<Fields>>
      }
    : {})

  type SourceIdentifiers<Shape extends State> = Shape extends State
    ? {
        [Key in keyof Shape["columns"] & string]:
          | ColumnRef<Shape["name"], Key>
          | (Shape["name"] extends "" ? never : `${Shape["name"]}.${Key}`)
      }[keyof Shape["columns"] & string]
    : never
  type Wildcards<Shape extends State> = Shape extends State
    ? ColumnRef.Wildcard<Shape["name"]>
    : never
  type Qualified<Scope extends QueryScope, Name, Key> =
    Entries<
      Extract<Scope["sources"][number], { name: Name }>
    > extends infer Fields
      ? Extract<Fields, { name: Key }>
      : never
  type ProjectEntry<Scope extends QueryScope, Input> = Input extends "*"
    ? Scope["output"]
    : Input extends { table: infer Table; wildcard: true }
      ? Entries<Extract<Scope["sources"][number], { name: Table }>>
      : Input extends { alias: infer Alias extends string }
        ? Rename<Resolve<Scope, Input>, Alias>
        : Resolve<Scope, Input>
  type Rename<Fields extends Entry, Name extends string> = Fields extends Entry
    ? Omit<Fields, "name"> & { name: Name }
    : never
  type IsUnion<Value, Whole = Value> = Value extends Whole
    ? [Whole] extends [Value]
      ? false
      : true
    : never
  type Value<Fields extends Entry> =
    true extends IsUnion<Fields["origin"]>
      ? true extends Fields["mapped"]
        ? unknown
        : Fields["value"]
      : Fields["value"]
  type Collapse<Fields extends Entry> = {
    [Name in Fields["name"]]: {
      value: Value<Extract<Fields, { name: Name }>>
      mapped: true extends IsUnion<Extract<Fields, { name: Name }>["origin"]>
        ? false
        : Extract<Fields, { name: Name }>["mapped"]
    }
  }
  type Nullable<Fields extends Columns> = {
    [Key in keyof Fields]: {
      value: Fields[Key]["value"] | null
      mapped: Fields[Key]["mapped"]
    }
  }
  type ExtendSources<
    Sources extends readonly State[],
    Kind extends JoinType,
  > = {
    [Index in keyof Sources]: Kind extends "right join" | "full join"
      ? State<Sources[Index]["name"], Nullable<Sources[Index]["columns"]>>
      : Sources[Index]
  }
  type ExtendRight<Right extends State, Kind extends JoinType> = Kind extends
    | "left join"
    | "full join"
    ? State<Right["name"], Nullable<Right["columns"]>>
    : Right
  type ExtendLeft<
    Fields extends Entry,
    Kind extends JoinType,
  > = Fields extends Entry
    ? Kind extends "right join" | "full join"
      ? Omit<Fields, "value"> & { value: Fields["value"] | null }
      : Fields
    : never
  type Common<
    Scope extends QueryScope,
    Right extends State,
    Kind extends JoinType,
    Keys extends string,
  > = Kind extends "right join"
    ? Extract<Entries<Right>, { name: Keys }>
    : Kind extends "full join"
      ? Extract<Scope["output"] | Entries<Right>, { name: Keys }>
      : Extract<Scope["output"], { name: Keys }>
}
