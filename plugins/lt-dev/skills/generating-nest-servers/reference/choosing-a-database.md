# Choosing a Database

From nest-server 12.1.0 on, a project stores its data in **MongoDB** (the default), **PostgreSQL**,
**MySQL 8.4 / MariaDB 11.8**, or in several of them, model by model. Every framework module runs on
each, behind one `CrudService` and one security pipeline, and so does login (Better-Auth / IAM, on
MySQL and MariaDB from 12.1.1 on). The framework's own documents are the source of truth; read them
for configuration detail before writing any of it:

- Decision procedure: <https://github.com/lenneTech/nest-server/blob/main/docs/choosing-a-database.md>
- Code rules: <https://github.com/lenneTech/nest-server/blob/main/.claude/rules/persistence.md>
- Migration: `migration-guides/12.0.x-to-12.1.x.md` (§3 PostgreSQL, §7 MySQL / MariaDB) and
  `12.1.0-to-12.1.1.md` in the nest-server repository

This file is how lt-dev applies them.

## When the question comes up

| Situation | What is decided |
|---|---|
| A new project (`lt fullstack init`, an empty `projects/api`) | Database and SQL engine, by the procedure below |
| A new module with data of its own in an existing project | Only whether it stays in the project's database (the default) or the project becomes hybrid. Hybrid needs a reason the procedure accepts |
| Anything else in an existing project | Nothing: the project's database stands. Moving databases is a data migration, never a side effect of a feature |

**Read the recorded decision first.** A `## Database` section in the repository's root `CLAUDE.md`
settles the question; it is not asked again.

## The procedure

Work through the steps in order; the first one that decides, decides.

1. **An external requirement wins.** The customer's operations team runs one database, a hosting
   contract names one, an existing system the project must read is one: take that database. It
   must be at least MySQL 8.4, MariaDB 11.8 or PostgreSQL 15; an older server is named to the user
   before anything is decided. A service that stores nothing still needs none (step 6).
2. **PostgreSQL** when the data is relational or reported on: accounting, invoices, bookings,
   inventory, anything with joins, sums across records or reports a finance team reads; or when
   tenant isolation must be enforced by the database itself (forced row-level security on every
   tenant-scoped table, so a query that forgets its tenant returns nothing).
3. **MongoDB** for document-shaped data (nested content, free-form attributes, structures that
   change per customer) and whenever the signals above are absent. An existing MongoDB project stays
   on MongoDB.
4. **Hybrid** only with a concrete reason, written down, and its cost named: two databases to run,
   back up and monitor, no transaction across them, references between them resolved in the
   application. Routed per model with `database.models`.
5. **MySQL / MariaDB** only when step 1 requires it. Login works there from nest-server 12.1.1 on (a
   project with IAM needs at least that version). The project writes into its own documentation what
   it gives up:
   - **No row-level security.** Tenant isolation lives in the application only: a query through
     `store.native()`, `store.raw()` or a connection of the project's own reaches every tenant's
     rows unless it filters by `tenantId` itself.
   - **Schema changes need the owner connection** (`database.ownerUrl`), Better-Auth's table
     creation included, and are not transactional: a failed change leaves the statements before it
     applied.
   - **An indexed text field holds at most 255 characters**; indexing an existing text field later
     is a reviewed migration.
6. **No database** (`database: false`) for a stateless service: a gateway, a renderer, a worker that
   only talks to other APIs.

**Who decides.** The database outlives every ticket, so in a decision round
([`grilling-decisions`](../../grilling-decisions/SKILL.md)) it is put to the user with the
procedure's result as the recommendation, unless the ticket or a recorded decision already names
it; clear signals make the recommendation easy, not the question unnecessary. Without a user to
ask (a blueprint, an unattended run), the result is recorded with `Claude, to be confirmed` as
decider, and ambiguous signals are named as the open point.

## The SQL engine

On every SQL database the framework compiles the queries itself; the engine only carries them, so
the choice changes neither behaviour, tables nor security, and switching later is configuration
(`database.sqlEngine`). Only code that uses an engine's native API (`store.native()`) does not move.

| Engine | When |
|---|---|
| **TypeORM** (default) | unless the team asks for another |
| **Kysely** | the team writes typed SQL by hand and wants the builder it knows |
| **Drizzle** | the team already uses Drizzle elsewhere (pinned to an exact release candidate until 1.0 GA) |

