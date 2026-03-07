# API Mode Awareness

Projects can operate in different API modes: **Rest**, **GraphQL**, or **Both**. The mode is stored in `lt.config.json` under `meta.apiMode`. If absent, assume "Both" (legacy).

## Impact on Updates

| API Mode | Missing Files (expected) | Missing Packages (expected) |
|----------|--------------------------|----------------------------|
| **Rest** | Resolvers (`*.resolver.ts`), `schema.gql` | `graphql-subscriptions`, `graphql-upload` |
| **GraphQL** | Controllers (`*.controller.ts` except `server.controller.ts`), `multer-config.service.ts` | `multer` |
| **Both** | None | None |

## Reference Project Comparison

The nest-server-starter uses `// #region graphql` and `// #region rest` markers. When comparing:
- **Rest project**: Ignore code inside `// #region graphql` blocks and resolver files
- **GraphQL project**: Ignore code inside `// #region rest` blocks and controller files
- **Both project**: All code applies (markers have been stripped)

The `config.env.ts` in Rest projects uses `graphQl: false` instead of `graphQl: { ... }`.
