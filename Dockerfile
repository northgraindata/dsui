# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.12 AS build
WORKDIR /src

COPY package.json bun.lock tsconfig.json turbo.json biome.json ./
COPY apps ./apps
COPY packages ./packages
COPY examples ./examples
RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --filter @northgraindata/dsui-web build
RUN mkdir -p /out/data /out/runtime && \
  bun build packages/server/src/main.ts --compile --minify --outfile /out/dsui && \
  mkdir -p /out/runtime/adapters && \
  bun build packages/adapter-airflow/src/adapter.ts --bundle --target bun --format esm --outfile /out/runtime/adapters/airflow.mjs && \
  bun build packages/adapter-dbt/src/adapter.ts --bundle --target bun --format esm --outfile /out/runtime/adapters/dbt.mjs && \
  bun build packages/adapter-duckdb/src/adapter.ts --bundle --target bun --format esm \
    --external @duckdb/node-bindings-linux-arm64 \
    --external @duckdb/node-bindings-linux-arm64-musl \
    --external @duckdb/node-bindings-linux-x64 \
    --external @duckdb/node-bindings-linux-x64-musl \
    --external @duckdb/node-bindings-darwin-arm64 \
    --external @duckdb/node-bindings-darwin-x64 \
    --external @duckdb/node-bindings-win32-arm64 \
    --external @duckdb/node-bindings-win32-x64 \
    --outfile /out/runtime/adapters/duckdb.mjs && \
  bun build packages/adapter-postgresql/src/adapter.ts --bundle --target bun --format esm --outfile /out/runtime/adapters/postgresql.mjs && \
  bun build packages/adapter-s3/src/adapter.ts --bundle --target bun --format esm --outfile /out/runtime/adapters/s3.mjs && \
  mkdir -p /out/runtime/adapters/node_modules && \
  for package in packages/adapter-*; do \
    if [ -d "$package/node_modules" ]; then cp -aL "$package/node_modules/." /out/runtime/adapters/node_modules/; fi; \
  done && \
  mkdir -p /out/runtime/adapters/node_modules/@duckdb && \
  for package in node_modules/.bun/@duckdb+node-bindings*; do \
    if [ -d "$package/node_modules/@duckdb" ]; then cp -aL "$package/node_modules/@duckdb/." /out/runtime/adapters/node_modules/@duckdb/; fi; \
  done

FROM gcr.io/distroless/cc-debian12:nonroot
WORKDIR /app
COPY --from=build --chown=65532:65532 /out/dsui /usr/local/bin/dsui
COPY --from=build --chown=65532:65532 /src/apps/web/dist /app/web
COPY --from=build --chown=65532:65532 /out/data /data
COPY --from=build --chown=65532:65532 /out/runtime/adapters /app/adapters

ARG DSUI_VERSION=0.1.0
ENV     DSUI_HOST=0.0.0.0 \
    DSUI_PORT=4192 \
    DSUI_DATA_DIR=/data \
    DSUI_WEB_ROOT=/app/web \
    DSUI_RUNTIME_ADAPTERS=/app/adapters \
    DSUI_VERSION=$DSUI_VERSION
EXPOSE 4192
VOLUME ["/data"]
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/dsui"]
CMD ["start"]
