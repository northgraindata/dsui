import { z } from "@northgraindata/dsui-plugin-sdk";

export const MAX_ATTACHMENTS = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_BYTES = 256 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_CONVERSATION_ATTACHMENT_BYTES = 50 * 1024 * 1024;
export const attachmentMediaTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
] as const;
export const attachmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  mediaType: z.enum(attachmentMediaTypes),
  size: z.number().int().min(1).max(MAX_FILE_BYTES),
});
export const attachmentUploadSchema = attachmentSchema
  .omit({ id: true })
  .extend({
    data: z
      .string()
      .min(4)
      .max(4 * Math.ceil(MAX_FILE_BYTES / 3))
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .refine((data) => data.length % 4 === 0, "Invalid base64 length"),
  });
export type Attachment = z.infer<typeof attachmentSchema>;
export type AttachmentUpload = z.infer<typeof attachmentUploadSchema>;
export type DraftAttachment = AttachmentUpload & { id: string };

const textExtensions = new Set([
  "txt",
  "log",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "yaml",
  "yml",
  "sql",
  "py",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "html",
  "xml",
  "sh",
  "bash",
  "toml",
  "ini",
  "conf",
  "cfg",
  "r",
  "go",
  "rs",
  "java",
  "c",
  "h",
  "cpp",
]);
const extensionTypes: Record<string, Attachment["mediaType"]> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  csv: "text/csv",
  md: "text/markdown",
  json: "application/json",
};

export function attachmentType(
  name: string,
  mime: string,
): Attachment["mediaType"] | undefined {
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  if (extensionTypes[extension]) return extensionTypes[extension];
  if (textExtensions.has(extension) || mime.startsWith("text/"))
    return "text/plain";
  return attachmentMediaTypes.find((type) => type === mime);
}

export function isTextAttachment(type: string) {
  return type.startsWith("text/") || type === "application/json";
}

export function fileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

export const attachmentAccept = [
  ...attachmentMediaTypes,
  ...[...textExtensions].map((extension) => `.${extension}`),
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
].join(",");
