# Migration Guide System

## File Naming Convention

Migration guides in `migration-guides/` follow these patterns:

| Pattern | Example | Scope |
|---------|---------|-------|
| `X.Y.Z-to-X.Y.W.md` | `11.43.1-to-11.43.2.md` | Patch step (only where the patch needs action) |
| `X.Y.x-to-X.Z.x.md` or `X.Y.x-to-X.Z.0.md` | `11.42.x-to-11.43.x.md`, `11.17.x-to-11.18.0.md` | Minor step |
| `X.Y.x-to-W.0.x.md` | `11.43.x-to-12.0.x.md` | Major step, from the last minor of the old major |

There is no `X.x-to-Y.x.md`: a major step is always written from the last minor of the old major, so it
assumes every guide of that major has been applied before it. `TEMPLATE.md` in the same directory is no guide.

## Guide Selection Logic

For an update from version `CURRENT` to `TARGET`:

1. **List available guides:**
   ```bash
   gh api repos/lenneTech/nest-server/contents/migration-guides --jq '.[].name'
   ```

2. **Select by "from" version, not by substring match.** Include a guide when its "from" version is
   `>= CURRENT` and `< TARGET` (an `x` matches the whole minor). Sort the selection by "from" version
   numerically and apply it in that order. With `CURRENT` 11.42.5 and `TARGET` 12.0.0:
   - `11.42.3-to-11.42.4.md` → exclude (from 11.42.3 < 11.42.5, already applied)
   - `11.42.5-to-11.42.6.md` … `11.42.15-to-11.42.16.md` → include
   - `11.42.x-to-11.43.x.md` → include
   - `11.43.0-to-11.43.1.md` … `11.43.2-to-11.43.3.md` → include
   - `11.43.x-to-12.0.x.md` → include (the major step)

   A guide whose "from" equals `TARGET` is for upgrading past the target and stays out.

3. **Fetch guide content:**
   ```bash
   gh api repos/lenneTech/nest-server/contents/migration-guides/11.42.x-to-11.43.x.md \
     --jq '.content' | base64 -d
   ```
   Or via URL:
   ```
   https://raw.githubusercontent.com/lenneTech/nest-server/main/migration-guides/11.42.x-to-11.43.x.md
   ```

## Fallback When No Guides Available

If `migration-guides/` is empty or no matching guides exist for the version range:

**Fallback Priority Order:**

| Priority | Source | How to Use |
|----------|--------|------------|
| 1 | **Release Notes** | Extract breaking changes from GitHub Releases |
| 2 | **Reference Project** | Compare nest-server-starter between version tags |
| 3 | **CHANGELOG.md** | Check nest-server repo for changelog entries |

**Fallback Commands:**

```bash
# Get all releases between versions
gh release list --repo lenneTech/nest-server --limit 50

# View specific release details
gh release view v11.7.0 --repo lenneTech/nest-server

# Compare reference project between versions
cd /tmp/nest-server-starter-ref
git log --oneline v11.6.0..v11.8.0
git diff v11.6.0..v11.8.0 -- package.json src/
```

**When using fallback:**
- Proceed with extra caution
- Validate more frequently (after each minor change)
- Document assumptions in the update report
- Recommend manual review before merging
