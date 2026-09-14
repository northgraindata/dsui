import {
  defineStore,
  type NotebookBlock,
} from "@northgraindata/dsui-adapter-sdk";

export type NotebookRecord = {
  id: string;
  title: string;
  description: string;
  blocks: NotebookBlock[];
  environment: string;
  location: string;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string;
};

export type NotebookState = {
  selectedId: string;
  notebooks: NotebookRecord[];
};

const initialNotebook: NotebookRecord = {
  id: "customer-analysis",
  title: "Customer Analysis",
  description: "Explore the data with a sequence of notes and executable SQL.",
  environment: "DuckDB",
  location: "Local workspace",
  createdAt: "2026-09-14T00:00:00.000Z",
  updatedAt: "2026-09-14T00:00:00.000Z",
  lastViewedAt: "2026-09-14T00:00:00.000Z",
  blocks: [
    {
      id: "intro",
      kind: "markdown",
      content:
        "# Markdown showcase\n\nThis block demonstrates the formatting available in a notebook. Click anywhere here to edit the source.\n\n## Text styles\n\n**Bold**, *italic*, ~~strikethrough~~, `inline code`, and [a link](https://github.com).\n\n> Markdown keeps analysis readable while SQL blocks stay executable.\n\n- [x] Headings and paragraphs\n- [x] Lists and task lists\n- [ ] Tables, callouts, and code fences\n\n### Table\n\n| Feature | Status |\n| --- | --- |\n| Markdown preview | Ready |\n| SQL execution | Ready |\n\n> [!NOTE]\n> This is a GitHub-style callout for useful context.\n\n---\n\n```sql\nSELECT 'Markdown + SQL' AS notebook;\n```",
    },
    {
      id: "customer-count",
      kind: "code",
      language: "sql",
      content:
        "SELECT plan, count(*) AS customers\nFROM sales.customers\nGROUP BY plan\nORDER BY customers DESC;",
      action: "run-query",
    },
    {
      id: "revenue-by-month",
      kind: "code",
      language: "sql",
      content:
        "SELECT *\nFROM analytics.revenue_by_month\nORDER BY month DESC\nLIMIT 12;",
      action: "run-query",
    },
  ],
};

export const notebookStore = defineStore({
  id: "notebook",
  scope: "adapter",
  persistence: {
    type: "persistent",
    key: "notebook",
    version: 1,
  },
  state: {
    selectedId: initialNotebook.id,
    notebooks: [initialNotebook],
  } satisfies NotebookState,
  actions: ({ set }) => ({
    setSelected: (selectedId: string) => set({ selectedId }),
  }),
});
