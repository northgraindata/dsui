#!/usr/bin/env bash
set -euo pipefail

directory="${1:?usage: check-bundle-size.sh DIST_DIRECTORY}"
test -d "$directory"

# Emit measurements without a policy threshold. Thresholds belong in an
# agreed performance budget, not in delivery automation guessed from today.
find "$directory" -type f -print0 | sort -z | xargs -0 wc -c
