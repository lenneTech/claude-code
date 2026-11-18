# ADR-005: Plugin and repository content is English; German appears only in output that is German and as trigger phrases in skill descriptions

**Date:** 2025-12-18 · **Status:** accepted · **Topic:** Language
**Origin:** reconstructed 2026-11-18 from CLAUDE.md, git history

## Context

Version 2.2.0 (16a4fce, 2025-12-18) introduced the repository `CLAUDE.md` with a section "Language Requirements".
The plugins are public and their documentation sources are English, while the team that uses them prompts in German
and some outputs, such as tickets and QA instructions, are German.

## Decision

- All code, comments and documentation in the repository and in every plugin are English: SKILL.md files, commands,
  agents, READMEs and `plugin.json` (`CLAUDE.md` "Language Requirements"; house rule 27).
- German is used where the output itself is German, and the element that writes it says so. Examples: the tickets
  `create-story` writes, the German QA test instructions of `writing-qa-test-instructions`.
- Skill descriptions carry German trigger phrases next to the English ones (for example "Festplatte voll" in
  `cleaning-up-disk-space`), because users prompt in German.

## Rationale

- German trigger phrases, 42d84aa (2026-08-23): "Rewrite all 28 lt-dev skill descriptions for trigger quality: add
  German trigger phrases ([the maintainer] prompts in German)".
- English as the base language: not documented. [inferred] The repository is public (ADR-001), and the Claude Code
  documentation the elements are checked against (ADR-006) is English.

## Rejected alternatives

- **Descriptions with English triggers only**: the state before 42d84aa, rewritten for trigger quality.

## Consequences

- A German phrase in a skill description is a trigger, not a language slip; trimming a description keeps it (house
  rule 4 keeps trigger words).
- German output is named as such in the element that produces it; everything else an element says is English.

## Evidence

- 16a4fce (2025-12-18) "chore: bump version to 2.2.0": `CLAUDE.md` section "Language Requirements": "All code,
  comments, and documentation: **English**" and "Exception: User-facing German content where explicitly required
  (e.g., create-story.md)"
- 42d84aa (2026-08-23) "chore: bump version to 8.7.1"
- `plugins/lt-dev/skills/cleaning-up-disk-space/SKILL.md` (description); house rules 4, 27
