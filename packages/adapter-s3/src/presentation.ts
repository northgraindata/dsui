import type { AdapterPresentation } from "@northgraindata/dsui-adapter-sdk";

export const presentation = {
  category: "Storage",
  overview:
    "Browse buckets and object versions. Preview, upload, copy, move and delete files.",
  features: [
    {
      title: "Object browser",
      description: "Browse buckets, prefixes and object metadata.",
    },
    {
      title: "Previews & versions",
      description: "Preview objects and inspect available versions.",
    },
    {
      title: "File operations",
      description:
        "Upload, copy, move and delete objects when your credentials allow it.",
    },
  ],
  compatibility: ["AWS S3, MinIO and compatible S3 endpoints."],
  limitations: [
    "Bucket visibility and write operations depend on the supplied credentials and bucket policies.",
  ],
  links: [
    {
      kind: "documentation",
      label: "DSUI adapter guide",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-s3#readme",
    },
    {
      kind: "documentation",
      label: "Product documentation",
      href: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html",
    },
    {
      kind: "website",
      label: "Official website",
      href: "https://aws.amazon.com/s3/",
    },
    {
      kind: "source",
      label: "Adapter source",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-s3/src",
    },
  ],
} satisfies AdapterPresentation;
