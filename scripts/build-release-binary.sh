#!/usr/bin/env bash
set -euo pipefail

os="${1:?usage: build-release-binary.sh OS ARCH}"
arch="${2:?usage: build-release-binary.sh OS ARCH}"
case "$os/$arch" in
  linux/amd64|linux/arm64|darwin/amd64|darwin/arm64) ;;
  *) echo "Unsupported release target: $os/$arch" >&2; exit 2 ;;
esac

mkdir -p dist/release
output="dist/release/dsui-${os}-${arch}"
bun build packages/cli/src/index.ts --compile --minify --target="bun-${os}-${arch}" --outfile "$output"
chmod +x "$output"
test -s "$output"
