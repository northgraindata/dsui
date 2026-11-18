import { definePage, List, PageHeader } from "@northgraindata/dsui-adapter-sdk";
import { triggerJob } from "../actions/jobs.js";
import { jobs, projects } from "../resources/cloud.js";

export const projectsPage = definePage({
  path: "/projects",
  render: () => [
    PageHeader({ title: "Projects", description: "dbt Cloud projects." }),
    List({
      source: projects(),
      noun: "project",
      searchable: true,
      item: {
        icon: "folder",
        title: "name",
        description: "repository",
        status: { label: "state" },
      },
      rowLink: { path: "/projects/:projectId", params: { projectId: "id" } },
    }),
  ],
});

export const jobsPage = definePage({
  path: "/jobs",
  render: () => [
    PageHeader({ title: "Jobs", description: "dbt Cloud jobs." }),
    List({
      source: jobs(),
      noun: "job",
      searchable: true,
      item: {
        icon: "grid",
        title: "name",
        badge: "schedule",
        description: "project_id",
        status: { label: "state" },
      },
      rowActions: [
        {
          action: triggerJob,
          label: "Trigger",
          icon: "play",
          variant: "primary",
          input: { jobId: "id" },
        },
      ],
    }),
  ],
});
