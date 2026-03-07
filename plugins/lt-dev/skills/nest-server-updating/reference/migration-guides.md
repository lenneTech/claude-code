# Migration Guide System

## File Naming Convention

Migration guides in `migration-guides/` follow these patterns:

| Pattern | Example | Scope |
|---------|---------|-------|
| `X.Y.x-to-A.B.x.md` | `11.6.x-to-11.7.x.md` | Minor version step |
| `X.x-to-Y.x.md` | `11.x-to-12.x.md` | Major version jump |
| `X.Y.x-to-A.B.x.md` | `11.6.x-to-12.0.x.md` | Spanning multiple versions |

## Guide Selection Logic

For an update from version `CURRENT` to `TARGET`:

1. **List available guides:**
   ```bash
   gh api repos/lenneTech/nest-server/contents/migration-guides --jq '.[].name'
   ```

2. **Select applicable guides:**

   | Condition | Guides to load |
   |-----------|----------------|
   | Same major, sequential minor | Each `X.Y.x-to-X.Z.x.md` in sequence |
   | Major version jump | All minor guides + `X.x-to-Y.x.md` |
   | Spanning guide exists | Include it (may consolidate steps) |

3. **Load order (example 11.6.0 → 12.1.0):**
   ```
   1. 11.6.x-to-11.7.x.md
   2. 11.7.x-to-11.8.x.md
   3. ... (all minor steps to 11.x latest)
   4. 11.x-to-12.x.md (major jump)
   5. 12.0.x-to-12.1.x.md
   6. 11.6.x-to-12.x.md (if exists - consolidated)
   ```

4. **Fetch guide content:**
   ```bash
   gh api repos/lenneTech/nest-server/contents/migration-guides/11.6.x-to-11.7.x.md \
     --jq '.content' | base64 -d
   ```
   Or via URL:
   ```
   https://raw.githubusercontent.com/lenneTech/nest-server/main/migration-guides/11.6.x-to-11.7.x.md
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
