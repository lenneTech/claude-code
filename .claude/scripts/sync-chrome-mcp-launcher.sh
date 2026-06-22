#!/usr/bin/env bash
# Keeps the two chrome-devtools-mcp launcher scripts byte-identical.
# Plugin isolation forbids sharing files between plugins, so we maintain
# one canonical copy (lt-dev) and mirror it to lt-showroom.
#
# Modes:
#   sync-chrome-mcp-launcher.sh           Copy canonical -> mirror
#   sync-chrome-mcp-launcher.sh --check   Exit 0 if in sync, non-zero with diff if not
#
# Run --check in CI to catch drift; run without args after editing the canonical file.

set -eu

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
canonical="$repo_root/plugins/lt-dev/scripts/chrome-devtools-mcp-launcher.sh"
mirror="$repo_root/plugins/lt-showroom/scripts/chrome-devtools-mcp-launcher.sh"

[ -f "$canonical" ] || { echo "Missing canonical: $canonical" >&2; exit 2; }

if [ "${1:-}" = "--check" ]; then
  if ! diff -u "$canonical" "$mirror" >/dev/null 2>&1; then
    echo "Drift detected between chrome-devtools-mcp launcher scripts:" >&2
    diff -u "$canonical" "$mirror" >&2 || true
    echo "Run: .claude/scripts/sync-chrome-mcp-launcher.sh" >&2
    exit 1
  fi
  echo "In sync."
  exit 0
fi

cp "$canonical" "$mirror"
chmod +x "$mirror"
echo "Synced: $canonical -> $mirror"
