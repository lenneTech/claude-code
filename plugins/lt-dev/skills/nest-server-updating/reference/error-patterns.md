# Common Error Patterns & Solutions

## TypeScript Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot find module '@lenne.tech/nest-server/...'` | Import path changed | Check migration guide for new paths |
| `Type 'X' is not assignable to type 'Y'` | API type changed | Update to new type signature per guide |
| `Property 'X' does not exist` | API removed/renamed | Check migration guide for replacement |

## Runtime Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Decorator not found` | Decorator moved | Import from new location |
| `Cannot read property of undefined` | Initialization changed | Check startup sequence in reference project |
| `Module not found` | Peer dependency missing | Compare package.json with reference project |

## Test Failures

| Symptom | Cause | Solution |
|---------|-------|----------|
| Timeout errors | Async behavior changed | Check test patterns in reference project |
| Auth failures | Auth mechanism updated | Review auth changes in migration guide |
| Validation errors | DTO changes | Update DTOs per migration guide |
