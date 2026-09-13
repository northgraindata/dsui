import {
  definePage,
  Notebook,
  PageHeader,
} from "@northgraindata/dsui-adapter-sdk";
import { notebookStore } from "../stores/notebook.js";

export const notebooksPage = definePage({
  path: "/notebooks",
  stores: [notebookStore],
  render: ({ stores }) => {
    const notebook = stores.use(notebookStore);
    return [
      PageHeader({
        title: "Notebooks",
        description: "Combine notes and executable SQL in one workspace.",
      }),
      Notebook({
        title: notebook.title,
        description: notebook.description,
        blocks: notebook.blocks,
      }),
    ];
  },
});
