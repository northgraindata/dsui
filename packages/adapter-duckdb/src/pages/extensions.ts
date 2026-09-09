import {
  Button,
  definePage,
  KeyValue,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { installExtension, loadExtension } from "../actions/config.js";
import { extensionDetails, extensions } from "../resources/config.js";

const extensionActions = [
  {
    label: "Install",
    action: installExtension,
    input: { name: "name" },
    when: { field: "installed", equals: false },
  },
  {
    label: "Load",
    action: loadExtension,
    input: { name: "name" },
    when: { field: "loaded", equals: false },
  },
] as const;

export const extensionsPage = definePage({
  path: "/extensions",
  render: () => [
    PageHeader({
      title: "Extensions",
      description:
        "Inspect, install, and load capabilities for this DuckDB instance.",
    }),
    Table({
      source: extensions(),
      columns: [
        { id: "name", label: "Extension" },
        { id: "installed", label: "Installed" },
        { id: "loaded", label: "Loaded" },
        { id: "version", label: "Version" },
        { id: "description", label: "Description" },
      ],
      rowLink: {
        path: "/extensions/:extension",
        params: { extension: "name" },
      },
      rowActions: extensionActions,
    }),
  ],
});

export const extensionPage = definePage({
  path: "/extensions/:extension",
  render: ({ params }) => [
    PageHeader({
      title: params.extension,
      description: "DuckDB extension",
    }),
    KeyValue({ source: extensionDetails({ name: params.extension }) }),
    Button({
      label: "Install",
      action: installExtension({ name: params.extension }),
    }),
    Button({
      label: "Load",
      variant: "primary",
      action: loadExtension({ name: params.extension }),
    }),
  ],
});
