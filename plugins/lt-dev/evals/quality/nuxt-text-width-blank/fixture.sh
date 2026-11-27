#!/usr/bin/env bash
# Seeds only the trimmed nuxt-base-starter config from the nuxt-feature-agent case (package.json, nuxt.config,
# app.vue, app.config): no public page exists, so neither a design nor an existing page tells the run how wide text
# runs. A max-w-* on a heading or paragraph is the model's own default. nuxt-text-width-new is the same request with
# a reference page in the project.
set -eu
BASE="$(cd "$(dirname "$0")" && pwd)/../../agent/nuxt-feature-agent/fixture"
mkdir -p app
cp "$BASE/package.json" "$BASE/nuxt.config.ts" .
cp "$BASE/app/app.vue" "$BASE/app/app.config.ts" app/
