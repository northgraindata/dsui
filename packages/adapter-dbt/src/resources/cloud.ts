import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import type { DbtContext } from "../context.js";

function cloud(ctx: DbtContext) {
  if (!ctx.cloud)
    throw new Error(
      "This resource is available for dbt Cloud connections only",
    );
  return ctx.cloud;
}

export const projects = defineResource({
  id: "projects",
  query: (_input: undefined, ctx: DbtContext) => cloud(ctx).listProjects(),
});

export const jobs = defineResource({
  id: "jobs",
  query: (_input: undefined, ctx: DbtContext) => cloud(ctx).listJobs(),
});
