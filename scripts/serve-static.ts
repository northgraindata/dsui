#!/usr/bin/env bun
import { resolve } from "node:path";

const [directory, portArgument, mountArgument = "/"] = process.argv.slice(2);
if (!directory || !portArgument) {
  throw new Error("usage: serve-static.ts DIRECTORY PORT [MOUNT_PATH]");
}

const root = resolve(directory);
const port = Number(portArgument);
const mount = mountArgument.replace(/\/$/, "") || "/";
const types: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function contentType(path: string): string {
  return (
    Object.entries(types).find(([extension]) =>
      path.endsWith(extension),
    )?.[1] ?? "application/octet-stream"
  );
}

Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    if (
      mount !== "/" &&
      !(pathname === mount || pathname.startsWith(`${mount}/`))
    )
      return new Response("Not found", { status: 404 });
    const relative =
      mount === "/" ? pathname : pathname.slice(mount.length) || "/";
    if (relative.includes(".."))
      return new Response("Forbidden", { status: 403 });
    const requested = relative === "/" ? "/index.html" : relative;
    for (const path of [requested, `${requested}/index.html`]) {
      const filePath = resolve(root, `.${path}`);
      if (!filePath.startsWith(`${root}/`)) continue;
      const file = Bun.file(filePath);
      if (await file.exists())
        return new Response(file, {
          headers: { "content-type": contentType(filePath) },
        });
    }
    return new Response("Not found", { status: 404 });
  },
});
