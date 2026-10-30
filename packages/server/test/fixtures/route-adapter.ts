import {
  defineAdapter,
  defineRoute,
  RouteError,
  routeJson,
  z,
} from "@northgraindata/dsui-adapter-sdk";

export default defineAdapter({
  metadata: { id: "route-test", name: "Route test", version: "1.0.0" },
  health: async () => ({ status: "healthy", score: 100, checks: [] }),
  connectionMethods: {
    push: {
      label: "Push",
      schema: z.object({ token: z.string().default("") }),
    },
  },
  routes: [
    defineRoute({
      id: "upload",
      method: "PUT",
      path: "/files/:name",
      auth: { token: "token" },
      maxBodyBytes: 1024,
      handle: async ({ request, blobs }) => {
        if (request.query.fail) throw new RouteError(422, "rejected");
        if (request.query.crash) throw new Error("/secret/host/path failed");
        await blobs.put(`files/${request.params.name}`, request.body);
        return {
          status: 201,
          headers: {
            "content-type": "application/json",
            "set-cookie": "session=stolen",
          },
          body: JSON.stringify({ size: request.body.byteLength }),
        };
      },
    }),
    defineRoute({
      id: "read",
      method: "GET",
      path: "/files/:name",
      auth: "principal",
      handle: async ({ request, blobs }) => {
        const bytes = await blobs.get(`files/${request.params.name}`);
        if (!bytes) throw new RouteError(404, "No such file");
        return routeJson({ text: new TextDecoder().decode(bytes) });
      },
    }),
  ],
});
