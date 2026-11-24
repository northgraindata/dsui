import { appendFile, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Serial writes are awaited by the sampler, so no unbounded write queue builds up. */
export async function appendDiagnostic(
  directory: string,
  record: Record<string, unknown>,
  now = Date.now(),
): Promise<void> {
  const names = (await readdir(directory)).filter((name) =>
    /^diagnostic-\d+-\d+\.log$/.test(name),
  );
  const files = await Promise.all(
    names.map(async (name) => ({
      name,
      ...(await stat(join(directory, name))),
    })),
  );
  files.sort((a, b) => a.mtimeMs - b.mtimeMs);
  const line = `${JSON.stringify({ time: new Date(now).toISOString(), ...record })}\n`;
  if (Buffer.byteLength(line) > MAX_FILE_BYTES) return;
  let total = files.reduce((sum, file) => sum + file.size, 0);
  while (
    files.length &&
    (total + Buffer.byteLength(line) > MAX_TOTAL_BYTES ||
      files[0].mtimeMs < now - RETENTION_MS)
  ) {
    const file = files.shift();
    if (!file) break;
    await unlink(join(directory, file.name));
    total -= file.size;
  }
  const day = Math.floor(now / 86_400_000);
  const last = files.at(-1);
  const name =
    last?.name.startsWith(`diagnostic-${day}-`) &&
    last.size + Buffer.byteLength(line) <= MAX_FILE_BYTES
      ? last.name
      : `diagnostic-${day}-${now}.log`;
  await appendFile(join(directory, name), line, { mode: 0o600 });
}
