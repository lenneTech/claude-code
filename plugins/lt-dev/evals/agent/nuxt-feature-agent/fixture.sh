#!/usr/bin/env bash
# Seeds the workspace with a trimmed nuxt-base-starter app (committed starter files:
# app.config, app.vue, the base modal and an app page as references) plus generated
# API client files for a Product resource, so the agent works against real generated
# types the way a project does after `pnpm run generate-types`.
set -eu
cp -R "$(cd "$(dirname "$0")" && pwd)/fixture/." .
