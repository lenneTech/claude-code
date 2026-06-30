#!/bin/bash
# Background updater for @lenne.tech/cli + Claude Code plugins.
# Runs detached from the SessionStart hook. Writes a notification file when
# something actually changed so the next session can inform the user.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lt-plugins-config.sh
. "$SCRIPT_DIR/_lt-plugins-config.sh"

mkdir -p "$LT_PLUGINS_STATE_DIR" 2>/dev/null || exit 0

if ! lt_plugins_acquire_lock; then
  exit 0
fi
trap 'lt_plugins_release_lock' EXIT

read_pkg_version() {
  local pkg_json="$1"
  [ -f "$pkg_json" ] || return 0
  awk -F\" '/"version"[[:space:]]*:/ {print $4; exit}' "$pkg_json"
}

# Claude Code's sandbox (≈ extension 2.1.19x) no longer guarantees Node/npm on
# the hook PATH — it used to inherit the login-shell PATH (with the fnm/nvm/volta
# init). Resolve a Node version-manager bin dir onto PATH; benign no-op when npm
# is already present. Homebrew + /usr/local are kept as additional fallbacks.
if [ -r "$SCRIPT_DIR/../../scripts/lib/ensure-node-path.sh" ]; then
  # shellcheck source=../../scripts/lib/ensure-node-path.sh
  . "$SCRIPT_DIR/../../scripts/lib/ensure-node-path.sh"
  ensure_node_on_path || true
fi
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"

