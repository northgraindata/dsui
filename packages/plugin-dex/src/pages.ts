import { defineComponent, definePage } from "@northgraindata/dsui-plugin-sdk";
import { type DexContext, findProject } from "./resources.js";

const Screen = defineComponent<{ projectId?: string }>({
  id: "dex/screen",
  path: "./browser.tsx",
});

export const projectsPage = definePage<"/dex", DexContext>({
  path: "/dex",
  render: () => Screen({}),
});

export const projectPage = definePage<"/projects/:projectId", DexContext>({
  path: "/projects/:projectId",
  render: ({ context, params }) =>
    Screen({
      projectId: findProject(context.config, params.projectId).id,
    }),
});
