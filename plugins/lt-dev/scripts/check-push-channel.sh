#!/usr/bin/env bash
# check-push-channel.sh
#
# Decides how a repository can push: over SSH, or over HTTPS with the gh credential helper.
#
# WHY THIS EXISTS — the obvious check is wrong
#
#   The intuitive test is `ssh-add -l`, and every release recipe used it until 2026-08-23, when
#   it was measured reporting "The agent has no identities" on a machine where
#   `ssh -T git@github.com` authenticated fine and always had.
#
#   The cause is that these two commands talk to DIFFERENT agents:
#
#     ~/.ssh/config      Host *
#                            IdentityAgent "~/Library/Group Containers/…1password/t/agent.sock"
#     $SSH_AUTH_SOCK     /var/run/com.apple.launchd.<id>/Listeners      (macOS built-in, empty)
#
#   `IdentityAgent` is an ssh(1) option. `ssh-add` does not read ~/.ssh/config at all — it only
#   ever speaks to `$SSH_AUTH_SOCK`. So on any 1Password (or gpg-agent, or Secretive, or
#   remote-forwarded) setup, `ssh-add -l` interrogates an agent that ssh never uses, and reports
#   an empty agent forever. Every HTTPS fallback it triggered was unnecessary.
#
#   The fix is to stop asking about agents and ask about the outcome: attempt an authentication.
#   That answer stays correct however the keys are wired up, including setups nobody anticipated.
#
# Output (TSV, one line):
#   <channel:ssh|https|blocked>\t<host>\t<reason>\t<action>
#
# channel values:
#   ssh     — SSH authenticated against the remote's host. Push normally.
#   https   — SSH did not authenticate, but a credential helper IS available for this host.
#             Field 4 is the ready-to-use `-c credential.helper=…` argument.
#   blocked — SSH did not authenticate and NO fallback exists for this host. Do not improvise:
#             fix SSH, or add a credential helper. Field 4 says what to do.
#
# The `blocked` verdict matters because the lt stack pushes to TWO hosts — github.com and the
# self-hosted gitlab.lenne.tech — and the fallback is not the same for both. Reporting `https`
# with a GitHub-only command for a GitLab remote would fail mid-release, which is worse than an
# honest stop. So availability is established by asking, in git's own resolution order:
#
#   1. `git credential fill` (non-interactive) — if a password comes back, a plain https push
#      already works and needs no extra flag. Covers osxkeychain and every other configured
#      helper, on any host, without this script having to know about it.
#   2. `gh auth status` for github.com, `glab auth status --hostname` for a GitLab host — and
#      only when authenticated for THAT host.
#   3. Neither → `blocked`.
#
# Step 1 is what keeps this honest: a helper being *configured* says nothing about whether it
# holds an entry for this host.
#
# Exit codes:
#   0 → a channel was determined (check field 1 for which one)
#   2 → not in a git repository, or the named remote does not exist
#
# Usage: bash check-push-channel.sh [repo-root] [remote-name]
#   repo-root   defaults to the current directory
#   remote-name defaults to "origin"
set -euo pipefail

repo_root="${1:-$(pwd)}"
remote="${2:-origin}"

cd "$repo_root" 2>/dev/null || { echo "not a directory: $repo_root" >&2; exit 2; }
git rev-parse --git-dir >/dev/null 2>&1 || { echo "not a git repository: $repo_root" >&2; exit 2; }

remote_url="$(git remote get-url "$remote" 2>/dev/null || true)"
[ -n "$remote_url" ] || { echo "no such remote: $remote" >&2; exit 2; }

# Host out of either remote form: git@host:owner/repo.git or https://host/owner/repo.git
case "$remote_url" in
  *://*) host="${remote_url#*://}"; host="${host#*@}"; host="${host%%/*}" ;;
  *@*:*) host="${remote_url#*@}"; host="${host%%:*}" ;;
  *)     host="" ;;
esac

if [ -z "$host" ]; then
  printf 'blocked\t-\tcould not parse a host from remote URL: %s\tfix the remote URL\n' "$remote_url"
  exit 0
fi

# What this host can fall back to when SSH is unavailable — established by ASKING, in the same
# order git itself would resolve credentials. "A helper is configured" is not the question; a
# helper with no entry for this host is no fallback at all.
fallback_arg=""
fallback_hint=""

# 1. Can git already produce a password for this host without prompting? If so, a plain
#    `git push https://…` works and needs no extra flag. GIT_TERMINAL_PROMPT=0 makes a missing
#    entry fail instead of blocking on a hidden prompt — which, unattended, is a hung release.
if printf 'protocol=https\nhost=%s\n\n' "$host" |
   GIT_TERMINAL_PROMPT=0 timeout 8 git credential fill 2>/dev/null | grep -q '^password='; then
  fallback_arg="(credentials already available — plain https push works)"

# 2. Otherwise a CLI may be able to vend them. `gh` for GitHub, `glab` for a GitLab host, and
#    each only when it is actually authenticated FOR THIS HOST — glab is commonly logged in to
#    gitlab.com while the self-hosted instance has no token at all.
elif [ "$host" = "github.com" ] && command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  fallback_arg="-c credential.helper='!gh auth git-credential'"
elif command -v glab >/dev/null 2>&1 && glab auth status --hostname "$host" >/dev/null 2>&1; then
  fallback_arg="-c credential.helper='!glab auth git-credential'"
elif [ "$host" = "github.com" ]; then
  fallback_hint="run 'gh auth login' to enable the HTTPS fallback"
else
  fallback_hint="no credentials for ${host} — fix SSH, or store them (glab auth login / git credential approve)"
fi

# The functional check. `ssh -T` against a git host exits non-zero even on SUCCESS (the host
# refuses shell access by design), so the exit code is useless here — the message is the signal.
# Both GitHub and GitLab say "successfully authenticated"; `Welcome to GitLab` is accepted too.
ssh_output="$(timeout 10 ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -T "git@${host}" 2>&1 || true)"

case "$ssh_output" in
  *"successfully authenticated"*|*"Welcome to GitLab"*)
    printf 'ssh\t%s\tauthenticated as: %s\tpush normally\n' "$host" "$(printf '%s' "$ssh_output" | head -1)"
    ;;
  *)
    case "$ssh_output" in
      *"Permission denied"*) reason="SSH key rejected by ${host}" ;;
      "")                    reason="no response from ${host} (timeout or unreachable)" ;;
      *)                     reason="no SSH authentication ($(printf '%s' "$ssh_output" | head -1 | cut -c1-80))" ;;
    esac

    # Never guess `ssh` from an unrecognised banner: a wrong ssh verdict hangs a push mid-release.
    if [ -n "$fallback_arg" ]; then
      printf 'https\t%s\t%s\t%s\n' "$host" "$reason" "$fallback_arg"
    else
      printf 'blocked\t%s\t%s\t%s\n' "$host" "$reason" "$fallback_hint"
    fi
    ;;
esac