success=1
{
  echo "=== lt-dev auto-update: $(date) ==="

  if ! command -v npm >/dev/null 2>&1; then
    echo "npm not found on PATH — aborting."
    success=0
  fi

  notifications=()

  if [ "$success" -eq 1 ]; then
    npm_root=$(npm root -g 2>/dev/null || echo "")
    cli_pkg_dir=""
    if [ -n "$npm_root" ]; then
      cli_pkg_dir="$npm_root/@lenne.tech/cli"
    fi

    if ! command -v lt >/dev/null 2>&1; then
      echo "lt CLI missing — installing @lenne.tech/cli globally..."
      if npm install -g @lenne.tech/cli; then
        installed_version=$(read_pkg_version "$cli_pkg_dir/package.json")
        if [ -n "$installed_version" ]; then
          notifications+=("- @lenne.tech/cli installiert (v$installed_version)")
        else
          notifications+=("- @lenne.tech/cli installiert")
        fi
      else
        echo "Failed to install @lenne.tech/cli."
        success=0
      fi
    else
      if [ -n "$cli_pkg_dir" ] && [ -L "$cli_pkg_dir" ]; then
        link_target=$(readlink "$cli_pkg_dir" 2>/dev/null || echo "?")
        echo "lt CLI is npm-linked ($link_target) — skipping CLI update."
      else
        prev_version=$(read_pkg_version "$cli_pkg_dir/package.json")
        echo "Updating @lenne.tech/cli (current: ${prev_version:-unknown})..."
        if npm install -g @lenne.tech/cli@latest; then
          new_version=$(read_pkg_version "$cli_pkg_dir/package.json")
          if [ -n "$new_version" ] && [ "$new_version" != "$prev_version" ]; then
            notifications+=("- @lenne.tech/cli aktualisiert: ${prev_version:-unknown} → $new_version")
          fi
        else
          echo "@lenne.tech/cli update failed."
          success=0
        fi
      fi
    fi
  fi

  if [ "$success" -eq 1 ] && ! command -v lt >/dev/null 2>&1; then
    echo "lt still not available after install — aborting plugin update."
    success=0
  fi

  if [ "$success" -eq 1 ]; then
    manifest="$HOME/.claude/plugins/installed_plugins.json"
    before_snapshot=""
    if command -v jq >/dev/null 2>&1 && [ -f "$manifest" ]; then
      before_snapshot=$(jq -r '
        .plugins // {}
        | to_entries[]
        | "\(.key) \(.value[0].version // "?") \(.value[0].gitCommitSha // "")"
      ' "$manifest" 2>/dev/null | sort)
    fi

    echo "Running: lt claude plugins"
    if lt claude plugins; then
      if [ -n "$before_snapshot" ] && [ -f "$manifest" ]; then
        after_snapshot=$(jq -r '
          .plugins // {}
          | to_entries[]
          | "\(.key) \(.value[0].version // "?") \(.value[0].gitCommitSha // "")"
        ' "$manifest" 2>/dev/null | sort)
        if [ "$before_snapshot" != "$after_snapshot" ]; then
          diff_lines=$(diff <(printf '%s\n' "$before_snapshot") <(printf '%s\n' "$after_snapshot") \
            | grep -E '^[<>]' | head -n 20)
          notifications+=("- Claude Code plugins updated:")
          while IFS= read -r diff_line; do
            [ -n "$diff_line" ] && notifications+=("    $diff_line")
          done <<< "$diff_lines"
        fi
      fi
    else
      echo "lt claude plugins failed."
      success=0
    fi
  fi

  if [ ${#notifications[@]} -gt 0 ]; then
    {
      echo "[lt-dev] auto-update applied:"
      for n in "${notifications[@]}"; do
        printf '%s\n' "$n"
      done
    } > "$LT_PLUGINS_NOTIFICATION_FILE"
  fi

  if [ "$success" -eq 1 ]; then
    lt_plugins_mark_success
  else
    lt_plugins_mark_failure
  fi
  echo "=== run complete (success=$success) ==="
} >> "$LT_PLUGINS_LOG_FILE" 2>&1

# Pre-warm the npx cache for this plugin's npx-based MCP servers so they connect
# within Claude Code's 30s MCP connection timeout on the NEXT session start. The
# first-run `npx -y <pkg>@latest` downloads the package (chrome-devtools-mcp also
# launches Chrome), which routinely exceeds 30s on a cold cache → "connection
# timed out". This runs detached (the whole script is), best-effort, and is
# throttled to once per ~20h. node/npm are already on PATH via ensure_node_on_path
# above. Portable per-package watchdog (no GNU `timeout` dependency on macOS).
{
  prewarm_stamp="$LT_PLUGINS_STATE_DIR/mcp-prewarm.stamp"
  prewarm_due=1
  if [ -f "$prewarm_stamp" ]; then
    now_ts=$(date +%s 2>/dev/null || echo 0)
    last_ts=$(cat "$prewarm_stamp" 2>/dev/null || echo 0)
    [ $((now_ts - last_ts)) -lt 72000 ] && prewarm_due=0
  fi
  if [ "$prewarm_due" -eq 1 ] && command -v npx >/dev/null 2>&1; then
    echo "=== pre-warm npx MCP packages: $(date) ==="
    for pkg in \
      chrome-devtools-mcp@latest \
      nuxt-ui-mcp@latest \
      @nicepkg/aide-mcp-server@latest \
      @anthropic-ai/claude-code-figma-mcp@latest; do
      ( npx -y "$pkg" --version >/dev/null 2>&1 ) &
      pw_pid=$!
      ( sleep 120; kill -TERM "$pw_pid" 2>/dev/null; sleep 2; kill -KILL "$pw_pid" 2>/dev/null ) &
      pw_wd=$!
      wait "$pw_pid" 2>/dev/null || true
      kill -TERM "$pw_wd" 2>/dev/null || true
      echo "pre-warmed: $pkg"
    done
    date +%s > "$prewarm_stamp" 2>/dev/null || true
    echo "=== pre-warm done ==="
  fi
} >> "$LT_PLUGINS_LOG_FILE" 2>&1

if [ -f "$LT_PLUGINS_LOG_FILE" ]; then
  tail -n 500 "$LT_PLUGINS_LOG_FILE" > "$LT_PLUGINS_LOG_FILE.tmp" 2>/dev/null \
    && mv "$LT_PLUGINS_LOG_FILE.tmp" "$LT_PLUGINS_LOG_FILE"
fi

exit 0
