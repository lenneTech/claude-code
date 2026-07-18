#!/usr/bin/env bash
# Aktiviert die Sicherheits-Hooks lokal. Einmalig nach dem Klonen ausführen.
set -e
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
chmod +x .githooks/* scripts/scan-secrets.sh scripts/install-hooks.sh 2>/dev/null || true
echo "✓ Sicherheits-Hooks aktiv (core.hooksPath=.githooks)."
echo "  Test: scripts/scan-secrets.sh --all"
