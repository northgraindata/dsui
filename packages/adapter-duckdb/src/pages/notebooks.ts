import {
  definePage,
  Notebook,
  NotebookCatalog,
  PageHeader,
} from "@northgraindata/dsui-adapter-sdk";
import { type NotebookState, notebookStore } from "../stores/notebook.js";
import { sessionStore } from "../stores/session.js";

function openTabs(
  state: Pick<NotebookState, "notebooks" | "selectedId">,
  session: { openNotebookIds: string[] },
) {
  const byId = new Map(state.notebooks.map((item) => [item.id, item]));
  const tabs = session.openNotebookIds
    .map((id) => byId.get(id))
    .filter((item): item is NotebookState["notebooks"][number] => Boolean(item))
    .map(({ id, title }) => ({ id, title }));
  if (tabs.length) return tabs;
  const selected = byId.get(state.selectedId);
  return selected ? [{ id: selected.id, title: selected.title }] : [];
}

export const notebooksPage = definePage({
  path: "/notebooks/:notebookId",
  stores: [notebookStore, sessionStore],
  render: ({ params, stores }) => {
    const state = stores.use(notebookStore);
    const session = stores.use(sessionStore);
    const notebook =
      state.notebooks.find((item) => item.id === params.notebookId) ??
      state.notebooks[0];
    return [
      PageHeader({
        title: "Notebooks",
        description: "Combine notes and executable SQL in one workspace.",
      }),
      Notebook({
        title: notebook.title,
        description: notebook.description,
        blocks: notebook.blocks,
        id: notebook.id,
        notebooks: state.notebooks.map(({ id, title }) => ({ id, title })),
        openTabs: openTabs(state, session),
        metadata: notebook,
        actions: {
          save: "save-notebook",
          select: "select-notebook",
          create: "create-notebook",
          delete: "delete-notebook",
          duplicate: "duplicate-notebook",
          import: "import-notebook",
          close: "close-notebook",
        },
      }),
    ];
  },
});

export const notebooksIndexPage = definePage({
  path: "/notebooks",
  stores: [notebookStore],
  render: ({ stores }) => {
    const state = stores.use(notebookStore);
    return [
      PageHeader({
        title: "Notebooks",
        description: "Combine notes and executable SQL in one workspace.",
      }),
      NotebookCatalog({
        notebooks: state.notebooks.map((notebook) => ({
          id: notebook.id,
          title: notebook.title,
          description: notebook.description,
          environment: notebook.environment,
          location: notebook.location,
          updatedAt: notebook.updatedAt,
          lastViewedAt: notebook.lastViewedAt,
        })),
        actions: {
          create: "create-notebook",
          import: "import-notebook",
        },
      }),
    ];
  },
});
