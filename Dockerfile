# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.12 AS build
WORKDIR /src
ARG DSUI_VERSION=0.1.0

COPY package.json bun.lock tsconfig.json turbo.json biome.json ./
COPY apps ./apps
COPY packages ./packages
COPY examples ./examples
COPY scripts ./scripts
RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --filter @northgraindata/dsui-web build
RUN mkdir -p /out/data /out/runtime/plugins && \
  bun build packages/server/src/main.ts --compile --minify --outfile /out/dsui && \
  bun build examples/example-plugin/src/index.ts --bundle --target bun --format esm --outfile /out/runtime/plugins/example-plugin.mjs && \
  cp examples/example-plugin/src/browser.mjs /out/runtime/plugins/example-plugin.browser.mjs && \
  bun build packages/plugin-health/src/plugin.ts --bundle --target bun --format esm --outfile /out/runtime/plugins/health.mjs && \
  bun build packages/plugin-monitoring/src/plugin.ts --bundle --target bun --format esm --outfile /out/runtime/plugins/monitoring.mjs && \
  bun run packages/server/src/adapters/sdk.ts packages /out/sdk "${DSUI_VERSION}"

FROM gcr.io/distroless/cc-debian12:nonroot
WORKDIR /app
COPY --from=build --chown=65532:65532 /out/dsui /usr/local/bin/dsui
# Adapters are built from source on first start, so the runtime image needs the
# bun CLI that performs the install and the bundle. The compiled server binary
# alone cannot.
COPY --from=build --chown=65532:65532 /usr/local/bin/bun /usr/local/bin/bun
COPY --from=build --chown=65532:65532 /src/apps/web/dist /app/web
COPY --from=build --chown=65532:65532 /out/data /data
COPY --from=build --chown=65532:65532 /out/runtime/plugins /app/plugins
COPY --from=build --chown=65532:65532 /out/sdk /app/sdk

ARG DSUI_VERSION=0.1.0
# Adapters are built from their source on start, which installs dependencies over
# the network. Keep the package-manager cache on the data volume so a restart
# reuses it instead of re-downloading every adapter's dependencies.
ENV     DSUI_HOST=0.0.0.0 \
    DSUI_PORT=4192 \
    DSUI_DATA_DIR=/data \
    DSUI_WEB_ROOT=/app/web \
    DSUI_RUNTIME_PLUGINS=/app/plugins \
    DSUI_SDK_ROOT=/app/sdk \
    BUN_INSTALL_CACHE_DIR=/data/.bun-cache \
    DSUI_VERSION=$DSUI_VERSION
EXPOSE 4192
VOLUME ["/data"]
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/dsui"]
CMD ["start"]
