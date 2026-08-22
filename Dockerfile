# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.12 AS build
WORKDIR /src

COPY package.json bun.lock tsconfig.json turbo.json biome.json ./
COPY apps ./apps
COPY packages ./packages
RUN bun install --frozen-lockfile
RUN bun run --filter @dsui/web build
RUN mkdir -p /out && bun build packages/cli/src/index.ts --compile --minify --outfile /out/dsui

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app
COPY --from=build --chown=65532:65532 /out/dsui /usr/local/bin/dsui
COPY --from=build --chown=65532:65532 /src/apps/web/dist /app/web

ENV     DSUI_HOST=0.0.0.0 \
    DSUI_PORT=4192 \
    DSUI_DATA_DIR=/data \
    DSUI_WEB_ROOT=/app/web
EXPOSE 4192
VOLUME ["/data"]
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/dsui"]
CMD ["start"]
