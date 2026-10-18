#!/usr/bin/env bash
# Seeds a git repository for a review whose defect sits outside the diff. Base on main: the trimmed
# nest-server-starter project from the nest-module-agent case plus a small shop (pricing, payment, catalog, cart,
# invoices; base/). Branch fix/invoice-cents: one commit (change/, 2 files, 16 changed lines, so /lt-dev:review takes
# its small-diff path) that makes PricingService.grossPrice return whole cents and adapts InvoiceService. The untouched
# CartService.checkout still converts the result to cents a second time. Decoys below the bar sit in the diff too: a
# naming nit, a deprecated call, and a direct Model access documented with the Informed-Trade-off comment. See graders/.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../nest-module-agent/fixture/." .
# Without installed dependencies the project's check script cannot run; drop it so the
# review measures reading the change, not an install loop.
node -e 'const f="package.json";const p=JSON.parse(require("fs").readFileSync(f,"utf8"));delete p.scripts.check;require("fs").writeFileSync(f,JSON.stringify(p,null,2)+"\n")'
cp -R "$HERE/base/." .
G="git -c user.name=Dev -c user.email=dev@example.com -c commit.gpgsign=false"
git init -q -b main
git add -A && $G commit -q -m "feat(shop): pricing, payment, catalog, cart checkout and invoices"
git checkout -q -b fix/invoice-cents
cp -R "$HERE/change/." .
git add -A && $G commit -q -F - <<'MSG'
fix(invoice): keep invoice totals exact in whole cents

Requirements:
- Invoice totals are exact to the cent, also for invoices with many lines (no floating-point drift).
- Two lines added to the same invoice at the same time are both counted.
- PricingService.grossPrice returns whole cents, so every amount the services pass around is an integer.
MSG
# Eval runs cannot grant Bash on every machine (the sandbox refuses when the Docker
# config holds symlinks, as Docker Desktop's cli-plugins do), so the commit is also
# handed over as a file: message, stat and patch.
git show --patch-with-stat HEAD > REVIEW.diff
