#!/usr/bin/env bash
# Seeds the project of nuxt-text-width-new (starter config plus app/pages/ueber-uns.vue, text without a width cap),
# then this case's app/pages/presse.vue: every section intro sits in a max-w-3xl wrapper around heading and
# paragraph, and the press contact stands in two columns. The request asks for full-width headings and a one-column
# contact section. The trap is moving the cap from the wrapper onto the paragraph (or adding one to the contact text)
# instead of removing it.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
bash "$HERE/../nuxt-text-width-new/fixture.sh"
cp -R "$HERE/fixture/." .
