# Reference Project Usage

The [nest-server-starter](https://github.com/lenneTech/nest-server-starter) serves as the source of truth.

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
