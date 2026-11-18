# ADR-019: lt-showroom works in a throwaway clone and stores its results in the Showroom platform; nothing is written into the analysed project or the developer checkout

**Date:** 2026-10-11 · **Status:** accepted · **Topic:** Plugin design
**Origin:** reconstructed 2026-11-18 from git history, plugins/lt-showroom/README.md

## Context

7294774 (2026-10-11, DEV-3508): "The screenshot pipeline used to run in the developer's checkout and ended with broad
pkill / kill -9 / docker compose down, which hit other sessions, and `lt dev up` seeded into the developer's local
database." On 2026-10-22 (9e06d41, DEV-3507, DEV-3535) the analysis moved into the Showroom platform as well.

## Decision

- Every analysis and screenshot run works in its own folder `~/.lt-showroom/<slug>/` (`LT_SHOWROOM_HOME` overrides
  it): a throwaway clone whose remotes cannot be pushed to, started in isolation (its own Compose project, or a
  process group with a database of its own), with every database URI checked to be local.
- A run stops only what it started; a `SessionEnd` hook sweeps the runs of the ending session.
- Live systems stay read-only: data is replaced in the DOM before a capture, people are blurred, and a live system is
  used only when it runs the repository's code.
- The Showroom platform is the source of truth: a showcase is found through its repository, the analysis report and
  the analysed commit are stored in the showcase, screenshots go up through upload tickets, and an update re-analyses
  only what changed since the analysed commit. Nothing is written into the analysed project.
- The deterministic part lives in `scripts/screenshot-session.mjs`, a dependency-free script with a `node --test`
  suite (ADR-015).

## Rationale

- 7294774, quoted in the Context: the run in the developer's checkout killed other sessions' processes and seeded the
  developer's local database.
- 9e06d41: "the analysis report is stored in the showcase (sourceCodeAnalysis), and update re-analyzes only what
  changed since source.analyzedCommit, in a throwaway clone. Nothing is written into the analyzed project."

## Rejected alternatives

- **Running in the developer's checkout** with broad `pkill` / `kill -9` / `docker compose down` cleanup (until
  7294774).

## Consequences

- A run costs a clone and an isolated start, in disk space and time.
- A project that cannot start locally falls back to demo access, public pages, older screenshots or a teaser cover
  (the `screenshot-generator` agent).
- A showcase is tied to its repository (`source.repositories`); a moved repository has to be updated in the showcase.

## Evidence

- 7294774 (2026-10-11) "feat(lt-showroom): capture screenshots from a throwaway clone without touching anything
  else", Refs DEV-3508
- 9e06d41 (2026-10-22) "feat(lt-showroom): Showroom as source of truth, screenshot uploads via upload tickets",
  DEV-3507, DEV-3535
- c9303e7 (2026-10-27) "feat(lt-showroom): own work folder per project, generated teaser, tech section"
- `plugins/lt-showroom/README.md:3`, `:47`, `:61-64`, `:81`; `plugins/lt-showroom/scripts/screenshot-session.mjs`;
  `plugins/lt-showroom/hooks/hooks.json` (`sweep-screenshot-sessions.sh`)
