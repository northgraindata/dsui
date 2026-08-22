#!/usr/bin/env bash
set -euo pipefail

directory="${1:?usage: package-release.sh RELEASE_DIRECTORY}"
mkdir -p "$directory/.staged"

find "$directory" -type f -name 'dsui-*' ! -path "$directory/.staged/*" ! -name '*.tar.gz' ! -name '*.sha256' -exec cp {} "$directory/.staged/" \;
for binary in "$directory"/.staged/dsui-*; do
  [ -f "$binary" ] || continue
  name="$(basename "$binary")"
  tar -C "$directory/.staged" -czf "$directory/${name}.tar.gz" "$name"
done
find "$directory" -maxdepth 1 -type f -name '*.tar.gz' -print0 | sort -z | xargs -0 sha256sum >"$directory/checksums.sha256"
find "$directory/.staged" -maxdepth 1 -type f -delete
rmdir "$directory/.staged"
