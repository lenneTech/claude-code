---
name: lt-cli-reference
description: Detailed reference for lt git and lt fullstack commands with troubleshooting
---

# LT CLI Detailed Reference

## lt git get — Detailed Behavior

```bash
lt git get [branch-name]    # alias: lt git g
```

| Scenario | Action |
|----------|--------|
| Branch exists locally | Switches to branch |
| Branch exists on remote only | Checks out and tracks remote branch |
| Branch doesn't exist anywhere | Creates new branch from current |

**Equivalent git:**
```bash
git checkout DEV-123 2>/dev/null || \
  git checkout -b DEV-123 --track origin/DEV-123 2>/dev/null || \
  git checkout -b DEV-123
```

## lt git reset — Detailed Behavior

```bash
lt git reset    # Interactive: prompts for confirmation
```

**Equivalent git:**
```bash
git fetch origin
git reset --hard origin/<current-branch>
```

**Recovery (immediately after accidental reset):**
```bash
git reflog
git reset --hard HEAD@{1}
```

## lt fullstack init — Local Template Options

Use `--*-link` for **development** (symlink, changes affect source):
```bash
lt fullstack init --name TestApp --frontend nuxt --git false --noConfirm \
  --api-link <path/to/nest-server-starter> \
  --frontend-link <path/to/nuxt-base-starter>
```

Use `--*-copy` for **independent development** (isolated copy):
```bash
lt fullstack init --name MyApp --frontend angular --git true --noConfirm \
  --api-copy <path/to/nest-server-starter> \
  --frontend-copy <path/to/ng-base-starter>
```

## Troubleshooting

### Git

**Cannot switch branch (uncommitted changes):**
```bash
git stash && lt git get <branch> && git stash pop
```

**Reset fails (no remote tracking):**
```bash
git branch -u origin/main
git fetch origin
lt git reset
```

### Fullstack Init

**Directory already exists:**
```bash
rm -rf <workspace-name>
lt fullstack init --name <Name> ...
```

**Permission denied:**
Use a writable directory (`cd ~/projects`).

**Git link invalid:**
Use valid HTTPS or SSH URL: `https://github.com/user/repo.git`

## Server Commands

For `lt server module`, `lt server object`, `lt server addProp`, and `lt server permissions`, see the **generating-nest-servers** skill → `reference/configuration.md`.
