import {
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { triggerJob } from "../actions/jobs.js";
import { jobs, projects } from "../resources/cloud.js";

export const projectsPage = definePage({
  path: "/projects",
  render: () => [
    PageHeader({ title: "Projects", description: "dbt Cloud projects." }),
    Table({
      source: projects(),
      columns: [
        { id: "name", label: "Project" },
        { id: "repository", label: "Repository" },
        { id: "state", label: "State" },
      ],
      rowLink: { path: "/projects/:projectId", params: { projectId: "id" } },
    }),
  ],
});

export const jobsPage = definePage({
  path: "/jobs",
  render: () => [
    PageHeader({ title: "Jobs", description: "dbt Cloud jobs." }),
    Table({
      source: jobs(),
      columns: [
        { id: "name", label: "Job" },
        { id: "project_id", label: "Project" },
        { id: "schedule", label: "Schedule" },
        { id: "state", label: "State" },
      ],
      rowActions: [
        {
          action: triggerJob,
          label: "Trigger",
          icon: "play",
          input: { jobId: "id" },
        },
      ],
    }),
  ],
});
