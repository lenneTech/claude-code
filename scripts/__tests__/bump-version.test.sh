#!/bin/bash
# Tests for scripts/bump-version.ts — the release commit must carry the version bump and
# nothing else, whatever else sits uncommitted in the checkout.
#
# Why this exists: several sessions work in this checkout at once and leave their work
# uncommitted by house rule. The script used to run `git add .`, so a release swept all of
# it into the tagged commit — including work that must not ship yet (an lt-offers command
# calling an API parameter production did not know). Staging only the version files is not
# enough on its own: the script rewrites marketplace.json and every plugin.json from the
# WORKING TREE, so a foreign edit in one of those files rode along too.
#
# Each case builds a throwaway repo with a bare remote and runs a copy of the real script
# there; the script derives its root from its own location, so nothing here touches this
# checkout. Run: bash scripts/__tests__/bump-version.test.sh

set -u

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/bump-version.ts"
PASS=0
FAIL=0

check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
  fi
}

TMP_ROOT="$(mktemp -d)"; TMP_ROOT="$(cd "$TMP_ROOT" && pwd -P)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# A repo shaped like this one: root package.json + package-lock.json, the marketplace
# manifest, and two plugins. Pushed once, so the remote and HEAD agree.
setup_repo() {
  local dir="$1"
  git init -q --bare "$dir.remote.git"
  git init -q -b main "$dir"
  cd "$dir" || exit 1
  git config user.email t@example.com
  git config user.name test
  git config commit.gpgsign false
  git config tag.gpgsign false
  mkdir -p scripts .claude-plugin plugins/a/.claude-plugin plugins/b/.claude-plugin
  cp "$SCRIPT" scripts/bump-version.ts
  printf '{\n  "name": "x",\n  "version": "1.0.0"\n}\n' > package.json
  printf '{\n  "name": "x",\n  "version": "1.0.0",\n  "packages": {\n    "": {\n      "version": "1.0.0"\n    }\n  }\n}\n' > package-lock.json
  printf '{\n  "description": "base",\n  "version": "1.0.0"\n}\n' > .claude-plugin/marketplace.json
  printf '{\n  "description": "plugin a",\n  "version": "1.0.0"\n}\n' > plugins/a/.claude-plugin/plugin.json
  printf '{\n  "description": "plugin b",\n  "version": "1.0.0"\n}\n' > plugins/b/.claude-plugin/plugin.json
  echo "original" > notes.md
  git add -A && git commit -q -m init
  git remote add origin "$dir.remote.git"
  git push -q -u origin main 2>/dev/null
}

# The state a shared checkout is really in: foreign edits inside two of the version files,
# an unrelated modified file, an untracked file, and a stray local tag nobody meant to push.
# `sed -i` differs between BSD and GNU, so edit through a temp file.
replace_in() { sed "$2" "$1" > "$1.tmp" && mv "$1.tmp" "$1"; }

dirty_repo() {
  replace_in .claude-plugin/marketplace.json 's/"base"/"foreign edit"/'
  replace_in plugins/b/.claude-plugin/plugin.json 's/"plugin b"/"foreign plugin edit"/'
  echo "foreign change" >> notes.md
  echo "untracked" > scratch.txt
  git tag stray-local-tag
}

run_bump() { bun scripts/bump-version.ts patch "test release" >/dev/null 2>&1; }

committed() { git show "HEAD:$1"; }
remote_has_tag() { git ls-remote --tags origin "refs/tags/$1" | grep -q "$1"; }

echo "release commit carries only the version bump"
REPO="$TMP_ROOT/clean"; setup_repo "$REPO"; dirty_repo; run_bump
check "script exits 0" test "$(git log -1 --format=%s)" = "chore: bump version to 1.0.1"
check "commit touches exactly the five version files" test "$(git show --name-only --format= HEAD | sort | tr '\n' ' ')" = ".claude-plugin/marketplace.json package-lock.json package.json plugins/a/.claude-plugin/plugin.json plugins/b/.claude-plugin/plugin.json "
check "committed marketplace.json has the new version" grep -q '"version": "1.0.1"' <(committed .claude-plugin/marketplace.json)
check "committed marketplace.json keeps the BASE description, not the foreign edit" grep -q '"description": "base"' <(committed .claude-plugin/marketplace.json)
check "committed plugin b keeps the BASE description" grep -q '"description": "plugin b"' <(committed plugins/b/.claude-plugin/plugin.json)
check "committed package-lock.json bumps both version fields" test "$(committed package-lock.json | grep -c '"version": "1.0.1"')" = 2
check "notes.md is not in the commit" test "$(committed notes.md)" = "original"
check "scratch.txt is not in the commit" bash -c '! git cat-file -e HEAD:scratch.txt'

echo "foreign work stays in the working tree, uncommitted"
check "marketplace.json still carries the foreign edit" grep -q '"description": "foreign edit"' .claude-plugin/marketplace.json
check "marketplace.json in the tree has the new version too" grep -q '"version": "1.0.1"' .claude-plugin/marketplace.json
check "plugin b still carries the foreign edit" grep -q '"description": "foreign plugin edit"' plugins/b/.claude-plugin/plugin.json
check "notes.md is still modified" bash -c 'git status --porcelain notes.md | grep -q "^ M"'
check "scratch.txt is still untracked" bash -c 'git status --porcelain scratch.txt | grep -q "^??"'

echo "push carries the branch and the new tag only"
check "remote main is the release commit" test "$(git ls-remote origin refs/heads/main | cut -f1)" = "$(git rev-parse HEAD)"
check "tag v1.0.1 is on the remote" remote_has_tag v1.0.1
check "the stray local tag is NOT pushed" bash -c '! git ls-remote --tags origin refs/tags/stray-local-tag | grep -q stray'

echo "refuses to run over an index that already holds staged changes"
REPO="$TMP_ROOT/staged"; setup_repo "$REPO"
echo "staged change" >> notes.md; git add notes.md
BEFORE="$(git rev-parse HEAD)"
bun scripts/bump-version.ts patch "x" >/dev/null 2>&1; CODE=$?
check "exits non-zero" test "$CODE" -ne 0
check "creates no commit" test "$(git rev-parse HEAD)" = "$BEFORE"
check "leaves package.json at the old version" grep -q '"version": "1.0.0"' package.json

echo ""
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ]
