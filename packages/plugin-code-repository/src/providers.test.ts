import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { type Connection, configSchema, connectionSchema } from "./model";
import { safePath } from "./paths";
import { archiveFiles, branches, fetchSnapshot } from "./providers";

function replaceFetch(
  handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>,
) {
  return spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(handler, { preconnect: globalThis.fetch.preconnect }),
  );
}

const temporary: string[] = [];
afterEach(async () => {
  for (const path of temporary.splice(0))
    await rm(path, { recursive: true, force: true });
});
function item(overrides: Partial<Connection> = {}): Connection {
  return {
    ...connectionSchema.parse({
      serviceId: "retail",
      name: "Code",
      provider: "github",
      repository: "org/repo",
      branch: "main",
    }),
    id: "fbbf3b6a-c0d8-4023-9717-8d9f421a4bd5",
    revision: 1,
    status: "idle",
    lastAttemptAt: null,
    lastFetchedAt: null,
    version: null,
    error: null,
    ...overrides,
  };
}
test("local code includes uncommitted files, ignores dependencies and external symlinks, and changes version", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsui-code-"));
  temporary.push(root);
  await mkdir(join(root, "src"));
  await mkdir(join(root, "node_modules"));
  await writeFile(join(root, "src", "app.ts"), "const value = 1;");
  await writeFile(join(root, "node_modules", "hidden.ts"), "hidden");
  await symlink("/etc/passwd", join(root, "external"));
  const config = configSchema.parse({ localRoots: [root] });
  const source = item({ provider: "local", repository: root, branch: "" });
  const first = await fetchSnapshot(
    config,
    source,
    new AbortController().signal,
  );
  expect(first.files.map((file) => file.path)).toEqual(["src/app.ts"]);
  await writeFile(join(root, "src", "app.ts"), "const value = 2;");
  const second = await fetchSnapshot(
    config,
    source,
    new AbortController().signal,
  );
  expect(second.version).not.toBe(first.version);
  await expect(
    fetchSnapshot(
      configSchema.parse({ localRoots: [] }),
      source,
      new AbortController().signal,
    ),
  ).rejects.toThrow("outside");
});
test("archives scope files to the selected folder and enforce size and path limits", () => {
  const bytes = zipSync({
    "repo-sha/src/a.ts": strToU8("hello"),
    "repo-sha/README.md": strToU8("readme"),
    "repo-sha/node_modules/a": strToU8("ignored"),
  });
  expect(
    archiveFiles(bytes, configSchema.parse({}), "src").map((file) => file.path),
  ).toEqual(["a.ts"]);
  expect(() =>
    archiveFiles(bytes, configSchema.parse({ maxSnapshotBytes: 2 }), ""),
  ).toThrow("limits");
  expect(() => archiveFiles(bytes, configSchema.parse({}), "missing")).toThrow(
    "missing",
  );
  expect(() => safePath("../private")).toThrow();
  expect(() => safePath("/private")).toThrow();
  expect(() => safePath("a\\b")).toThrow();
  expect(safePath("folder/space # +.tsx")).toBe("folder/space # +.tsx");
});
test("GitHub pins the archive to the commit and keeps tokens off the download redirect", async () => {
  const version = "a".repeat(40);
  const calls: Array<{ url: string; authorization: string | null }> = [];
  const bytes = zipSync({ "repo-sha/src/app.ts": strToU8("private code") });
  const mock = replaceFetch(async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      authorization: new Headers(init?.headers).get("Authorization"),
    });
    if (url.includes("/commits/")) return Response.json({ sha: version });
    if (url.includes("/zipball/"))
      return new Response(null, {
        status: 302,
        headers: {
          location: "https://codeload.github.com/org/repo/legacy.zip/sha",
        },
      });
    return new Response(bytes);
  });
  try {
    const result = await fetchSnapshot(
      configSchema.parse({ githubToken: "secret-token" }),
      item(),
      new AbortController().signal,
    );
    expect(result.files.map((file) => file.path)).toEqual(["src/app.ts"]);
    expect(calls[1]?.url).toEndWith(`/zipball/${version}`);
    expect(calls[0]?.authorization).toBe("Bearer secret-token");
    expect(calls[2]?.authorization).toBeNull();
  } finally {
    mock.mockRestore();
  }
});
test("private self-managed GitLab uses the selected instance, project, branch and token", async () => {
  const calls: Array<{ url: string; token: string | null }> = [];
  const mock = replaceFetch(async (input, init) => {
    calls.push({
      url: String(input),
      token: new Headers(init?.headers).get("PRIVATE-TOKEN"),
    });
    return Response.json([{ name: "feature/code" }]);
  });
  try {
    expect(
      await branches(
        configSchema.parse({
          gitlab: [
            { id: "company", url: "https://git.example.com", token: "private" },
          ],
        }),
        item({
          provider: "gitlab",
          instance: "company",
          repository: "team/repo",
        }),
        new AbortController().signal,
      ),
    ).toEqual(["feature/code"]);
    expect(calls[0]?.url).toContain(
      "https://git.example.com/api/v4/projects/team%2Frepo/repository/branches",
    );
    expect(calls[0]?.token).toBe("private");
  } finally {
    mock.mockRestore();
  }
});

test("GitLab fetches the selected branch and publishes a snapshot of the selected subfolder", async () => {
  const version = "b".repeat(40);
  const calls: string[] = [];
  const archive = zipSync({
    "repo-sha/src/app.ts": strToU8("GitLab code"),
    "repo-sha/other.txt": strToU8("outside scope"),
  });
  const mock = replaceFetch(async (input) => {
    const url = String(input);
    calls.push(url);
    return url.includes("/repository/commits/")
      ? Response.json({ id: version })
      : new Response(archive);
  });
  try {
    const result = await fetchSnapshot(
      configSchema.parse({}),
      item({ provider: "gitlab", branch: "feature/code", folder: "src" }),
      new AbortController().signal,
    );
    expect(result.version).toBe(version);
    expect(result.files.map((file) => file.path)).toEqual(["app.ts"]);
    expect(calls[0]).toContain("repository/commits/feature%2Fcode");
    expect(calls[1]).toContain(`archive.zip?sha=${version}`);
  } finally {
    mock.mockRestore();
  }
});
