/** Where you are, as crumbs. Click the empty space to type or paste a path. */
import { useState } from "react";
import { Glyph } from "../shared/glyphs";
import { go, IconButton } from "../shared/ui";
import { Art } from "./art";
import { buckets, findEntry, listPrefix, parentOf } from "./data";
import { copyText } from "./inspector";

export const folderPath = (bucket: string, prefix: string, key?: string) => {
  const query = new URLSearchParams();
  if (prefix) query.set("prefix", prefix);
  if (key) query.set("key", key);
  return `/buckets/${bucket}${query.size ? `?${query}` : ""}`;
};

/** Reads `s3://bucket/some/key`, an ARN, or a key in the current bucket. */
export function parseLocation(text: string, current: string) {
  const trimmed = text.trim().replace(/^arn:aws:s3:::/, "s3://");
  const absolute = trimmed.match(/^s3a?n?:\/\/([^/]+)\/?(.*)$/);
  const bucket = absolute?.[1] ?? current;
  const key = (absolute ? (absolute[2] ?? "") : trimmed).replace(/^\//, "");
  return { bucket, key };
}

export function PathBar({
  bucket,
  prefix,
}: {
  bucket: string;
  prefix: string;
}) {
  const [typing, setTyping] = useState<string>();
  const [problem, setProblem] = useState("");
  const parts = prefix.split("/").filter(Boolean);
  const submit = (text: string) => {
    const target = parseLocation(text, bucket);
    if (!buckets.some((item) => item.name === target.bucket))
      return setProblem(`No bucket named ${target.bucket}`);
    setTyping(undefined);
    // A key that is an object opens it; anything else is read as a folder.
    if (
      target.key &&
      !target.key.endsWith("/") &&
      findEntry(target.bucket, target.key)
    )
      return go(folderPath(target.bucket, parentOf(target.key), target.key));
    const folder =
      target.key && !target.key.endsWith("/") ? `${target.key}/` : target.key;
    listPrefix(target.bucket, folder);
    go(folderPath(target.bucket, folder));
  };
  if (typing !== undefined)
    return (
      <form
        className="s3-path"
        data-typing="true"
        onSubmit={(event) => {
          event.preventDefault();
          submit(typing);
        }}
      >
        <Glyph name="arrow" />
        <input
          // biome-ignore lint/a11y/noAutofocus: opened by an explicit click
          autoFocus
          aria-label="Go to S3 path"
          value={typing}
          onChange={(event) => {
            setTyping(event.target.value);
            setProblem("");
          }}
          onKeyDown={(event) => event.key === "Escape" && setTyping(undefined)}
          onBlur={() => setTyping(undefined)}
        />
        <small data-problem={Boolean(problem)}>
          {problem || "Enter to go · paste an s3:// URI, an ARN or a key"}
        </small>
      </form>
    );
  return (
    <div className="s3-path">
      <Art name="buckets" size={22} />
      <nav aria-label="Folder path">
        <button type="button" onClick={() => go("/")}>
          Buckets
        </button>
        <i>/</i>
        <button
          type="button"
          onClick={() => go(folderPath(bucket, ""))}
          aria-current={parts.length ? undefined : "page"}
        >
          {bucket}
        </button>
        {parts.map((part, index) => {
          const target = `${parts.slice(0, index + 1).join("/")}/`;
          return (
            <span key={target}>
              <i>/</i>
              <button
                type="button"
                onClick={() => go(folderPath(bucket, target))}
                aria-current={index === parts.length - 1 ? "page" : undefined}
              >
                {part}
              </button>
            </span>
          );
        })}
      </nav>
      <button
        type="button"
        className="s3-path-space"
        aria-label="Type a path"
        onClick={() => setTyping(`s3://${bucket}/${prefix}`)}
      />
      <IconButton
        icon="edit"
        label="Type or paste a path (G)"
        onClick={() => setTyping(`s3://${bucket}/${prefix}`)}
      />
      <IconButton
        icon="copy"
        label="Copy S3 URI of this folder"
        onClick={() => copyText(`s3://${bucket}/${prefix}`, "S3 URI")}
      />
    </div>
  );
}
