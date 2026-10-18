#!/usr/bin/env bash
# Seeds the trimmed nest-server-starter project from the nest-module-agent case plus a credit-account module
# (fixture/): transfer() and redeem() both take credits off through one private debit() that has no balance check,
# and an API test file covering the happy paths. The bug report in prompt.md names transfers only.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../nest-module-agent/fixture/." .
cp -R "$HERE/fixture/." .
