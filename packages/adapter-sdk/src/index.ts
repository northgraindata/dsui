/**
 * DSUI adapter SDK: Resource = data, Store = state, Action = behavior,
 * Page = composition, Context = environment, Adapter = application boundary.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ADAPTER_SDK_VERSION } from "./adapter/index";

export {
  type ActionBinding,
  type ActionDefinition,
  type ActionExecutionStatus,
  type ActionFailure,
  type ActionReference,
  type ActionResult,
  type ActionRuntimeContext,
  type ActionSuccess,
  type ActionTarget,
  type AnyActionDefinition,
  defineAction,
  type InputAction,
  type InputlessAction,
} from "./action/index";
export {
  ADAPTER_SDK_VERSION,
  type AdapterDefinition,
  type AdapterInfo,
  type ConnectionMethodDefinition,
  type DefineAdapterOptions,
  defineAdapter,
} from "./adapter/index";
export {
  Badge,
  type BadgeNode,
  type BadgeProps,
  type BadgeTone,
  Button,
  type ButtonNode,
  type ButtonProps,
  Card,
  type CardBadgeTone,
  type CardNode,
  type CardProps,
  type CardValue,
  type CardVariant,
  CodeBlock,
  type CodeBlockNode,
  type CodeBlockProps,
  CodeEditor,
  type CodeEditorNode,
  type CodeEditorProps,
  Collection,
  type CollectionNode,
  type CollectionProps,
  Columns,
  type ColumnsColumn,
  type ColumnsNode,
  type ColumnsProps,
  type ComponentReferenceNode,
  type ComponentReferenceProps,
  defineComponent,
  type FieldReference,
  Flex,
  type FlexAlign,
  type FlexDirection,
  type FlexJustify,
  type FlexNode,
  type FlexProps,
  Form,
  type FormNode,
  type FormProps,
  Grid,
  type GridNode,
  type GridProps,
  Icon,
  type IconNode,
  type IconProps,
  KeyValue,
  type KeyValueNode,
  type KeyValueProps,
  type LayoutGap,
  Link,
  type LinkNode,
  type LinkProps,
  Meter,
  type MeterData,
  type MeterNode,
  type MeterProps,
  type MeterSegment,
  type PageDocument,
  PageHeader,
  type PageHeaderAction,
  type PageHeaderBadge,
  type PageHeaderNode,
  type PageHeaderProps,
  type PageMeterData,
  type PageMeterSegment,
  type PageNode,
  type PageSectionLink,
  type PageTableRowAction,
  type PageTableRowLink,
  QueryEditor,
  type QueryEditorExplorerProps,
  type QueryEditorNode,
  type QueryEditorProps,
  type QueryExplorerDocument,
  Resource,
  type ResourceNode,
  type ResourceProps,
  ResourceTree,
  type ResourceTreeBranchDocument,
  type ResourceTreeBranchProps,
  type ResourceTreeNode,
  type ResourceTreeProps,
  Section,
  type SectionLink,
  type SectionNode,
  type SectionProps,
  Select,
  type SelectNode,
  type SelectOption,
  type SelectProps,
  SplitPane,
  type SplitPaneNode,
  type SplitPaneProps,
  Stack,
  type StackNode,
  type StackProps,
  serializeNode,
  serializeNodes,
  Table,
  type TableColumn,
  type TableNode,
  type TableProps,
  type TableRowAction,
  type TableRowLink,
  type TableRowMenuAction,
  Tabs,
  type TabsItem,
  type TabsNode,
  type TabsProps,
  TextInput,
  type TextInputNode,
  type TextInputProps,
  UnserializablePageError,
  Value,
  type ValueFormat,
  type ValueNode,
  type ValueProps,
} from "./components/index";
export {
  type AnyPageDefinition,
  definePage,
  type ExtractRouteParams,
  matchRoute,
  type PageRenderContext,
  type StoreAccessor,
} from "./page/index";
export {
  manual,
  type PollInterval,
  poll,
  type RefreshStrategy,
} from "./refresh/index";
export {
  type AnyResourceDefinition,
  type DataSource,
  defineResource,
  type InputlessResource,
  type InputResource,
  type ResourceBinding,
  type ResourceDefinition,
  type ResourceReference,
} from "./resource/index";
export {
  type ActionExecutionOptions,
  type AdapterInstance,
  createAdapterInstance,
  type PageScope,
  type ResourceFailure,
  type ResourceResult,
  type ResourceStatus,
  type ResourceSuccess,
  resourceKey,
  stableStringify,
} from "./runtime/index";
export {
  InvalidDefinitionError,
  SdkError,
  UnknownPageError,
} from "./shared/errors";
export {
  type AnyStoreDefinition,
  createStoreInstance,
  defineStore,
  type StoreDefinition,
  type StoreHelpers,
  type StoreInstance,
  type StoreScope,
} from "./store/index";
export { z };

export const adapterManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  sdkVersion: z.string().min(1),
  entry: z.string().regex(/^\.\/dist\/[A-Za-z0-9._/-]+\.mjs$/),
  license: z.string().min(1),
  repository: z.string().url(),
  resources: z.array(z.string()).default([]),
  actions: z.array(z.string()).default([]),
  pages: z.array(z.string()).default([]),
  bundle: z.object({
    bytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  sbom: z
    .string()
    .regex(/^\.\/[A-Za-z0-9._/-]+\.json$/)
    .optional(),
});
export type AdapterManifest = z.infer<typeof adapterManifestSchema>;

const exactVersion = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
    "must be an exact SemVer version",
  );
export const npmAdapterSourceSchema = z.object({
  source: z.literal("npm"),
  package: z
    .string()
    .regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
  version: exactVersion,
  integrity: z.string().regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/),
  entry: z
    .string()
    .regex(/^\.\/dist\/[A-Za-z0-9._/-]+\.mjs$/)
    .optional(),
});
/** GitHub is an identity hint for an npm package, never a clone/install source. */
export const githubAdapterSourceSchema = z.object({
  source: z.literal("github"),
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  package: z.string().regex(/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/),
  version: exactVersion,
  integrity: z.string().regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/),
});
export const externalAdapterSourceSchema = z.discriminatedUnion("source", [
  npmAdapterSourceSchema,
  githubAdapterSourceSchema,
]);
export type ExternalAdapterSource = z.infer<typeof externalAdapterSourceSchema>;

