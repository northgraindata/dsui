import {
  definePage,
  KeyValue,
  PageHeader,
} from "@northgraindata/dsui-adapter-sdk";

export const filesPage = definePage({
  path: "/files",
  render: () => [
    PageHeader({
      title: "Files",
      description: "Query CSV, JSON, and Parquet files with DuckDB.",
    }),
    KeyValue({
      title: "File discovery",
      data: {
        status: "Not configured",
        guidance:
          "DuckDB does not maintain a universal file catalog. Configure discoverable file sources before they are shown here.",
        formats: "Parquet, CSV, JSON",
      },
    }),
  ],
});
