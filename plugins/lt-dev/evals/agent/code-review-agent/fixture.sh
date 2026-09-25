#!/usr/bin/env bash
# Seeds a git repository: the trimmed nest-server-starter project from the
# nest-module-agent case as the base commit, then one commit that adds a product
# module. The commit message carries the requirements; the change deliberately
# contains five defects the review is scored on (see graders/).
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../nest-module-agent/fixture/." .
# Without installed dependencies the project's check script cannot run; drop it so the
# review measures reading the change, not an install loop.
node -e 'const f="package.json";const p=JSON.parse(require("fs").readFileSync(f,"utf8"));delete p.scripts.check;require("fs").writeFileSync(f,JSON.stringify(p,null,2)+"\n")'
G="git -c user.name=Dev -c user.email=dev@example.com -c commit.gpgsign=false"
git init -q -b main
git add -A && $G commit -q -m "chore: project base"
cp -R "$HERE/change/." .
git add -A && $G commit -q -F - <<'MSG'
feat(product): add product module

Requirements (DEV-123):
- Logged-in users may read products and search them by name.
- Only admins may create, update and delete products.
- The purchase price (purchasePrice) is internal: only admins may see it.
- getDiscountedPrice returns the price after deducting discountPercent percent.
- Every endpoint is covered by API tests.
MSG
# Eval runs cannot grant Bash on every machine (the sandbox refuses when the Docker
# config holds symlinks, as Docker Desktop's cli-plugins do), so the change is also
# handed over as a file the reviewer can read without git.
git show HEAD > REVIEW.diff
