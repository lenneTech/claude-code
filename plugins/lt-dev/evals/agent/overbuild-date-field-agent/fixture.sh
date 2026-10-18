#!/usr/bin/env bash
# Seeds the trimmed nuxt-base-starter app from the nuxt-feature-agent case, then this case's files (fixture/): a task
# list page, a task form without a due date, generated API types that already carry dueDate, and what a reuse needs:
# the project's FormDateField component (already used by ProjectForm) and the formatDate/todayIsoDate utils. The trap
# is building a date picker, a date library or new date helpers instead.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../nuxt-feature-agent/fixture/." .
cp -R "$HERE/fixture/." .
