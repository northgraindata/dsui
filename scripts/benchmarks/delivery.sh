#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts
image="dsui:benchmark"
docker build --tag "$image" .

image_bytes="$(docker image inspect "$image" --format '{{.Size}}')"
web_bundle_bytes="$(find apps/web/dist -type f -printf '%s\n' | awk '{sum += $1} END {print sum + 0}')"
started_ns="$(date +%s%N)"
container_id="$(docker run -d -p 127.0.0.1::4192 "$image")"
cleanup() { docker rm -f "$container_id" >/dev/null 2>&1 || true; }
trap cleanup EXIT
port="$(docker port "$container_id" 4192/tcp | sed 's/.*://')"

for _ in $(seq 1 60); do
  if curl --fail --silent "http://127.0.0.1:${port}/" >/dev/null; then
    ready_ns="$(date +%s%N)"
    break
  fi
  sleep 0.25
done
: "${ready_ns:?Container did not become ready within 15 seconds}"
idle_memory="$(docker stats --no-stream --format '{{.MemUsage}}' "$container_id")"

jq -n \
  --arg generated_at "$(date --iso-8601=seconds)" \
  --arg image "$image" \
  --arg idle_memory "$idle_memory" \
  --argjson image_bytes "$image_bytes" \
  --argjson web_bundle_bytes "$web_bundle_bytes" \
  --argjson cold_start_ms "$(( (ready_ns - started_ns) / 1000000 ))" \
  '{generated_at: $generated_at, image: $image, image_bytes: $image_bytes, web_bundle_bytes: $web_bundle_bytes, idle_memory: $idle_memory, cold_start_ms: $cold_start_ms}' \
  >artifacts/benchmarks.json
cat artifacts/benchmarks.json
