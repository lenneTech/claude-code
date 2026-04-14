#!/usr/bin/env bash
# discover-check-scripts.sh
#
# Discovers all `check` scripts across a repository and reports per project:
#   - relative path to the package.json
#   - the check script body
#   - whether check transitively invokes a test runner
#   - the detected package manager (pnpm/yarn/npm)
#
# Output format (TSV, one project per line):
#   <package.json path>\t<check script>\t<includes_tests:yes|no>\t<package manager>
#
# Discovery uses git ls-files (respects .gitignore, skips node_modules automatically).
# JSON parsing falls back through jq → node → grep+sed for portability.
#
# Exit codes:
#   0 → discovery succeeded (zero or more projects found)
#   2 → not in a git repository
#
# Usage: bash discover-check-scripts.sh [repo-root]
set -euo pipefail

repo_root="${1:-.}"
cd "$repo_root"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "ERROR: not a git repository: $repo_root" >&2
  exit 2
fi

# Extract a script field from a package.json with a 3-level fallback chain.
# Pkg path and field name are passed as argv to node to avoid shell interpolation
# into the JS source (safe with spaces, quotes, and unusual characters in paths).
read_script() {
  local pkg="$1"
  local field="$2"
  local value=""

  if command -v jq > /dev/null 2>&1; then
    value=$(jq -r --arg f "$field" '.scripts[$f] // empty' "$pkg" 2>/dev/null || true)
  fi

  if [ -z "$value" ] && command -v node > /dev/null 2>&1; then
    value=$(node -e '
      try {
        const fs = require("fs");
        const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        process.stdout.write((p.scripts && p.scripts[process.argv[2]]) || "");
      } catch (e) {}
    ' "$pkg" "$field" 2>/dev/null || true)
  fi

  if [ -z "$value" ]; then
    value=$(grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$pkg" 2>/dev/null \
      | head -1 \
      | sed 's/.*"\([^"]*\)"$/\1/' || true)
  fi

  printf '%s' "$value"
}

# Detect the package manager for a project directory based on lockfile presence.
detect_pm() {
  local dir="$1"
  if [ -f "$dir/pnpm-lock.yaml" ]; then echo "pnpm"
  elif [ -f "$dir/yarn.lock" ]; then echo "yarn"
  elif [ -f "$dir/package-lock.json" ]; then echo "npm"
  else echo "pnpm"
  fi
}

# Returns "yes" if a script string transitively invokes a test runner.
# Resolves single-level composite scripts (e.g. "check": "pnpm run ci" → look up "ci").
script_includes_tests() {
  local pkg="$1"
  local script="$2"
  local pattern='(^|[[:space:]&|;])(test|vitest|jest|playwright)([[:space:]]|$|:)|((pnpm|npm|yarn)([[:space:]]+run)?[[:space:]]+test)'

  if echo "$script" | grep -qE "$pattern"; then
    echo "yes"
    return
  fi

  # Composite resolution: extract referenced sub-scripts (`pnpm run X`, `npm run X`, `yarn X`)
  local referenced
  referenced=$(echo "$script" \
    | grep -oE '(pnpm|npm|yarn)([[:space:]]+run)?[[:space:]]+[a-zA-Z0-9:_-]+' \
    | awk '{print $NF}' \
    | sort -u || true)

  for sub in $referenced; do
    [ "$sub" = "test" ] && { echo "yes"; return; }
    local sub_script
    sub_script=$(read_script "$pkg" "$sub")
    if [ -n "$sub_script" ] && echo "$sub_script" | grep -qE "$pattern"; then
      echo "yes"
      return
    fi
  done

  echo "no"
}

# Iterate all tracked package.json files (root + monorepo workspaces).
git ls-files "package.json" "**/package.json" 2>/dev/null | while read -r pkg; do
  [ -f "$pkg" ] || continue
  script=$(read_script "$pkg" "check")
  [ -z "$script" ] && continue

  dir=$(dirname "$pkg")
  pm=$(detect_pm "$dir")
  includes_tests=$(script_includes_tests "$pkg" "$script")

  printf '%s\t%s\t%s\t%s\n' "$pkg" "$script" "$includes_tests" "$pm"
done
