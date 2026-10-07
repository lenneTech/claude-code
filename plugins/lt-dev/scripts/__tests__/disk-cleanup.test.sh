#!/bin/bash
# Tests for scripts/disk-audit.sh, scripts/disk-clean.sh, scripts/disk-guards.sh and the guards.
#
# Hermetic: HOME is a temp directory, and docker, pnpm, ps, lsof, launchctl, mongosh, npm,
# pgrep, osascript and xcrun are stubs earlier on PATH. The tests therefore assert the DECISIONS —
# what counts as stale, in use, safe to lose, still referenced — not this machine's state.
# Those decisions are the point: every one of them was got wrong by hand at least once while
# the cleanup these scripts encode was done interactively (2026-10-02).
#
# Run: bash scripts/__tests__/disk-cleanup.test.sh

set -u

SCRIPTS="$(cd "$(dirname "$0")/.." && pwd)"

# The scripts are Unix tools (lsof, ps, launchctl): there is nothing to test on Windows.
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) echo "skipped: disk-cleanup scripts are macOS/Linux only"; exit 0 ;; esac
PASS=0
FAIL=0

ok()   { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; [ -n "${2:-}" ] && printf '    %s\n' "$2"; }
assert_line()    { printf '%s\n' "$1" | grep -qE "$2" && ok "$3" || fail "$3" "no line matching: $2"; }
assert_no_line() { printf '%s\n' "$1" | grep -qE "$2" && fail "$3" "unexpected line matching: $2" || ok "$3"; }
assert_exists()  { [ -e "$1" ] && ok "$2" || fail "$2" "missing: $1"; }
assert_missing() { [ -e "$1" ] && fail "$2" "still present: $1" || ok "$2"; }
debug()          { [ -n "${DISK_TEST_DEBUG:-}" ] && printf '%s\n' "--- $1" "$2" >&2; return 0; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export HOME="$TMP/home"
STUB="$TMP/bin"
mkdir -p "$HOME" "$STUB"
: > "$TMP/ps.txt"; : > "$TMP/cwd.txt"; : > "$TMP/calls.txt"

stub() { printf '#!/bin/bash\n%s\n' "$2" > "$STUB/$1"; chmod +x "$STUB/$1"; }
stub node 'exit 0'
stub npx 'exit 0'
stub ps "cat '$TMP/ps.txt'"
stub lsof "case \"\$*\" in *cwd*) sed 's/^/n/' '$TMP/cwd.txt' ;; *) exit 1 ;; esac"
stub pgrep 'exit 1'
stub osascript 'exit 0'
# The real `xcrun simctl` lists this machine's simulators and starts the simulator service:
# 2.8 s on a warm Mac; on a cold macos-latest runner the audit call that ran it took 31 s.
stub xcrun 'exit 0'
stub npm "echo \"npm \$*\" >> '$TMP/calls.txt'"
stub mongosh "echo \"mongosh \$*\" >> '$TMP/calls.txt'"
stub launchctl "echo \"launchctl \$*\" >> '$TMP/calls.txt'; case \"\$1\" in print) [ -f '$TMP/loaded' ] ;; esac"
stub pnpm "case \"\$*\" in
  'store path') echo \"\$HOME/Library/pnpm/store/v11\" ;;
  'store prune') echo 'Removed 3 files (1 MB)'; echo pruned >> '$TMP/calls.txt' ;;
  '--version') echo 11.0.0 ;;
esac"
# docker: answers from fixture files; DOCKER_DOWN=1 simulates a stopped daemon.
stub docker "f='$TMP/docker'
case \"\$*\" in
  info) [ \"\${DOCKER_DOWN:-0}\" = 0 ] ;;
  'system df') cat \"\$f/df.txt\" ;;
  'system df -v') cat \"\$f/df-v.txt\" ;;
  'ps -aq') cut -f1 \"\$f/containers.txt\" ;;
  ps\ -a*) cat \"\$f/stopped.txt\" ;;
  *'{{.Image}}'*) for c in \"\${@:4}\"; do awk -F'\t' -v k=\"\$c\" '\$1 == k {print \$2}' \"\$f/containers.txt\"; done ;;
  images*) cat \"\$f/images.txt\" ;;
  *State.FinishedAt*) awk -F'\t' -v k=\"\${@: -1}\" '\$1 == k {print \$2}' \"\$f/finished.txt\" ;;
  *State.Status*) awk -F'\t' -v k=\"\${@: -1}\" '\$1 == k {print \$2}' \"\$f/status.txt\" ;;
  'volume ls -qf dangling=true') cat \"\$f/dangling.txt\" ;;
  *) echo \"docker \$*\" >> '$TMP/calls.txt' ;;
