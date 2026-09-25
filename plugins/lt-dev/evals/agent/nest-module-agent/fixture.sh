#!/usr/bin/env bash
# Seeds the workspace with a trimmed nest-server-starter project (committed starter
# files: package.json, the project base PersistenceModel, the user module as the
# reference module, server.module.ts), so the agent works in a real project layout.
set -eu
cp -R "$(cd "$(dirname "$0")" && pwd)/fixture/." .
