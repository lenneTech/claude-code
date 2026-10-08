#!/usr/bin/env bash
# find-vault-logins.sh — which 1Password logins belong to a deployed stage?
#
# A QA step that says "Als Admin anmelden" sends the tester hunting for the
# account. This script finds the Login items whose URL points at the stage the
# tester will use, and returns for each one what a Linear comment may carry:
# the login name and a private link to the vault entry.
#
# It never reads a secret. `op item list` returns overview data only (title,
# vault, URLs, tags, and for a Login the username as `additional_information`),
# and `op item get --share-link` returns the item's PRIVATE link, which opens
# only for people who already have access to that vault. Despite its name that
# flag mints no public link. `op item share` does, a tokenized copy that anyone
# holding the URL can open, and this script never calls it.
#
# Matching is by URL host and deliberately one-directional: an item matches when
# its host equals a given host or is a subdomain of it. A parent domain does not
# match, so the production login for example.com is never offered for a review
# on app.dev.example.com.
#
# Items in personal vaults (Private, Personal, Employee) are skipped unless
# --include-personal is set: a private link into somebody's personal vault
# opens for nobody else.
#
# Usage:
#   find-vault-logins.sh --host <host-or-url> [--host <host-or-url> ...]
#                        [--account <account>] [--title-contains <text>]
#                        [--include-personal]
#
#   --host              stage host to match; a full URL is reduced to its host.
#                       Pass the app host and the API host of the stage.
#   --account           1Password account (sign-in address or ID); default: every
#                       account `op account list` reports
#   --title-contains    additionally require this text in the item title
#                       (case-insensitive), e.g. the project slug
#   --include-personal  keep items from personal vaults
#
# Output: one JSON object per matching login, one per line:
#   {"title","login","itemId","vaultId","vaultName","account","urls","tags","link"}
#
# Exit codes:
#   0  at least one matching login
#   1  no matching login
#   2  op or jq missing, bad arguments, or no account could be listed
#      (op not signed in, authorization prompt dismissed)

set -u

hosts=()
account=""
title_contains=""
include_personal=false

while [ $# -gt 0 ]; do
  case "$1" in
    --host) hosts+=("${2:-}"); shift 2 ;;
    --account) account="${2:-}"; shift 2 ;;
    --title-contains) title_contains="${2:-}"; shift 2 ;;
    --include-personal) include_personal=true; shift ;;
    -h|--help) sed -n '2,46p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "find-vault-logins: unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ ${#hosts[@]} -eq 0 ]; then
  echo "find-vault-logins: at least one --host is required" >&2
  exit 2
fi
if ! command -v op >/dev/null 2>&1; then
  echo "find-vault-logins: 1Password CLI (op) not installed" >&2
  exit 2
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "find-vault-logins: jq not installed" >&2
  exit 2
fi

hosts_json=$(printf '%s\n' "${hosts[@]}" | jq -R . | jq -sc .)

if [ -n "$account" ]; then
  accounts="$account"
else
  accounts=$(op account list --format json 2>/dev/null | jq -r '.[]?.url // empty' 2>/dev/null)
fi
if [ -z "$accounts" ]; then
  echo "find-vault-logins: no 1Password account available (op account list returned none)" >&2
  exit 2
fi

# shellcheck disable=SC2016  # jq program, not shell expansion
filter='
  def host: ascii_downcase
    | sub("^[a-z][a-z0-9+.-]*://"; "")
    | sub("[/?#].*$"; "")
    | sub("^[^@]*@"; "")
    | sub(":[0-9]+$"; "");
  ($hosts | map(host)) as $want
  | .[]?
  | select(
      ([.urls[]?.href // empty | host] as $have
        | any($have[] as $h | $want[] as $w | ($h == $w or ($h | endswith("." + $w))); .)))
  | select($personal or ((.vault.name // "") | test("^(private|personal|employee|privat|persönlich)$"; "i") | not))
  | select($title == "" or ((.title // "") | ascii_downcase | contains($title | ascii_downcase)))
  | {
      title: (.title // ""),
      login: (.additional_information // ""),
      itemId: .id,
      vaultId: (.vault.id // ""),
      vaultName: (.vault.name // ""),
      urls: [.urls[]?.href // empty],
      tags: (.tags // [])
    }'

listed_any=false
found=0
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

# A native jq.exe on Windows ends every line it prints with CRLF; `read` keeps the CR,
# and `op --account "<url>\r"` lists nothing (Plugin CI windows-latest, 2026-10-07).
while IFS= read -r acct; do
  acct="${acct%$'\r'}"
  [ -n "$acct" ] || continue
  if ! op item list --categories Login --account "$acct" --format json >"$tmp" 2>/dev/null; then
    echo "find-vault-logins: could not list items for account $acct" >&2
    continue
  fi
  listed_any=true
  while IFS= read -r item; do
    item="${item%$'\r'}"
    [ -n "$item" ] || continue
    item_id=$(printf '%s' "$item" | jq -r '.itemId')
    vault_id=$(printf '%s' "$item" | jq -r '.vaultId')
    link=$(op item get "$item_id" --vault "$vault_id" --account "$acct" --share-link 2>/dev/null | head -n 1)
    printf '%s' "$item" | jq -c --arg account "$acct" --arg link "$link" '. + {account: $account, link: $link}'
    found=$((found + 1))
  done < <(jq -c --argjson hosts "$hosts_json" --arg title "$title_contains" \
             --argjson personal "$include_personal" "$filter" "$tmp" 2>/dev/null)
done <<EOF
$accounts
EOF

if [ "$listed_any" = false ]; then
  echo "find-vault-logins: no account could be listed — op not signed in or authorization dismissed" >&2
  exit 2
fi
[ "$found" -gt 0 ] && exit 0
exit 1
