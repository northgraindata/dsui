import {
  definePage,
  Form,
  PageHeader,
  Table,
  Tabs,
  TextInput,
} from "@northgraindata/dsui-adapter-sdk";
import {
  createSchema,
  createSchemaInput,
  dropSchema,
} from "../actions/schemas.js";
import {
  columns,
  constraints,
  databaseColumns,
  databaseConstraints,
  databaseIndexes,
  databaseRelations,
  databaseSchemas,
  databases,
  indexes,
  relations,
  schemas,
} from "../resources/catalog.js";
import {
  databaseRelationPreview,
  relationPreview,
} from "../resources/preview.js";

export const databasesPage = definePage({
  path: "/databases",
  render: () => [
    PageHeader({
      title: "Databases",
      description:
        "Databases visible from the configured PostgreSQL connection.",
    }),
    Table({
      source: databases(),
      searchable: true,
      pageSize: 50,
    }),
  ],
});

export const databasePage = definePage({
  path: "/databases/:database",
  render: ({ params }) => [
    PageHeader({ title: params.database }),
    Table({
      source: databaseSchemas({ database: params.database }),
      rowLink: {
        path: `/databases/${encodeURIComponent(params.database)}/schemas/:schema`,
        params: { schema: "name" },
      },
      searchable: true,
      pageSize: 100,
    }),
  ],
});

export const databaseSchemaPage = definePage({
  path: "/databases/:database/schemas/:schema",
  render: ({ params }) => [
    PageHeader({ title: `${params.database}.${params.schema}` }),
    Table({
      source: databaseRelations({
        database: params.database,
        schema: params.schema,
      }),
      rowLink: {
        path: `/databases/${encodeURIComponent(params.database)}/schemas/${encodeURIComponent(params.schema)}/:relation`,
        params: { relation: "name" },
      },
      searchable: true,
      pageSize: 100,
    }),
  ],
});

export const schemasPage = definePage({
  path: "/schemas",
  render: () => [
    PageHeader({
      title: "Schemas",
      description: "Schemas in the configured PostgreSQL database.",
    }),
    Form({
      schema: createSchemaInput,
      fields: [TextInput({ name: "schema", label: "Schema name" })],
      onSubmit: createSchema,
      submitLabel: "Create schema",
    }),
    Table({
      source: schemas(),
      rowLink: { path: "/schemas/:schema", params: { schema: "name" } },
      rowActions: [
        {
          label: "Drop",
          variant: "danger",
          action: dropSchema,
          input: { schema: "name" },
          confirmation: {
            title: "Drop schema?",
            description:
              "This removes the schema and its objects only when CASCADE is used.",
            confirmLabel: "Drop schema",
          },
        },
      ],
      searchable: true,
      pageSize: 100,
    }),
  ],
});

export const relationsPage = definePage({
  path: "/schemas/:schema",
  render: ({ params }) => [
    PageHeader({ title: params.schema }),
    Table({
      source: relations({ schema: params.schema }),
      rowLink: {
        path: "/schemas/:schema/:relation",
        params: { schema: "schema", relation: "name" },
      },
      searchable: true,
      pageSize: 100,
    }),
  ],
});

export const relationColumnsPage = definePage({
  path: "/schemas/:schema/:relation",
  render: ({ params }) => [
    PageHeader({ title: `${params.schema}.${params.relation}` }),
    Tabs({
      variant: "detail",
      items: [
        {
          label: "Preview",
          content: Table({
            source: relationPreview({
              schema: params.schema,
              relation: params.relation,
              maxRows: 100,
            }),
            variant: "data",
            pageSize: 100,
          }),
        },
        {
          label: "Columns",
          content: Table({
            source: columns({
              schema: params.schema,
              relation: params.relation,
            }),
            searchable: true,
            pageSize: 100,
          }),
        },
        {
          label: "Indexes",
          content: Table({
            source: indexes({
              schema: params.schema,
              relation: params.relation,
            }),
            searchable: true,
            pageSize: 100,
          }),
        },
        {
          label: "Constraints",
          content: Table({
            source: constraints({
              schema: params.schema,
              relation: params.relation,
            }),
            searchable: true,
            pageSize: 100,
          }),
        },
      ],
    }),
  ],
});

export const databaseRelationPage = definePage({
  path: "/databases/:database/schemas/:schema/:relation",
  render: ({ params }) => [
    PageHeader({
      title: `${params.database}.${params.schema}.${params.relation}`,
    }),
    Tabs({
      variant: "detail",
      items: [
        {
          label: "Preview",
          content: Table({
            source: databaseRelationPreview({
              database: params.database,
              schema: params.schema,
              relation: params.relation,
              maxRows: 100,
            }),
            variant: "data",
            pageSize: 100,
          }),
        },
        {
          label: "Columns",
          content: Table({
            source: databaseColumns({
              database: params.database,
              schema: params.schema,
              relation: params.relation,
            }),
            searchable: true,
            pageSize: 100,
          }),
        },
        {
          label: "Indexes",
          content: Table({
            source: databaseIndexes({
              database: params.database,
              schema: params.schema,
              relation: params.relation,
            }),
            searchable: true,
            pageSize: 100,
          }),
        },
        {
          label: "Constraints",
          content: Table({
            source: databaseConstraints({
              database: params.database,
              schema: params.schema,
              relation: params.relation,
            }),
            searchable: true,
            pageSize: 100,
          }),
        },
      ],
    }),
  ],
});
