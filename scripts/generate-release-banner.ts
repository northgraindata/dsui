import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const [tag, outputPath = "release-banner.png"] = process.argv.slice(2);

if (!tag || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error(
    "Usage: bun run scripts/generate-release-banner.ts <release-tag> [output-path]",
  );
}

const template = fileURLToPath(
  new URL("../.github/assets/release-banner-template.png", import.meta.url),
);
const { width, height } = await sharp(template).metadata();

if (!width || !height) {
  throw new Error("Could not read release banner template dimensions");
}

const version = tag.slice(1);
const overlay = Buffer.from(
  `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="version" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#e3eaff" />
      </linearGradient>
    </defs>
    <text x="0" y="598" transform="translate(294 0) scale(1.2 1)" fill="url(#version)" font-family="Arial, Helvetica, sans-serif" font-size="194" font-weight="700" letter-spacing="-5">${version}</text>
  </svg>`,
);

await sharp(template)
  .composite([{ input: overlay }])
  .png()
  .toFile(outputPath);
