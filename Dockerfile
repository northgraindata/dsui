# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.12 AS build
WORKDIR /src
ARG DSUI_VERSION=0.1.0

COPY package.json bun.lock tsconfig.json turbo.json biome.json ./
COPY apps ./apps
COPY packages ./packages
COPY examples ./examples
COPY scripts ./scripts
COPY patches ./patches
RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --filter @northgraindata/dsui-web build
RUN mkdir -p /out/data /out/runtime/plugins && \
  bun build packages/server/src/main.ts --compile --minify --outfile /out/dsui && \
  bun build examples/example-plugin/src/index.ts --bundle --target bun --format esm --outfile /out/runtime/plugins/example-plugin.mjs && \
  cp examples/example-plugin/src/browser.mjs /out/runtime/plugins/example-plugin.browser.mjs && \
  bun build packages/plugin-health/src/plugin.ts --bundle --target bun --format esm --outfile /out/runtime/plugins/health.mjs && \
  bun build packages/plugin-health/src/browser.tsx --bundle --target browser --format esm --outfile /out/runtime/plugins/health.browser.mjs && \
  bun build packages/plugin-monitoring/src/plugin.ts --bundle --target bun --format esm --outfile /out/runtime/plugins/monitoring.mjs && \
  bun build packages/plugin-code-repository/src/plugin.ts --bundle --target bun --format esm --outfile /out/runtime/plugins/code-repository.mjs && \
  bun build packages/plugin-code-repository/src/browser.tsx --bundle --target browser --format esm --outfile /out/runtime/plugins/code-repository.browser.mjs && \
  bun -e "import { prepareSdk } from './packages/server/src/adapters/sdk.ts'; import { sdkVersions } from './scripts/release-packages.ts'; await prepareSdk('packages', '/out/sdk'); await Bun.write('/out/sdk-versions.json', JSON.stringify(await sdkVersions()));" && \
  bun packages/server/src/image-dependencies.ts collect /src /out/image-dependencies.json

FROM oven/bun:1.3.12
WORKDIR /app
ENV PIPX_BIN_DIR=/usr/local/bin \
    PIPX_HOME=/opt/pipx
COPY --from=build /out/image-dependencies.json /tmp/image-dependencies.json
COPY --from=build /src/packages/server/src/image-dependencies.ts /tmp/image-dependencies.ts
RUN bun /tmp/image-dependencies.ts install /tmp/image-dependencies.json && \
  rm -rf /var/lib/apt/lists/* /tmp/image-dependencies.json /tmp/image-dependencies.ts
COPY --from=build --chown=65532:65532 /out/dsui /usr/local/bin/dsui
COPY --from=build --chown=65532:65532 /src/apps/web/dist /app/web
COPY --from=build --chown=65532:65532 /out/data /data
COPY --from=build --chown=65532:65532 /out/runtime/plugins /app/plugins
COPY --from=build --chown=65532:65532 /out/sdk /app/sdk
COPY --from=build --chown=65532:65532 /out/sdk-versions.json /app/sdk-versions.json

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
    PATH=/usr/local/bin:$PATH \
    DSUI_VERSION=$DSUI_VERSION
EXPOSE 4192
VOLUME ["/data"]
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/dsui"]
CMD ["start"]
