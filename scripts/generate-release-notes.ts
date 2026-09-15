import { spawnSync } from "node:child_process";
import process from "node:process";

const repository = "northgraindata/dsui";
const tag = process.env.RELEASE_TAG;

if (!tag || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error("RELEASE_TAG must be a semantic version tag, such as v0.1.0");
}

function git(...args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

const tags = git(
  "tag",
  "--merged",
  tag,
  "--sort=-version:refname",
  "--list",
  "v[0-9]*",
)
  .split("\n")
  .filter(Boolean);
const previousTag = tags[tags.indexOf(tag) + 1];
const range = previousTag ? `${previousTag}..${tag}` : tag;
const log = git("log", "--no-merges", `--format=%H%x09%an%x09%ae%x09%s`, range);
const prpAuthorEmails = new Set(
  ["me@joachimhodana.com", "stylek777@gmail.com"].map((email) =>
    email.toLowerCase(),
  ),
);
const commits = log
  ? log.split("\n").map((line) => {
      const [sha, author, email, ...subjectParts] = line.split("\t");
      if (!sha || !author || !email) {
        throw new Error(`Could not parse git log entry: ${line}`);
      }
      const subject = subjectParts.join("\t");
      const marker = prpAuthorEmails.has(email.toLowerCase()) ? " · PRP" : "";
      return `- ${subject} — ${author}${marker} ([${sha.slice(0, 7)}](${`https://github.com/${repository}/commit/${sha}`}))`;
    })
  : [];

const imageTag = tag.slice(1);
const logoUrl = `https://raw.githubusercontent.com/${repository}/${tag}/apps/site/public/branding/logo-icon.svg`;
const codeFence = "```";

process.stdout.write(
  [
    `<p align="center"><img src="${logoUrl}" alt="DSUI logo" width="112"></p>`,
    "",
    `# DSUI ${tag}`,
    "",
    `![DSUI ${tag} release banner](https://github.com/${repository}/releases/download/${tag}/release-banner.png)`,
    "",
    "One interface for the services in your data stack.",
    "",
    "## Changes",
    "",
    commits.length
      ? commits.join("\n")
      : "No non-merge commits since the previous release.",
    "",
    previousTag
      ? `[Full changelog](https://github.com/${repository}/compare/${previousTag}...${tag})`
      : `[Browse commits in this release](https://github.com/${repository}/commits/${tag})`,
    "",
    "## Run with Docker",
    "",
    `${codeFence}sh`,
    "docker run -d --name dsui --restart unless-stopped \\",
    "  -p 4192:4192 \\",
    "  -v dsui-data:/data \\",
    `  ghcr.io/${repository}:${imageTag}`,
    codeFence,
    "",
    "Open [http://localhost:4192](http://localhost:4192). The `latest` tag points to the most recent stable release.",
    "",
    "## Run with Docker Compose",
    "",
    "Save this as `compose.yaml`, then run `docker compose up -d`:",
    "",
    `${codeFence}yaml`,
    "services:",
    "  dsui:",
    `    image: ghcr.io/${repository}:${imageTag}`,
    '    ports: ["4192:4192"]',
    "    volumes:",
    "      - dsui-data:/data",
    "    restart: unless-stopped",
    "",
    "volumes:",
    "  dsui-data:",
    codeFence,
    "",
    "Open [http://localhost:4192](http://localhost:4192).",
    "",
    "## Supported platforms",
    "",
    "`linux/amd64` and `linux/arm64`.",
    "",
  ].join("\n"),
);