esac"
export PATH="$STUB:/usr/bin:/bin:/usr/sbin:/sbin"

OLD=202401010000
mkproject() {  # mkproject <dir> [old] [nolock]
  mkdir -p "$1/node_modules/pkg"
  echo '{}' > "$1/package.json"; echo x > "$1/node_modules/pkg/index.js"
  [ "${3:-}" = nolock ] || echo 'lockfileVersion: 9' > "$1/pnpm-lock.yaml"
  if [ "${2:-}" = old ]; then for f in "$1/package.json" "$1/pnpm-lock.yaml"; do [ -f "$f" ] && touch -t $OLD "$f"; done; fi
  return 0
}
gitc() { git -C "$1" -c user.name=t -c user.email=t@t -c commit.gpgsign=false "${@:2}" >/dev/null 2>&1; }

# ---------------------------------------------------------------- fixtures
mkproject "$HOME/code/old" old
mkdir -p "$HOME/code/old/.nuxt"; touch "$HOME/code/old/.nuxt/x"
mkproject "$HOME/code/fresh"
mkproject "$HOME/code/busy" old
mkproject "$HOME/code/nolock" old nolock
echo "$HOME/code/busy" >> "$TMP/cwd.txt"

mkdir -p "$HOME/tests"
mkproject "$HOME/tests/plain" old
mkproject "$HOME/tests/local" old; git init -q "$HOME/tests/local"; echo node_modules > "$HOME/tests/local/.gitignore"; gitc "$HOME/tests/local" add -A; gitc "$HOME/tests/local" commit -m init
mkproject "$HOME/tests/dirty" old; git init -q "$HOME/tests/dirty"; echo node_modules > "$HOME/tests/dirty/.gitignore"; gitc "$HOME/tests/dirty" add -A; gitc "$HOME/tests/dirty" commit -m init; echo change > "$HOME/tests/dirty/work.txt"
git init -q --bare "$TMP/origin.git"
mkproject "$HOME/tests/clean" old; git init -q "$HOME/tests/clean"; echo node_modules > "$HOME/tests/clean/.gitignore"; gitc "$HOME/tests/clean" add -A; gitc "$HOME/tests/clean" commit -m init
gitc "$HOME/tests/clean" remote add origin "$TMP/origin.git"; gitc "$HOME/tests/clean" push origin HEAD:main

S="$HOME/Library/pnpm/store"
mkdir -p "$S/v9/links" "$S/v10/files" "$S/v11/files" "$S/v12/files"

PW="$HOME/Library/Caches/ms-playwright"
mkdir -p "$PW/chromium-100" "$PW/chromium-200" "$PW/.links" "$TMP/core"
printf '{"browsers":[{"name":"chromium","revision":"100"}]}\n' > "$TMP/core/browsers.json"
echo "$TMP/core" > "$PW/.links/abc"

echo heap > "$HOME/java_error_in_idea.hprof"
mkdir -p "$HOME/Downloads"; echo iso > "$HOME/Downloads/win.iso"; echo txt > "$HOME/notes.txt"
JB="$HOME/Library/Application Support/JetBrains"; mkdir -p "$JB/WebStorm2025.3" "$JB/WebStorm2026.1"

D="$TMP/docker"; mkdir -p "$D"
printf 'TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE\nImages          53        24        80.35GB   50.97GB (63%%)\nContainers      32        13        5.588GB   5.463GB (97%%)\nLocal Volumes   100       27        36.03GB   25.58GB (70%%)\nBuild Cache     169       0         30.15GB   21.18GB\n' > "$D/df.txt"
anon=$(printf 'a%.0s' $(seq 64))
printf 'Images space usage:\n\nREPOSITORY TAG\nx y\n\nLocal Volumes space usage:\n\nVOLUME NAME   LINKS     SIZE\ncrm_data      0         2.5GB\nlive_data     1         1GB\n%s   0   300MB\n\nBuild cache usage: 0B\n' "$anon" > "$D/df-v.txt"
printf 'c1\told_db\nc2\tfresh_db\n' > "$D/stopped.txt"
printf 'c1\t2024-01-01T00:00:00.000000000Z\nc2\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%S).0Z" > "$D/finished.txt"
printf 'old_db\texited\nrunning_db\trunning\n' > "$D/status.txt"
printf 'c1\tsha256:aaa\nc2\tsha256:aaa\n' > "$D/containers.txt"
printf 'sha256:aaa\t1.5GB\nsha256:bbb\t500MB\nsha256:ccc\t250MB\n' > "$D/images.txt"
printf 'crm_data\n%s\n' "$anon" > "$D/dangling.txt"

