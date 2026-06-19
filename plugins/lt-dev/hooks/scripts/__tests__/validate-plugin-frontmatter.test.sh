#!/bin/bash
# Tests for hooks/scripts/validate-plugin-frontmatter.sh — verifies that the
# hook validates the RESULTING file content after an Edit, not the isolated
# new_string. This prevents false-positives when the new_string contains
# markdown horizontal rules (---) or table separators (|---|).
#
# Run: bash hooks/scripts/__tests__/validate-plugin-frontmatter.test.sh
#
# Exits 0 on success, prints failures on stderr.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/validate-plugin-frontmatter.sh"

PASS=0
FAIL=0

assert_allow() {
  # An "allow" result is silent (empty stdout) — no JSON decision returned.
  local actual="$1" label="$2"
  if [ -z "$actual" ]; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected: silent (allow)"
    echo "    actual:   $actual"
  fi
}

assert_deny() {
  local actual="$1" needle="$2" label="$3"
  # Both checks need -z so multi-line pretty-printed JSON output still matches.
  if echo "$actual" | grep -qz '"permissionDecision": "deny"' && echo "$actual" | grep -qz "$needle"; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected deny containing: $needle"
    echo "    actual: $actual"
  fi
}

run_hook() {
  # $1 = JSON payload for the tool call
  bash "$HOOK" 2>/dev/null <<<"$1"
}

setup_tmp() { TMP=$(mktemp -d -t lt-frontmatter-XXXXXX); }
cleanup() { rm -rf "$TMP" 2>/dev/null; }

# ── Helper: write a valid SKILL.md ──
write_skill_md() {
  local path="$1"
  cat > "$path" <<'EOF'
---
name: example-skill
description: A short, valid description for testing purposes.
---

# Example Skill

Body content goes here.

## A Section

More body content.
EOF
}

# ── Helper: write a valid agent ──
write_agent_md() {
  local path="$1"
  cat > "$path" <<'EOF'
---
name: example-agent
description: A short description.
model: sonnet
tools: Bash, Read
---

# Example Agent
EOF
}

# ── Helper: write a valid command ──
write_command_md() {
  local path="$1"
  cat > "$path" <<'EOF'
---
description: A short command description.
---

# Example Command
EOF
}

# ── Helper: build a JSON payload for the Edit tool ──
# Args: file_path, old_string, new_string [, replace_all]
# Uses node + JSON.stringify because jq --arg leaves embedded newlines as
# literal bytes (invalid JSON), while the real Claude Code harness sends
# properly-escaped JSON (e.g. "old_string": "line1\nline2") — we mirror that.
edit_payload() {
  local fp="$1" old="$2" new="$3" rall="${4:-false}"
  node -e '
    const [, fp, old, neu, rall] = process.argv;
    process.stdout.write(JSON.stringify({
      tool_name: "Edit",
      tool_input: {
        file_path: fp,
        old_string: old,
        new_string: neu,
        replace_all: rall === "true",
      },
    }));
  ' "$fp" "$old" "$new" "$rall"
}

# ── Helper: build a JSON payload for the Write tool ──
write_payload() {
  local fp="$1" content="$2"
  node -e '
    const [, fp, content] = process.argv;
    process.stdout.write(JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: fp, content },
    }));
  ' "$fp" "$content"
}

