#!/usr/bin/env bash
# Seeds the trimmed nest-server-starter project from the nest-module-agent case plus the SPEC.md the plan is written
# from. The spec settles every decision, so the command has nothing to ask.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../nest-module-agent/fixture/." .
cp "$HERE/SPEC.md" SPEC.md