export function validateExternalSource(value: unknown): ExternalAdapterSource {
  const source = externalAdapterSourceSchema.parse(value);
  // `github` remains npm-backed; direct git URLs and floating refs are deliberately unavailable.
  return source;
}

export interface ArchiveEntry {
  path: string;
  size: number;
  type: "file" | "directory" | "symlink" | "other";
}
export function validateArchiveEntries(
  entries: readonly ArchiveEntry[],
  maxBytes = 10 * 1024 * 1024,
): void {
  let bytes = 0;
  for (const entry of entries) {
    if (entry.type === "symlink" || entry.type === "other")
      throw new Error(`Unsafe adapter archive entry: ${entry.path}`);
    if (entry.path.startsWith("/") || entry.path.split("/").includes(".."))
      throw new Error(`Path traversal in adapter archive: ${entry.path}`);
    if (entry.type === "file") bytes += entry.size;
  }
  if (bytes > maxBytes)
    throw new Error(`Adapter archive exceeds ${maxBytes} byte limit`);
}

export function verifySriSha512(bytes: Uint8Array, integrity: string): boolean {
  const expected = integrity.slice("sha512-".length);
  const actual = createHash("sha512").update(bytes).digest("base64");
  return (
    expected.length === actual.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  );
}

export function validateManifest(
  manifest: unknown,
  expected: Pick<ExternalAdapterSource, "version"> & { entry?: string },
): AdapterManifest {
  const parsed = adapterManifestSchema.parse(manifest);
  if (parsed.sdkVersion !== ADAPTER_SDK_VERSION)
    throw new Error(
      `Adapter targets SDK ${parsed.sdkVersion}; host requires ${ADAPTER_SDK_VERSION}`,
    );
  if (parsed.version !== expected.version)
    throw new Error("Adapter manifest version differs from configured version");
  if (expected.entry && parsed.entry !== expected.entry)
    throw new Error("Adapter manifest entry differs from configured entry");
  return parsed;
}