# ─────────────────────────────────────────────────────────────────────────────
# Case 1: Edit on SKILL.md inserting a markdown table — BUG-FIX REGRESSION
# Before the fix, the hook validated the isolated new_string and rejected
# anything containing |---|---|. After the fix, the resulting file content is
# valid because the frontmatter is intact, so the edit must be allowed.
# ─────────────────────────────────────────────────────────────────────────────
echo "Case 1: Edit inserts markdown table (regression test for the bug fix)"
setup_tmp
mkdir -p "$TMP/skills/example"
f="$TMP/skills/example/SKILL.md"
write_skill_md "$f"
payload=$(edit_payload "$f" "Body content goes here." "Body content goes here.

| Column A | Column B |
|----------|----------|
| value 1  | value 2  |")
out=$(run_hook "$payload")
assert_allow "$out" "markdown table in new_string is allowed"
cleanup

# ─────────────────────────────────────────────────────────────────────────────
# Case 2: Edit on SKILL.md inserting a horizontal rule — BUG-FIX REGRESSION
# Same bug: --- as a markdown horizontal rule was wrongly treated as a
# frontmatter marker by the old logic.
# ─────────────────────────────────────────────────────────────────────────────
echo "Case 2: Edit inserts markdown horizontal rule (---)"
setup_tmp
mkdir -p "$TMP/skills/example"
f="$TMP/skills/example/SKILL.md"
write_skill_md "$f"
payload=$(edit_payload "$f" "More body content." "More body content.

---

A second section after a horizontal rule.")
out=$(run_hook "$payload")
assert_allow "$out" "horizontal rule in new_string is allowed"
cleanup

# ─────────────────────────────────────────────────────────────────────────────
# Case 3: Edit on SKILL.md that REMOVES the frontmatter — must be denied
# This is the genuine failure mode the hook is supposed to catch.
# ─────────────────────────────────────────────────────────────────────────────
echo "Case 3: Edit removes the frontmatter entirely"
setup_tmp
mkdir -p "$TMP/skills/example"
f="$TMP/skills/example/SKILL.md"
write_skill_md "$f"
payload=$(edit_payload "$f" "---
name: example-skill
description: A short, valid description for testing purposes.
---

" "")
out=$(run_hook "$payload")
assert_deny "$out" "file must start with ---" "denies edit that strips frontmatter"
cleanup

# ─────────────────────────────────────────────────────────────────────────────
# Case 4: Write a valid SKILL.md — allowed
# ─────────────────────────────────────────────────────────────────────────────
echo "Case 4: Write a valid SKILL.md"
setup_tmp
mkdir -p "$TMP/skills/example"
f="$TMP/skills/example/SKILL.md"
content="---
name: example-skill
description: A short, valid description.
---

# Body"
payload=$(write_payload "$f" "$content")
out=$(run_hook "$payload")
assert_allow "$out" "valid Write payload is allowed"
cleanup

# ─────────────────────────────────────────────────────────────────────────────
# Case 5: Write a SKILL.md with no frontmatter — denied
# ─────────────────────────────────────────────────────────────────────────────
echo "Case 5: Write a SKILL.md with no frontmatter"
setup_tmp
mkdir -p "$TMP/skills/example"
f="$TMP/skills/example/SKILL.md"
payload=$(write_payload "$f" "# Just a heading, no frontmatter")
out=$(run_hook "$payload")
assert_deny "$out" "file must start with ---" "denies Write without frontmatter"
cleanup

# ─────────────────────────────────────────────────────────────────────────────
# Case 6: Write a SKILL.md with description over 1024 chars — denied
# ─────────────────────────────────────────────────────────────────────────────
echo "Case 6: Write a SKILL.md with overly long description"
setup_tmp
mkdir -p "$TMP/skills/example"
f="$TMP/skills/example/SKILL.md"
long_desc=$(printf 'x%.0s' $(seq 1 1100))
content="---
name: example-skill
description: $long_desc
---

# Body"
payload=$(write_payload "$f" "$content")
out=$(run_hook "$payload")
assert_deny "$out" "description too long" "denies overly long description"
cleanup

# ─────────────────────────────────────────────────────────────────────────────
# Case 7: Edit on agent file removing the model field — denied
# ─────────────────────────────────────────────────────────────────────────────
echo "Case 7: Edit on agent file removes the model field"
setup_tmp
mkdir -p "$TMP/agents"
f="$TMP/agents/example.md"
write_agent_md "$f"
payload=$(edit_payload "$f" "model: sonnet
" "")
out=$(run_hook "$payload")
assert_deny "$out" "missing required fields: model" "denies removal of model field on agent"
cleanup

# ─────────────────────────────────────────────────────────────────────────────
# Case 8: Edit on a non-plugin path — skipped (allowed)
# ─────────────────────────────────────────────────────────────────────────────
echo "Case 8: Edit on a file outside skills/commands/agents"
setup_tmp
mkdir -p "$TMP/docs"
f="$TMP/docs/notes.md"
echo "no frontmatter at all" > "$f"
payload=$(edit_payload "$f" "no frontmatter at all" "still no frontmatter")
out=$(run_hook "$payload")
assert_allow "$out" "non-plugin path is silently skipped"
cleanup

# ─────────────────────────────────────────────────────────────────────────────
# Case 9: Edit on a reference file inside skills/ (non-SKILL.md) — skipped
# ─────────────────────────────────────────────────────────────────────────────
echo "Case 9: Edit on a non-SKILL.md reference file inside skills/"
setup_tmp
mkdir -p "$TMP/skills/example/reference"
f="$TMP/skills/example/reference/notes.md"
echo "no frontmatter" > "$f"
payload=$(edit_payload "$f" "no frontmatter" "still no frontmatter")
out=$(run_hook "$payload")
assert_allow "$out" "reference file inside skills/ is silently skipped"
cleanup

# ─────────────────────────────────────────────────────────────────────────────
# Case 10: Edit on non-existing file — fail-open (allowed)
# The Edit tool will surface its own error; the hook does not second-guess.
# ─────────────────────────────────────────────────────────────────────────────
echo "Case 10: Edit on non-existing file (fail-open)"
setup_tmp
mkdir -p "$TMP/skills/example"
f="$TMP/skills/example/SKILL.md"  # intentionally not created
payload=$(edit_payload "$f" "old" "new")
out=$(run_hook "$payload")
assert_allow "$out" "non-existing file is fail-open"
cleanup

# ─────────────────────────────────────────────────────────────────────────────
# Case 11: replace_all=true substitutes every occurrence in the resulting check
# ─────────────────────────────────────────────────────────────────────────────
echo "Case 11: Edit with replace_all=true (substitutes all occurrences)"
setup_tmp
mkdir -p "$TMP/skills/example"
f="$TMP/skills/example/SKILL.md"
# Build a file where removing ALL '---' lines kills both the open and close
# of the frontmatter (the file has only the two frontmatter dividers, no body rule).
write_skill_md "$f"
payload=$(edit_payload "$f" "---" "REPLACED" "true")
out=$(run_hook "$payload")
assert_deny "$out" "file must start with ---" "replace_all=true that kills frontmatter is denied"
cleanup

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
