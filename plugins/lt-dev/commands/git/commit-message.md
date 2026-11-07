---
description: Generate commit message with alternatives
allowed-tools: Bash(git:*)
disable-model-invocation: false
---

# Generate Commit Message

> **Invocation policy.** `disable-model-invocation` stays `false` because `/lt-dev:publish`
> invokes this command through the `Skill` tool to word the release commit message. Start it
> only when the user asks for it or a command invokes it as a documented step; it reads the
> diff and proposes text, the commit itself stays with the user or the caller.

## When to Use This Command

- After making changes and before committing
- When you want well-crafted commit message suggestions
- To follow consistent commit message conventions

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:git:mr-description` | Generate MR description (`--clipboard` copies it) for branch |

---

Analyze the current changes compared to the last git commit (`git diff`) and create a commit message.

**Requirements:**
- Write in English
- Keep it short: one concise sentence
- Focus on WHAT changed and WHY, not HOW

**Output format:**
Provide exactly 3 alternatives:

```
1. [your first commit message suggestion]
2. [your second commit message suggestion]
3. [your third commit message suggestion]
```

Then assess the semver impact:

```
**Semver:** [patch | minor | major] — [one-sentence justification]
```

- **patch**: Bug fixes, typos, docs updates, dependency bumps — no new behavior
- **minor**: New features, new capabilities, behavioral changes — backward compatible
- **major**: Breaking changes, removed features, changed APIs — not backward compatible

**In an lt base repo the stack's version scheme replaces these three lines** (skill `maintaining-lt-stack`,
"Version scheme"). This covers nest-server, nuxt-extensions, ng-base, the three starters, cli, lt-monorepo and both
marketplaces:

- **patch**: an improvement or extension consumers can adopt as is
- **minor**: a change consumers have to take into account when migrating (behaviour, code or configuration), breaking
  changes included
- **major**: never for a change of our own. In nest-server, nuxt-extensions and ng-base it follows the NestJS, Nuxt or
  Angular major; a starter always carries its library's version; in the other repos only the user decides one

Then add: "**Copy your preferred message to use with `git commit -am \"...\"`**"