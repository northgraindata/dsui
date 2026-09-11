import {
  Badge,
  Button,
  Card,
  CodeBlock,
  Collection,
  Columns,
  definePage,
  Flex,
  Grid,
  Icon,
  Link,
  PageHeader,
  Resource,
  Stack,
  Table,
  Tabs,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import { extensionCatalog, extensionProfileResource } from "../resources/extensions.js";

const extensionName = Flex({
  direction: "row",
  align: "center",
  gap: "sm",
  content: [Icon({ name: { field: "icon" }, size: 18 }), Value({ field: "name" })],
});
const extensionBadge = Badge({ label: { field: "provenance" } });
const extensionStatus = Badge({ label: { field: "status" }, tone: { field: "statusTone" }, dot: true });

const actionButton = Button({
  label: { field: "label" },
  icon: { field: "icon" },
  description: { field: "description" },
  action: { field: "action" },
  link: { field: "link" },
  confirmation: { field: "confirmation" },
  variant: "list-item",
});
const fact = Flex({
  direction: "row",
  align: "center",
  gap: "sm",
  content: [
    Icon({ name: { field: "icon" }, size: 19 }),
    Stack({ gap: "none", content: [Value({ field: "label" }), Value({ field: "value" })] }),
  ],
});
const panelLinks = Link({ href: { field: "url" }, label: { field: "label" }, icon: { field: "icon" }, external: true });
const panelCode = CodeBlock({ label: { field: "label" }, value: { field: "value" }, language: { field: "language" } });
const storageItem = Flex({
  direction: "row",
  align: "center",
  gap: "sm",
  content: [
    Icon({ name: { field: "icon" }, size: 18 }),
    Stack({ gap: "none", content: [Value({ field: "title" }), Value({ field: "description" }), Value({ field: "detail" })] }),
  ],
});

function Panel(path: string, title: string) {
  return Card({
    title,
    description: { field: `${path}.description` },
    content: [
      Grid({ columns: 2, content: Collection({ field: `${path}.facts`, content: fact }) }),
      Collection({ field: `${path}.links`, content: panelLinks }),
      Collection({ field: `${path}.actions`, content: actionButton }),
      Collection({ field: `${path}.code`, content: panelCode }),
    ],
  });
}

const overview = Columns({
  columns: [
    {
      weight: 2,
      content: Stack({
        content: [
          Panel("tabs.0.panels.0", "About"),
          Card({ title: "Quick actions", content: Collection({ field: "tabs.0.panels.1.actions", content: actionButton }) }),
          Card({ title: "Usage", content: Collection({ field: "tabs.0.panels.2.code", content: panelCode }) }),
        ],
      }),
    },
    {
      weight: 1,
      content: Stack({
        content: [
          Card({ title: "Status", description: { field: "tabs.0.aside.0.description" }, content: Collection({ field: "tabs.0.aside.0.actions", content: actionButton }) }),
          Card({ title: "Related extensions", content: Collection({ field: "tabs.0.aside.1.items", content: storageItem }) }),
        ],
      }),
    },
  ],
});

const detailTabs = Tabs({
  items: [
    { label: "Overview", content: overview },
    { label: "Configuration", content: Panel("tabs.1.panels.0", "Configuration") },
    { label: "Examples", content: Panel("tabs.2.panels.0", "Usage examples") },
    { label: "Dependencies", content: Panel("tabs.3.panels.0", "Dependencies") },
    { label: "Changelog", content: Panel("tabs.4.panels.0", "Changelog") },
  ],
});

export const extensionsPage = definePage({
  path: "/extensions",
  render: () => [
    Table({
      source: extensionCatalog(),
      columns: [
        { id: "name", label: "Name", renderCell: extensionName },
        { id: "description", label: "Description" },
        { id: "category", label: "Category" },
        { id: "provenance", label: "Source", renderCell: extensionBadge },
        { id: "status", label: "Status", renderCell: extensionStatus },
        { id: "version", label: "Version" },
      ],
      rowLink: { path: "/extensions/:extension", params: { extension: "name" } },
      rowActions: [
        { label: "Install", action: "install-extension", input: { name: "name" }, when: { field: "canInstall", equals: true } },
        { label: "Load", action: "load-extension", input: { name: "name" }, when: { field: "canLoad", equals: true } },
        { label: "Unload", action: "unload-extension", input: { name: "name" }, when: { field: "canUnload", equals: true }, disabledWhen: { field: "canRestart", equals: false } },
        { label: "Reload", action: "reload-extension", input: { name: "name" }, when: { field: "canReload", equals: true }, disabledWhen: { field: "canRestart", equals: false } },
      ],
    }),
  ],
});

export const extensionPage = definePage({
  path: "/extensions/:extension",
  render: ({ params }) => [
    Resource({
      source: extensionProfileResource({ name: params.extension }),
      content: [
        PageHeader({
          variant: "detail",
          title: { field: "title" },
          description: { field: "description" },
          icon: { field: "icon" },
          badge: { label: { field: "status.label" }, tone: { field: "status.tone" } },
          tags: Collection({ field: "tags", content: Badge({ label: { field: "value" } }) }),
          actions: Collection({ field: "actions", content: actionButton }),
        }),
        detailTabs,
      ],
    }),
  ],
});