AUDIT=(bash "$SCRIPTS/disk-audit.sh" --min-mb 0 --no-large-files --throwaway "$HOME/tests")
CLEAN=(bash "$SCRIPTS/disk-clean.sh")

# ---------------------------------------------------------------- audit
echo "disk-audit.sh"
out="$("${AUDIT[@]}")"; debug audit "$out"
assert_line    "$out" '^# disk-audit free_mb=[0-9]+ code_root=~/code' "header carries free space and code root"
assert_line    "$out" $'^node-modules:~/code/old/node_modules\tregenerable' "stale project with lockfile: regenerable"
assert_line    "$out" $'^node-modules:~/code/nolock/node_modules\tdata\t.*no lockfile' "stale project without lockfile: data"
assert_no_line "$out" 'code/fresh/node_modules' "recently touched project is not listed"
assert_no_line "$out" 'code/busy/node_modules' "project with a running process (cwd) is not listed"
assert_line    "$out" $'^build-output:~/code/old/.nuxt\tregenerable' "build output of a stale project"
assert_line    "$out" $'^project-dir:~/tests/plain\tdata\t.*git=no-git' "throwaway dir without git"
assert_line    "$out" $'^project-dir:~/tests/clean\tdata\t.*git=safe' "throwaway repo pushed and clean: safe"
assert_line    "$out" $'^project-dir:~/tests/local\tdata\t.*git=no-remote' "throwaway repo without remote"
assert_line    "$out" $'^project-dir:~/tests/dirty\tdata\t.*git=dirty:1' "throwaway repo with uncommitted work"
assert_line    "$out" $'^node-modules-all:~/tests/local\tregenerable' "unsafe throwaway offers node_modules only"
assert_no_line "$out" '^node-modules-all:~/tests/clean' "safe throwaway needs no node_modules-only option"
assert_no_line "$out" '^node-modules:~/tests/' "throwaway projects are not double-counted as node-modules"
assert_line    "$out" $'^pnpm-store:v11\tregenerable' "active pnpm generation"
assert_line    "$out" $'^pnpm-store-old:v10\tregenerable' "older generation without links/"
assert_line    "$out" $'^pnpm-store-kept:v9\tinfo' "older generation WITH links/ is kept"
assert_line    "$out" $'^pnpm-store-kept:v12\tinfo' "newer generation is kept"
assert_line    "$out" $'^playwright-browser:chromium-200\tregenerable' "unreferenced Playwright revision"
assert_no_line "$out" 'playwright-browser:chromium-100' "referenced Playwright revision is kept"
assert_line    "$out" $'^junk-file:~/java_error_in_idea.hprof\tregenerable' "heap dump in home"
assert_line    "$out" $'^junk-file:~/Downloads/win.iso\tregenerable' "installer image in Downloads"
assert_line    "$out" $'^jetbrains-old:~/Library/Application Support/JetBrains/WebStorm2025.3\tregenerable' "older JetBrains version"
assert_no_line "$out" '^jetbrains-old:.*WebStorm2026\.1'$'\t' "newest JetBrains version is kept"
assert_line    "$out" $'^docker-build-cache\tregenerable\t21180' "docker build cache reclaimable MB"
assert_line    "$out" $'^docker-images\tregenerable\t750\t2 images' "counts only images no container references"
assert_line    "$out" $'^docker-volume:crm_data\tdata\t2500' "named unused volume is data"
assert_no_line "$out" 'docker-volume:live_data' "volume in use is not listed"
assert_line    "$out" $'^docker-volumes-anonymous\tdata\t300\t1 anonymous' "anonymous unused volumes aggregated"
assert_line    "$out" $'^docker-container:old_db\tregenerable' "container stopped long ago"
assert_no_line "$out" 'docker-container:fresh_db' "container stopped today is kept"
order="$(printf '%s\n' "$out" | grep -v '^#' | cut -f2 | uniq | tr '\n' ' ')"
[ "$order" = "regenerable data info " ] && ok "sorted regenerable → data → info" || fail "sorted by class" "got: $order"
out="$(DOCKER_DOWN=1 "${AUDIT[@]}")"
assert_line    "$out" $'^docker\tinfo\t0\tdaemon not running' "stopped Docker daemon is reported, not an error"

