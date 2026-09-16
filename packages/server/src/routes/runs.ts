import type { Context, Hono } from "hono";
import { z } from "zod";
import { allowed } from "../auth.js";
import type {
  Run,
  RunArtifact,
  RunArtifactContent,
  RunProtocol,
} from "../runs/contracts.js";
import { errorMessage, httpStatus } from "./errors.js";

const environmentValueSchema = z.union([
  z.object({ value: z.string() }).strict(),
  z.object({ secretRef: z.string().min(1) }).strict(),
]);

export const startRunSchema = z
  .object({
    command: z.enum(["run", "build", "test", "compile", "docs_generate"]),
    project: z.union([
      z.object({ path: z.string().min(1) }).strict(),
      z.object({ uploadId: z.string().min(1) }).strict(),
    ]),
    profile: z
      .object({
        name: z.string().min(1).optional(),
        target: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    environment: z.record(environmentValueSchema).optional(),
    args: z
      .record(z.union([z.string(), z.boolean(), z.array(z.string())]))
      .optional(),
    cwd: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().safe().optional(),
  })
  .strict();

const positiveInteger = z.coerce.number().int().positive().safe();

function publicArtifact(artifact: RunArtifact) {
  const { ref: _ref, ...location } = artifact.location;
  return { ...artifact, location };
}

function publicRun(run: Run) {
  const { environment: _environment, ...request } = run.request;
  const project =
    "path" in request.project ? { path: "[REDACTED]" } : request.project;
  return { ...run, request: { ...request, project } };
}

function publicArtifactContent(content: RunArtifactContent) {
  return {
    ...content,
    artifact: publicArtifact(content.artifact),
  };
}

function isValidation(error: unknown): boolean {
  return error instanceof z.ZodError;
}

function isNotFound(error: unknown): boolean {
  return (
    errorMessage(error).startsWith("Run not found") ||
    errorMessage(error).startsWith("Artifact not found")
  );
}

function respondError(context: Context, error: unknown) {
  return context.json(
    { message: errorMessage(error) },
    isValidation(error) || errorMessage(error).includes("required")
      ? 422
      : isNotFound(error)
        ? 404
        : httpStatus(error),
  );
}

async function jsonBody(context: Context) {
  try {
    return await context.req.json();
  } catch {
    throw new Error("Invalid JSON payload");
  }
}

function idempotencyKey(context: Context): string {
  const key = context.req.header("Idempotency-Key");
  if (!key?.trim()) throw new Error("Idempotency-Key header is required");
  return key;
}

export function registerRunRoutes(
  app: Hono,
  deps: { runs: RunProtocol },
): void {
  app.post("/api/v1/runs", async (context) => {
    const principal = context.get("principal");
    if (!allowed(principal, "execute"))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const input = startRunSchema.parse(await jsonBody(context));
      const result = await deps.runs.startRun({
        ...input,
        idempotencyKey: idempotencyKey(context),
      });
      if (result.outcome === "conflict")
        return context.json(
          { message: "Idempotency key was reused with a different request" },
          409,
        );
      return context.json(
        { ...result, run: publicRun(result.run) },
        result.outcome === "replayed" ? 200 : 202,
      );
    } catch (error) {
      return respondError(context, error);
    }
  });

  app.get("/api/v1/runs/:invocationId", async (context) => {
    const principal = context.get("principal");
    if (!allowed(principal, "inspect"))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const run = await deps.runs.getRun({
        invocationId: context.req.param("invocationId"),
      });
      return context.json(publicRun(run));
    } catch (error) {
      return respondError(context, error);
    }
  });

  app.get("/api/v1/runs/:invocationId/events", async (context) => {
    const principal = context.get("principal");
    if (!allowed(principal, "inspect"))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const query = z
        .object({
          cursor: z.string().min(1).optional(),
          limit: positiveInteger.optional(),
        })
        .strict()
        .parse(context.req.query());
      return context.json(
        await deps.runs.listRunEvents({
          invocationId: context.req.param("invocationId"),
          ...query,
        }),
      );
    } catch (error) {
      return respondError(context, error);
    }
  });

  app.post("/api/v1/runs/:invocationId/cancel", async (context) => {
    const principal = context.get("principal");
    if (!allowed(principal, "execute"))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const run = await deps.runs.cancelRun({
        invocationId: context.req.param("invocationId"),
        idempotencyKey: idempotencyKey(context),
      });
      return context.json(publicRun(run), 202);
    } catch (error) {
      return respondError(context, error);
    }
  });

  app.get("/api/v1/runs/:invocationId/artifacts", async (context) => {
    const principal = context.get("principal");
    if (!allowed(principal, "inspect"))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const artifacts = await deps.runs.listRunArtifacts({
        invocationId: context.req.param("invocationId"),
      });
      return context.json(artifacts.map(publicArtifact));
    } catch (error) {
      return respondError(context, error);
    }
  });

  app.get(
    "/api/v1/runs/:invocationId/artifacts/:artifactId",
    async (context) => {
      const principal = context.get("principal");
      if (!allowed(principal, "inspect"))
        return context.json({ message: "Insufficient permission" }, 403);
      try {
        const query = z
          .object({ maxBytes: positiveInteger.optional() })
          .strict()
          .parse(context.req.query());
        const content = await deps.runs.getRunArtifact({
          invocationId: context.req.param("invocationId"),
          artifactId: context.req.param("artifactId"),
          ...query,
        });
        return context.json(publicArtifactContent(content));
      } catch (error) {
        return respondError(context, error);
      }
    },
  );
}
