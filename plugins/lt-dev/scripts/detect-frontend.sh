#!/usr/bin/env bash
# detect-frontend.sh — which frontend line does a project use, where does it live, and in which mode?
#
# The lt stack has two frontend lines on one backend: Nuxt with @lenne.tech/nuxt-extensions and
# Angular with @lenne.tech/ng-base. Commands, agents and skills branch on the answer, and a Nuxt
# project must take exactly the path it always took. One script answers it for all of them, so the
# branches cannot drift apart and the Nuxt answer is pinned by a test
# (scripts/__tests__/detect-frontend.test.sh).
#
# Usage: bash detect-frontend.sh [<project root>]    (default: CLAUDE_PROJECT_DIR, else $PWD)
#
# Output, one field per line:
#   frontend: nuxt | angular | none
#   app: <directory of the app, relative to the root: ".", "projects/app", "packages/app", "apps/app">
#   library: @lenne.tech/nuxt-extensions | @lenne.tech/ng-base | none
#   mode: npm | vendor | none
#   core: <path of the vendored core or the installed library, relative to the root, or "none">
#
# Rules, in this order per candidate directory (root first, then projects/app, packages/app, apps/app):
#   Nuxt      nuxt.config.ts / nuxt.config.js / nuxt.config.mjs, or a `nuxt` or
#             `@lenne.tech/nuxt-extensions` dependency in its package.json
#   Angular   angular.json, or an `@angular/core` or `@lenne.tech/ng-base` dependency
#   Nuxt is checked before Angular in every directory, so a Nuxt project never reads as Angular.
# Mode:
#   vendor    Nuxt: app/core/VENDOR.md naming @lenne.tech/nuxt-extensions
#             Angular: src/core/VENDOR.md naming @lenne.tech/ng-base (src/core/ is also where a
#             backend vendors nest-server, so only the package named in VENDOR.md decides)
#   npm       the library is a dependency in the app's package.json
#   none      neither (a plain Nuxt or Angular app without the lt library)
#
# Exit code: 0 always (an answer of `frontend: none` is a result, not an error).

set -u

root="${1:-${CLAUDE_PROJECT_DIR:-$PWD}}"
if [ ! -d "$root" ]; then
  echo "detect-frontend: $root is not a directory" >&2
  exit 2
fi
root="$(cd "$root" && pwd)"

# True when package.json at $1 lists dependency $2 in dependencies, devDependencies or peerDependencies.
has_dep() {
  local pkg="$1/package.json" name="$2"
  [ -f "$pkg" ] || return 1
  if command -v node >/dev/null 2>&1; then
    node -e '
      const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      const n = process.argv[2];
      process.exit([p.dependencies, p.devDependencies, p.peerDependencies].some((d) => d && Object.hasOwn(d, n)) ? 0 : 1);
    ' "$pkg" "$name" 2>/dev/null
  else
    grep -q "\"$name\"[[:space:]]*:" "$pkg" 2>/dev/null
  fi
}

is_nuxt() {
  [ -f "$1/nuxt.config.ts" ] || [ -f "$1/nuxt.config.js" ] || [ -f "$1/nuxt.config.mjs" ] \
    || has_dep "$1" nuxt || has_dep "$1" @lenne.tech/nuxt-extensions
}

is_angular() {
  [ -f "$1/angular.json" ] || has_dep "$1" @angular/core || has_dep "$1" @lenne.tech/ng-base
}

rel() {
  if [ "$1" = "$root" ]; then echo "."; else echo "${1#"$root"/}"; fi
}

report() {
  printf 'frontend: %s\napp: %s\nlibrary: %s\nmode: %s\ncore: %s\n' "$1" "$2" "$3" "$4" "$5"
  exit 0
}

for dir in "$root" "$root/projects/app" "$root/packages/app" "$root/apps/app"; do
  [ -d "$dir" ] || continue
  # A monorepo root has no frontend of its own: its package.json names neither framework, and
  # a root nuxt.config would make it a Nuxt app, which is then the answer.
  if is_nuxt "$dir"; then
    app="$(rel "$dir")"
    if [ -f "$dir/app/core/VENDOR.md" ] && grep -q '@lenne.tech/nuxt-extensions' "$dir/app/core/VENDOR.md" 2>/dev/null; then
      report nuxt "$app" @lenne.tech/nuxt-extensions vendor "$(rel "$dir/app/core")"
    elif has_dep "$dir" @lenne.tech/nuxt-extensions; then
      core="none"
      [ -d "$dir/node_modules/@lenne.tech/nuxt-extensions" ] && core="$(rel "$dir/node_modules/@lenne.tech/nuxt-extensions")"
      report nuxt "$app" @lenne.tech/nuxt-extensions npm "$core"
    else
      report nuxt "$app" none none none
    fi
  fi
  if is_angular "$dir"; then
    app="$(rel "$dir")"
    if [ -f "$dir/src/core/VENDOR.md" ] && grep -q '@lenne.tech/ng-base' "$dir/src/core/VENDOR.md" 2>/dev/null \
      && ! grep -q '@lenne.tech/nest-server' "$dir/src/core/VENDOR.md" 2>/dev/null; then
      report angular "$app" @lenne.tech/ng-base vendor "$(rel "$dir/src/core")"
    elif has_dep "$dir" @lenne.tech/ng-base; then
      core="none"
      [ -d "$dir/node_modules/@lenne.tech/ng-base" ] && core="$(rel "$dir/node_modules/@lenne.tech/ng-base")"
      report angular "$app" @lenne.tech/ng-base npm "$core"
    else
      report angular "$app" none none none
    fi
  fi
done

report none none none none none