## Record the decision

The decision goes into the repository's root `CLAUDE.md`, so the next developer or agent does not
re-decide it. lt-dev's `detect-lt-dev` hook reads the first two lines and shows them next to the
project's dev URLs:

```markdown
## Database

- Database: PostgreSQL
- SQL engine: TypeORM
- Decided: 2026-11-03, <who decided: a name, or "Claude, confirmed by <name>">
- Reason: <the signal and the step of the procedure, in one sentence; MySQL / MariaDB with login: "nest-server 12.1.1 or newer">
- Gives up: <MySQL / MariaDB: the three points of step 5 | hybrid: the named cost | "nothing">
```

`Database` takes `MongoDB`, `PostgreSQL`, `MySQL 8.4`, `MariaDB 11.8`, `PostgreSQL + MongoDB (hybrid: <models>)`
or `none`; `SQL engine` is `TypeORM`, `Kysely`, `Drizzle`, or `-` without SQL.

## Worked briefings

| Briefing | Decision | Step |
|---|---|---|
| Content platform; every customer arranges pages from nested blocks with free-form attributes | MongoDB, engine `-` | 3: document-shaped, no relational signal |
| Booking and invoicing; the finance team reads monthly revenue reports | PostgreSQL, TypeORM | 2: relational and reported on |
| The customer's operations team runs MariaDB only; users log in | MariaDB 11.8, TypeORM, `Reason:` names nest-server 12.1.1 or newer; `Gives up:` no row-level security (tenant filter in native queries), owner connection for schema changes, not transactional, indexed text up to 255 characters | 1, then 5 |
| A new "documents" module in an existing MongoDB CRM | stays MongoDB, no new decision | the project's database stands |

## Code on a SQL database

| Do | Never |
|---|---|
| Declare models with `Schema`, `Prop`, `SchemaFactory`, `InjectModel` from `@lenne.tech/nest-server` and register them with `CorePersistenceModule.forFeature()` | `MongooseModule.forFeature()` for a model that may live in SQL: it stays on MongoDB and nothing routes it |
| Reach data through the `CrudService`, or `this.dataStore` for the fast path (`insert`, `updateById`, `findById`) | `this.mainDbModel.find(…)`: on a model routed to SQL the Mongoose model refuses every data method |
| Native access as `store.native(reason)` / `store.raw(reason)` with a reason of at least 20 characters (it is logged), parameters only, identifiers never from input. Columns are snake_case there (`tenant_id`, `created_at`) | Interpolate a value or an identifier into SQL |
| On MySQL / MariaDB, filter every native query on a tenant-scoped table by the request's tenant (`RequestContext.getTenantId()`, refused when undefined) on `tenant_id`, and set it on every native write | Rely on the database for tenant isolation there: it has none |
| Return native rows to a client only through named columns without secrets, or mapped to the model: raw rows carry snake_case keys (`password_reset_token`), which the interceptor's camelCase `secretFields` never match before nest-server 12.3.1; from 12.3.1 on it strips only the `security.secretFields` entries, so a secret column outside that list (Better Auth's `session.token`, `account.access_token`, a token column of the project's own) reaches the client in every version, and every raw row skips the model's `securityCheck` and `@Restricted` fields unless the route declares `@ResponseModel`. Return the rows, never the driver's result object (`Result` from node-postgres): the interceptor does not enter it, so every column reaches the client, `password` included | `SELECT *` or `RETURNING *` returned unmapped; the driver's result object returned instead of its rows |
| Let the framework create and evolve tables; a change it refuses becomes a migration (`migrate create <name> --sql`) | Enable an engine's own `synchronize` or migration generator |

What a project installs: MongoDB `mongoose`, `@nestjs/mongoose`, `mongodb`; PostgreSQL `pg` plus
the engine (`typeorm`, `kysely` or `drizzle-orm`) and none of MongoDB's packages in npm mode;
MySQL / MariaDB `mysql2` plus the engine. A vendor-mode project declares `pg` (with `@types/pg`),
`mysql2`, `typeorm`, `kysely` and `drizzle-orm` at least as `devDependencies` whatever its
database, and on SQL alone keeps `mongoose`, `@nestjs/mongoose` and `mongodb` as `devDependencies`,
because TypeScript resolves every package the vendored core imports (TS2307 otherwise).
