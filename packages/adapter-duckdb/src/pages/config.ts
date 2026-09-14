import {
  definePage,
  Form,
  PageHeader,
  Table,
  Tabs,
  TextInput,
} from "@northgraindata/dsui-adapter-sdk";
import {
  resetSetting,
  setSetting,
  setSettingInput,
} from "../actions/config.js";
import {
  installExtension,
  installExtensionInput,
  loadExtension,
} from "../actions/extensions.js";
import {
  attachDatabase,
  attachInput,
  detachDatabase,
} from "../actions/schema.js";
import {
  createSecret,
  createSecretInput,
  dropSecret,
} from "../actions/secrets.js";
import { databases, functions, types } from "../resources/catalog.js";
import { settings } from "../resources/config.js";
import { extensions } from "../resources/extensions.js";
import { secrets } from "../resources/secrets.js";

export const settingsPage = definePage({
  path: "/admin",
  render: () => [
    PageHeader({ title: "Administration" }),
    Tabs({
      items: [
        {
          label: "Connections",
          content: [
            Table({
              source: databases(),
              rowActions: [
                {
                  label: "Detach",
                  variant: "danger",
                  action: detachDatabase,
                  input: { database: "name" },
                  when: { field: "internal", equals: false },
                },
              ],
            }),
            Form({
              schema: attachInput,
              fields: [
                TextInput({ name: "source", label: "Database path or URI" }),
                TextInput({ name: "alias", label: "Alias" }),
              ],
              onSubmit: attachDatabase,
              submitLabel: "Attach database",
            }),
          ],
        },
        {
          label: "Settings",
          content: [
            Table({
              source: settings({}),
              rowActions: [
                {
                  label: "Reset",
                  action: resetSetting,
                  input: { name: "name" },
                },
              ],
            }),
            Form({
              schema: setSettingInput,
              fields: [
                TextInput({ name: "name", label: "Name" }),
                TextInput({ name: "value", label: "Value" }),
              ],
              onSubmit: setSetting,
              submitLabel: "Set setting",
            }),
          ],
        },
        {
          label: "Extensions",
          content: [
            Table({
              source: extensions(),
              rowActions: [
                {
                  label: "Load",
                  action: loadExtension,
                  input: { name: "name" },
                  when: { field: "loaded", equals: false },
                },
                {
                  label: "Install",
                  action: installExtension,
                  input: { name: "name" },
                  when: { field: "installed", equals: false },
                },
              ],
            }),
            Form({
              schema: installExtensionInput,
              fields: [TextInput({ name: "name", label: "Extension" })],
              onSubmit: installExtension,
              submitLabel: "Install extension",
            }),
          ],
        },
        {
          label: "Secrets",
          content: [
            Table({
              source: secrets(),
              rowActions: [
                {
                  label: "Drop",
                  variant: "danger",
                  action: dropSecret,
                  input: { name: "name" },
                },
              ],
            }),
            Form({
              schema: createSecretInput,
              fields: [
                TextInput({ name: "type", label: "Type" }),
                TextInput({ name: "keyId", label: "Key ID" }),
                TextInput({ name: "secret", label: "Secret", secret: true }),
              ],
              onSubmit: createSecret,
              submitLabel: "Create secret",
            }),
          ],
        },
        {
          label: "Functions",
          content: Tabs({
            items: [
              { label: "Functions", content: Table({ source: functions({}) }) },
              { label: "Types", content: Table({ source: types() }) },
            ],
          }),
        },
      ],
    }),
  ],
});

export const extensionsPage = definePage({
  path: "/extensions",
  render: () => [
    PageHeader({ title: "Extensions" }),
    Table({
      source: extensions(),
      rowActions: [
        {
          label: "Load",
          action: loadExtension,
          input: { name: "name" },
          when: { field: "loaded", equals: false },
        },
        {
          label: "Install",
          action: installExtension,
          input: { name: "name" },
          when: { field: "installed", equals: false },
        },
      ],
    }),
  ],
});

export const secretsPage = definePage({
  path: "/secrets",
  render: () => [
    PageHeader({ title: "Secrets" }),
    Table({
      source: secrets(),
      rowActions: [
        {
          label: "Drop",
          variant: "danger",
          action: dropSecret,
          input: { name: "name" },
        },
      ],
    }),
    Form({
      schema: createSecretInput,
      fields: [
        TextInput({ name: "type", label: "Type" }),
        TextInput({ name: "keyId", label: "Key ID" }),
        TextInput({ name: "secret", label: "Secret", secret: true }),
      ],
      onSubmit: createSecret,
      submitLabel: "Create secret",
    }),
  ],
});

export const functionsPage = definePage({
  path: "/functions",
  render: () => [
    PageHeader({ title: "Functions" }),
    Tabs({
      items: [
        { label: "Functions", content: Table({ source: functions({}) }) },
        { label: "Types", content: Table({ source: types() }) },
      ],
    }),
  ],
});
