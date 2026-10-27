# Reference Project Usage

The [nest-server-starter](https://github.com/lenneTech/nest-server-starter) serves as the source of truth.

**Except for the module format.** An ESM starter (`"type": "module"`) and a CommonJS project, or the
reverse, differ in `"type"`, tsconfig `module` / `isolatedModules`, `.js` suffixes on relative imports,
`import type` and `import.meta`. That is not drift to sync: carrying it into the other format breaks the
start. Converting a project to ESM is a separate, optional step (`SKILL.md` → "ESM projects are optional").

## What to Check

1. **package.json**
   - Compatible dependency versions
   - New/removed dependencies
   - Script changes

2. **src/config.env.ts**
   - New configuration options
   - Changed defaults

3. **src/server/modules/**
   - Updated patterns for modules/services
   - New decorators or utilities

4. **Git history**
   ```bash
   git log --oneline --all --grep="nest-server" | head -20
   ```
   - Find commits related to version updates
   - See exactly what changed
