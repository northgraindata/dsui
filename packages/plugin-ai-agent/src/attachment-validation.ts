import { Buffer } from "node:buffer";
import { PluginRequestError } from "@northgraindata/dsui-plugin-sdk";
import {
  type AttachmentUpload,
  isTextAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_TEXT_BYTES,
} from "./attachments";

function validSignature(data: Buffer, type: string) {
  switch (type) {
    case "image/png":
      return data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/jpeg":
      return data[0] === 255 && data[1] === 216 && data[2] === 255;
    case "image/gif":
      return /^GIF8[79]a$/.test(data.subarray(0, 6).toString("ascii"));
    case "image/webp":
      return (
        data.subarray(0, 4).toString("ascii") === "RIFF" &&
        data.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "application/pdf":
      return data.subarray(0, 5).toString("ascii") === "%PDF-";
    default:
      return false;
  }
}

/** Verify decoded lengths and content before accepting client-supplied file metadata. */
export function validateAttachments(uploads: readonly AttachmentUpload[]) {
  if (
    uploads.reduce((size, file) => size + file.size, 0) > MAX_ATTACHMENT_BYTES
  )
    throw new PluginRequestError(
      "Attachments exceed the 10 MB message limit",
      422,
    );
  for (const upload of uploads) {
    const data = Buffer.from(upload.data, "base64");
    if (data.length !== upload.size || data.toString("base64") !== upload.data)
      throw new PluginRequestError(
        `Invalid attachment data: ${upload.name}`,
        422,
      );
    if (isTextAttachment(upload.mediaType)) {
      if (data.length > MAX_TEXT_BYTES)
        throw new PluginRequestError(
          `Text files must be at most 256 KB: ${upload.name}`,
          422,
        );
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
        if (text.includes("\0")) throw new Error("Binary content");
      } catch {
        throw new PluginRequestError(
          `File must contain UTF-8 text: ${upload.name}`,
          422,
        );
      }
    } else if (!validSignature(data, upload.mediaType)) {
      throw new PluginRequestError(
        `File content does not match its type: ${upload.name}`,
        422,
      );
    }
  }
}
