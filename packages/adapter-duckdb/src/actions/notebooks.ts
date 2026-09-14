import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";
import { type NotebookRecord, notebookStore } from "../stores/notebook.js";
import { sessionStore } from "../stores/session.js";

type Ctx = DuckDbContext & ActionRuntimeContext;

const block = z.object({
  id: z.string().min(1),
  kind: z.enum(["markdown", "code"]),
  content: z.string(),
  language: z.string().optional(),
  action: z.unknown().optional(),
  result: z
    .object({
      columns: z.array(
        z.object({ name: z.string(), type: z.string().optional() }),
      ),
      rows: z.array(z.record(z.string(), z.unknown())),
      elapsedMs: z.number().optional(),
      rowsChanged: z.number().optional(),
    })
    .optional(),
});

const notebookInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(160),
  description: z.string().max(500).default(""),
  blocks: z.array(block),
});

const notebookPayload = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(500).default(""),
  blocks: z.array(block),
});

function store(ctx: Ctx) {
  return ctx.stores.get(notebookStore);
}

function session(ctx: Ctx) {
  return ctx.stores.get(sessionStore);
}

function openNotebook(ctx: Ctx, id: string) {
  session(ctx).actions.openNotebook(id);
}

function normalizeBlock(
  value: z.infer<typeof block>,
): NotebookRecord["blocks"][number] {
  const action =
    value.action &&
    typeof value.action === "object" &&
    "actionId" in value.action
      ? String((value.action as { actionId: unknown }).actionId)
      : typeof value.action === "string"
        ? value.action
        : "run-query";
  return value.kind === "code"
    ? {
        id: value.id,
        kind: "code",
        language: value.language ?? "sql",
        content: value.content,
        action,
        ...(value.result ? { result: value.result } : {}),
      }
    : { id: value.id, kind: "markdown", content: value.content };
}

export const saveNotebook = defineAction({
  id: "save-notebook",
  input: notebookInput,
  run: (input, ctx: Ctx) => {
    const current = store(ctx).get();
    const now = new Date().toISOString();
    const notebooks = current.notebooks.map((notebook) =>
      notebook.id === input.id
        ? {
            id: input.id,
            title: input.title,
            description: input.description,
            blocks: input.blocks.map(normalizeBlock),
            environment: notebook.environment,
            location: notebook.location,
            createdAt: notebook.createdAt,
            updatedAt: now,
            lastViewedAt: notebook.lastViewedAt,
          }
        : notebook,
    );
    store(ctx).set({ notebooks, selectedId: input.id });
    openNotebook(ctx, input.id);
    return { id: input.id };
  },
});

export const createNotebook = defineAction({
  id: "create-notebook",
  input: z.object({ title: z.string().min(1).max(160).optional() }),
  run: ({ title }, ctx: Ctx) => {
    const id = `notebook-${crypto.randomUUID()}`;
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const notebookTitle = title ?? `Notebook ${timestamp}`;
    const notebook: NotebookRecord = {
      id,
      title: notebookTitle,
      description: "",
      environment: "DuckDB",
      location: "Local workspace",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastViewedAt: new Date().toISOString(),
      blocks: [
        {
          id: `markdown-${crypto.randomUUID()}`,
          kind: "markdown",
          content: "## New note\n\nClick to edit this Markdown block.",
        },
      ],
    };
    store(ctx).set({
      notebooks: [...store(ctx).get().notebooks, notebook],
      selectedId: id,
    });
    openNotebook(ctx, id);
    return { id };
  },
});

export const duplicateNotebook = defineAction({
  id: "duplicate-notebook",
  input: z.object({ id: z.string().min(1) }),
  run: ({ id }, ctx: Ctx) => {
    const source = store(ctx)
      .get()
      .notebooks.find((item) => item.id === id);
    if (!source) throw new Error("Notebook not found");
    const now = new Date().toISOString();
    const notebook: NotebookRecord = {
      ...source,
      id: `notebook-${crypto.randomUUID()}`,
      title: `${source.title} copy`,
      blocks: source.blocks.map((item) => ({
        ...item,
        id: `${item.kind}-${crypto.randomUUID()}`,
      })),
      createdAt: now,
      updatedAt: now,
      lastViewedAt: now,
    };
    store(ctx).set({
      notebooks: [...store(ctx).get().notebooks, notebook],
      selectedId: notebook.id,
    });
    openNotebook(ctx, notebook.id);
    return { id: notebook.id };
  },
});

export const importNotebook = defineAction({
  id: "import-notebook",
  input: notebookPayload,
  run: (input, ctx: Ctx) => {
    const now = new Date().toISOString();
    const notebook: NotebookRecord = {
      id: `notebook-${crypto.randomUUID()}`,
      title: input.title,
      description: input.description,
      blocks: input.blocks.map(normalizeBlock),
      environment: "DuckDB",
      location: "Imported",
      createdAt: now,
      updatedAt: now,
      lastViewedAt: now,
    };
    store(ctx).set({
      notebooks: [...store(ctx).get().notebooks, notebook],
      selectedId: notebook.id,
    });
    openNotebook(ctx, notebook.id);
    return { id: notebook.id };
  },
});

export const selectNotebook = defineAction({
  id: "select-notebook",
  input: z.object({ id: z.string().min(1) }),
  run: ({ id }, ctx: Ctx) => {
    if (
      !store(ctx)
        .get()
        .notebooks.some((notebook) => notebook.id === id)
    )
      throw new Error("Notebook not found");
    const now = new Date().toISOString();
    store(ctx).set({
      selectedId: id,
      notebooks: store(ctx)
        .get()
        .notebooks.map((notebook) =>
          notebook.id === id ? { ...notebook, lastViewedAt: now } : notebook,
        ),
    });
    session(ctx).actions.closeNotebook(id);
    return { id };
  },
});

export const closeNotebook = defineAction({
  id: "close-notebook",
  input: z.object({ id: z.string().min(1) }),
  run: ({ id }, ctx: Ctx) => {
    session(ctx).actions.closeNotebook(id);
    const remaining = session(ctx).get().openNotebookIds;
    return { id: remaining.at(-1) };
  },
});

export const deleteNotebook = defineAction({
  id: "delete-notebook",
  input: z.object({ id: z.string().min(1) }),
  run: ({ id }, ctx: Ctx) => {
    const remaining = store(ctx)
      .get()
      .notebooks.filter((notebook) => notebook.id !== id);
    if (remaining.length === 0)
      throw new Error("At least one notebook is required");
    store(ctx).set({
      notebooks: remaining,
      selectedId: remaining[0].id,
    });
    return { id };
  },
});
