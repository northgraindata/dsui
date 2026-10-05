import { PluginRequestError } from "@northgraindata/dsui-plugin-sdk";

export const ignored = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".cache",
  "coverage",
  "__pycache__",
]);
export function safePath(value: string): string {
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    throw new PluginRequestError("Invalid file path");
  const parts = value.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === ".."))
    throw new PluginRequestError("Invalid file path");
  return parts.join("/");
}