# ---------------------------------------------------------------- clean
echo "disk-clean.sh"
out="$("${CLEAN[@]}" node-modules:~/code/old)"
assert_line "$out" $'^refused\tnode-modules:~/code/old\t' "refuses a node-modules id that is not a node_modules dir"
mkdir -p "$HOME/elsewhere/node_modules"
out="$("${CLEAN[@]}" node-modules:~/elsewhere/node_modules)"
assert_line "$out" '^refused.*outside the code root' "refuses node_modules outside the code root"
out="$("${CLEAN[@]}" node-modules:~/code/busy/node_modules)"
assert_line "$out" '^refused.*running process' "refuses a project in use"
out="$("${CLEAN[@]}" --dry-run node-modules:~/code/old/node_modules)"
assert_line "$out" '^dry-run' "dry-run reports"; assert_exists "$HOME/code/old/node_modules" "dry-run deletes nothing"
echo "bash $SCRIPTS/disk-clean.sh node-modules:$HOME/code/old/node_modules" >> "$TMP/ps.txt"
out="$("${CLEAN[@]}" "node-modules:$HOME/code/old/node_modules")"
assert_line "$out" $'^ok\tnode-modules:' "absolute-path id is not blocked by the executor's own command line"
assert_missing "$HOME/code/old/node_modules" "stale node_modules removed"
assert_line "$out" '^# freed_mb=-?[0-9]+ free_mb=[0-9]+' "reports the df-measured gain"

out="$("${CLEAN[@]}" project-dir:~/tests/dirty)"
assert_line "$out" '^refused.*git=dirty:1' "refuses a project with uncommitted work"
assert_exists "$HOME/tests/dirty/work.txt" "unsaved work survives the refusal"
out="$("${CLEAN[@]}" project-dir:~/tests/local)"
assert_line "$out" '^refused.*git=no-remote' "refuses a repo whose commits exist only here"
out="$("${CLEAN[@]}" node-modules-all:~/tests/local)"
assert_line "$out" $'^ok\tnode-modules-all:~/tests/local\t1 node_modules' "node-modules-all frees space and keeps the repo"
assert_exists "$HOME/tests/local/.git" "repo kept"; assert_missing "$HOME/tests/local/node_modules" "its node_modules gone"
out="$("${CLEAN[@]}" --accept-data-loss project-dir:~/tests/dirty)"
assert_line "$out" '^ok.*git=dirty:1' "--accept-data-loss deletes after explicit confirmation"
out="$("${CLEAN[@]}" project-dir:~/tests/clean project-dir:~/tests/plain)"
assert_missing "$HOME/tests/clean" "safe repo deleted"; assert_missing "$HOME/tests/plain" "dir without git deleted"
out="$("${CLEAN[@]}" project-dir:~/code)"
assert_line "$out" '^refused.*top-level' "refuses a top-level directory"

out="$("${CLEAN[@]}" docker-volume:live_data docker-volume:crm_data)"
assert_line "$out" $'^refused\tdocker-volume:live_data\tin use' "refuses a volume a container uses"
grep -q 'docker volume rm crm_data' "$TMP/calls.txt" && ok "removes an unused volume" || fail "removes an unused volume"
out="$("${CLEAN[@]}" docker-container:running_db docker-container:old_db)"
assert_line "$out" $'^refused\tdocker-container:running_db\tstate is running' "refuses a running container"
grep -q 'docker rm old_db' "$TMP/calls.txt" && ok "removes a stopped container" || fail "removes a stopped container"

out="$("${CLEAN[@]}" pnpm-store-old:v9 pnpm-store-old:v12 pnpm-store-old:v10)"
assert_line "$out" $'^refused\tpnpm-store-old:v9\t.*global virtual store' "keeps an older generation with links/"
assert_line "$out" $'^refused\tpnpm-store-old:v12\t.*not older' "keeps a newer generation"
assert_missing "$S/v10" "removes an older generation"
echo "node /x/pnpm/bin/pnpm.cjs install --frozen-lockfile" > "$TMP/ps.txt"
out="$("${CLEAN[@]}" pnpm-store:v11)"
assert_line "$out" '^refused.*writing to the store' "no prune while an install writes"
: > "$TMP/ps.txt"
out="$("${CLEAN[@]}" pnpm-store:v10 pnpm-store:v11)"
assert_line "$out" $'^refused\tpnpm-store:v10\t.*not the active' "prunes only the active generation"
grep -q '^pruned' "$TMP/calls.txt" && ok "prunes the active store" || fail "prunes the active store"

