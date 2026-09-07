import { createHash } from "node:crypto";

/** Shared builders for installer/host tests (mirrors production fixtures). */
export const encoder = new TextEncoder();
export const commit = "a".repeat(40);

export function sri(bytes: Uint8Array): string {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}
export function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
export function manifest(bundle: Uint8Array, sdkVersion = "0.2.0") {
  return encoder.encode(
    JSON.stringify({
      schemaVersion: 1,
      id: "community-test",
      name: "Community test",
      version: "1.2.3",
      sdkVersion,
      entry: "./dist/adapter.mjs",
      license: "MIT",
      repository: "https://github.com/acme/community-test",
      resources: ["things"],
      actions: ["refresh"],
      pages: ["/things"],
      bundle: { bytes: bundle.length, sha256: digest(bundle) },
    }),
  );
}

export function responseFor(files: Record<string, Uint8Array>) {
  return async (url: string): Promise<Response> => {
    const bytes = files[url];
    return bytes
      ? new Response(new Uint8Array(bytes), { status: 200 })
      : new Response("missing", { status: 404 });
  };
}

export function tarHeader(name: string, size: number, type = "0"): Uint8Array {
  const block = new Uint8Array(512);
  block.set(encoder.encode(name), 0);
  block.set(encoder.encode(`${size.toString(8).padStart(11, "0")}\0`), 124);
  block[156] = type.charCodeAt(0);
  return block;
}
export function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
export async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(bytes)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
