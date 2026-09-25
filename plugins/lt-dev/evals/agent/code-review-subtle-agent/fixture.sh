#!/usr/bin/env bash
# Seeds a git repository: the trimmed nest-server-starter base from the nest-module-agent case, then one commit that
# adds a product module with five subtle defects (see graders/). The harder sibling of code-review-agent, whose
# obvious defects every effort level finds; this one leaves headroom to tell levels apart.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../nest-module-agent/fixture/." .
node -e 'const f="package.json";const p=JSON.parse(require("fs").readFileSync(f,"utf8"));delete p.scripts.check;require("fs").writeFileSync(f,JSON.stringify(p,null,2)+"\n")'
G="git -c user.name=Dev -c user.email=dev@example.com -c commit.gpgsign=false"
git init -q -b main
git add -A && $G commit -q -m "chore: project base"
cp -R "$HERE/change/." .
git add -A && $G commit -q -F - <<'MSG'
feat(product): add product module with search and stock reservation

Requirements (DEV-124):
- Logged-in users may create products; the creator and admins may update them. Nobody but an admin may change who
  created a product.
- The purchase price is visible to admins and to the product's creator only.
- Search by name is paginated; page numbers start at 1. The name is a plain text search, not a pattern.
- Reserving stock must never let stock go negative, also when many orders for the same product arrive at once.
- Every endpoint is covered by API tests.
MSG
git show HEAD > REVIEW.diff