out="$("${CLEAN[@]}" playwright-browser:chromium-100 playwright-browser:chromium-200)"
assert_line "$out" $'^refused\tplaywright-browser:chromium-100\t.*used by' "keeps a referenced browser"
assert_missing "$PW/chromium-200" "removes an unreferenced browser"
out="$("${CLEAN[@]}" junk-file:~/notes.txt junk-file:~/java_error_in_idea.hprof)"
assert_line "$out" $'^refused\tjunk-file:~/notes.txt' "junk-file accepts only .hprof/.iso/.dmg"
assert_missing "$HOME/java_error_in_idea.hprof" "removes a heap dump"
out="$("${CLEAN[@]}" "jetbrains-old:~/Library/Application Support/JetBrains/WebStorm2026.1" "jetbrains-old:~/Library/Application Support/JetBrains/WebStorm2025.3")"
assert_line "$out" '^refused.*newest' "keeps the newest JetBrains version"
assert_missing "$JB/WebStorm2025.3" "removes the older JetBrains version"
out="$("${CLEAN[@]}" photos-library:~/Pictures/x.photoslibrary something-else:x)"
assert_line "$out" '^refused.*report only' "personal findings are never acted on"
assert_line "$out" $'^refused\tsomething-else:x\tunknown id' "unknown ids are refused"

# ---------------------------------------------------------------- real process table
# The stubs above cannot reproduce a self-match: the real ps lists the matcher process itself.
# A snapshot taken on the left of a pipe saw the awk/grep on the right, whose arguments carry
# the path — every path read as "in use" (2026-10-03). Checked against the REAL ps and lsof.
echo "process matching against the real ps"
out="$(PATH=/usr/bin:/bin:/usr/sbin:/sbin bash -c '. "$1/lib/disk-common.sh"
  path_in_use "/nonexistent/disk-test-$$/project" && echo path:HIT || echo path:MISS
  proc_mentions "/nonexistent-marker-$$/" && echo mention:HIT || echo mention:MISS' _ "$SCRIPTS")"
assert_line "$out" '^path:MISS$' "path_in_use does not match its own matcher process"
assert_line "$out" '^mention:MISS$' "proc_mentions does not match its own matcher process"

# ---------------------------------------------------------------- guards
if [ "$(uname)" = Darwin ]; then
  echo "disk-guards.sh + guards"
  out="$(bash "$SCRIPTS/disk-guards.sh" install)"
  G="$HOME/.local/share/lt-dev/guards"
  assert_exists "$G/pnpm-store-guard.sh" "guard copied out of the plugin cache"
  assert_exists "$G/lib/disk-common.sh" "its library copied along"
  P="$HOME/Library/LaunchAgents/tech.lenne.lt-dev.pnpm-store-guard.plist"
  plutil -lint "$P" >/dev/null 2>&1 && ok "plist is valid" || fail "plist is valid"
  grep -q "$G/pnpm-store-guard.sh" "$P" && ok "plist points at the copy, not the plugin" || fail "plist points at the copy"
  grep -q 'launchctl bootstrap' "$TMP/calls.txt" && ok "agent loaded" || fail "agent loaded"

  export LT_DISK_GUARD_PATH="$STUB:/usr/bin:/bin"
  mkdir -p "$S/v10/files"; dd if=/dev/zero of="$S/v11/files/blob" bs=1048576 count=2 2>/dev/null
  out="$(bash "$G/pnpm-store-guard.sh")"
  assert_line "$out" 'nothing to do' "below the threshold nothing happens"
  echo "node /x/pnpm install" > "$TMP/ps.txt"
  out="$(LT_PNPM_STORE_GUARD_THRESHOLD_MB=1 bash "$G/pnpm-store-guard.sh" --force)"
  assert_line "$out" 'skipped, pnpm is writing' "guard waits for running installs"
  : > "$TMP/ps.txt"
  out="$(LT_PNPM_STORE_GUARD_THRESHOLD_MB=1 bash "$G/pnpm-store-guard.sh" 2>&1)"; debug guard "$out"
  assert_line "$out" 'v10: removed' "guard removes an older generation"
  assert_line "$out" 'v9: holds a global virtual store' "guard keeps a generation with links/"
  assert_line "$out" 'v12: newer than the active generation' "guard keeps a newer generation"
  assert_exists "$S/v12" "newer generation survives"
  out="$(LT_PNPM_STORE_GUARD_THRESHOLD_MB=1 bash "$G/pnpm-store-guard.sh")"
  assert_line "$out" 'last prune 0 d ago' "minimum interval between prunes"

  out="$(bash "$SCRIPTS/disk-guards.sh" uninstall)"
  assert_missing "$P" "uninstall removes the agent"; assert_missing "$G" "uninstall removes the copies"
fi

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
