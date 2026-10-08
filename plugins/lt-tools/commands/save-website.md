---
description: Save a website with all pages and assets as an offline copy that opens from file://, verify it against the live site in headless Chrome, and optionally zip it
argument-hint: "<url> [--zip] [--out <dir>] [--external-assets] [--max-pages <n>]"
allowed-tools: Read, AskUserQuestion, Skill, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/*)
disable-model-invocation: true
---

# Save Website

Creates a complete offline copy of a website and proves that it looks and behaves like the
original.

## When to Use This Command

- A backup of a website as it is online today (before a relaunch, a CMS migration, a domain move)
- An offline copy for a presentation, an archive or a hand-over
- A ZIP of a site to send to someone

Not for CMS backups with database and uploads; those come from the hoster.

## Execution

Parse `$ARGUMENTS`: the first argument is the URL; `--zip`, `--out <dir>`, `--external-assets`,
`--max-pages <n>`, `--include <regex>`, `--exclude <regex>` and `--allow-private-hosts` pass
through to the mirror script unchanged. Without a URL, ask for it with AskUserQuestion.

Load the `lt-tools:saving-websites-locally` skill with the Skill tool and follow its workflow:

1. **Before starting**: permission and scope as the skill describes; ask only when they are unclear.
2. **Mirror**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/mirror-site.mjs" <url> <passed options>`
3. **Compare**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/compare-site.mjs" <out-dir>` with both
   viewports; on `✗` lines follow the skill's diagnosis table, fix, and compare again.
4. **Spot check**: read two or three screenshot pairs when the comparison reported differences or
   the site has sliders or animations.
5. **Report** in the user's language as the skill describes.

## Turn Endings

The workflow has two handoff points: the permission/scope question before the mirror (only when
needed) and the final report. Between them the run continues on its own. A mirror or comparison
started with `run_in_background` re-invokes the session when it finishes; carry on with the next
step instead of ending the turn with a progress note.
