#!/usr/bin/env bash
# Seeds the trimmed nuxt-base-starter config from the nuxt-feature-agent case (package.json, nuxt.config, app.vue,
# app.config) and one public page of the project, app/pages/ueber-uns.vue: full-width container, headings and intro
# paragraphs without a width cap. There is no design for the page the run writes, so that page is the only
# reference for how wide text runs; a max-w-* the run puts on a heading or paragraph is its own default.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
BASE="$HERE/../../agent/nuxt-feature-agent/fixture"
mkdir -p app
cp "$BASE/package.json" "$BASE/nuxt.config.ts" .
cp "$BASE/app/app.vue" "$BASE/app/app.config.ts" app/
cp -R "$HERE/fixture/." .
