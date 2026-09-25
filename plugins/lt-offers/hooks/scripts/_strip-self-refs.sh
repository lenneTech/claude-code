#!/bin/bash
# Shared helper for the keyword detectors: defines strip_self_refs, which removes this
# marketplace's own plugin names and plugin paths from a prompt before it is matched.
#
# "lt-offers" contains "offer" and "lt-showroom" contains "showroom", so a prompt that
# merely names the plugins (or a path such as plugins/lt-offers/skills/demo-notes.md)
# would otherwise pass the keyword guard and, for lt-offers, even the demo-stage check.
# A whole plugins/lt-<name>/... path is removed, not only its prefix, because the rest
# of the path (skills/creating-offers/...) repeats the same keywords.
#
# Usage: CLEAN=$(strip_self_refs "$PROMPT_LOWER")   # expects lowercase input
#
# Identical copies live in lt-offers and lt-showroom: plugins run in isolation and
# cannot source each other's helpers.

strip_self_refs() {
  printf '%s\n' "$1" | sed -E 's#plugins/lt-[a-z0-9_-]+(/[^[:space:]]*)?##g; s#lt-(offers|showroom)##g'
}
