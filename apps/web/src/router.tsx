import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { authenticationEntry, currentPrincipal, getPluginCatalog } from "./api";
import { AppShell } from "./app/app-shell";
import { isPublicPluginPage } from "./auth-routing";
import {
  ServiceDetail,
  ServiceObjectView,
  ServicePage,
  ServiceView,
} from "./features/adapter-workspace/service-screens";
import {
  AdaptersScreen,
  AddAdapterScreen,
} from "./features/adapters/adapter-screens";
import { DashboardScreen } from "./features/dashboard/dashboard-screen";
import { PluginPageScreen } from "./features/plugins/plugin-page-screen";
import { SettingsScreen } from "./features/settings/settings-screen";

const rootRoute = createRootRoute({
  component: AppShell,
  beforeLoad: async ({ location }) => {
    if (await currentPrincipal()) return;
    const entry = await authenticationEntry();
    if (entry.mode === "none") return;
    if (entry.mode === "unavailable" || !entry.pageId)
      throw new Error(
        "Authentication is unavailable. Contact your administrator.",
      );
    const catalog = await getPluginCatalog();
    if (isPublicPluginPage(location.pathname, catalog.pages)) return;
    throw redirect({
      to: "/plugins/$pluginId/$",
      params: { pluginId: entry.pluginId, _splat: entry.pageId },
      replace: true,
    });
  },
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardScreen,
});
const servicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/services",
  component: AdaptersScreen,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsScreen,
});
const addRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/services/new",
  component: AddAdapterScreen,
});
const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/services/$serviceId",
  component: ServiceDetail,
});
const viewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/services/$serviceId/$viewId",
  component: ServiceView,
});
const objectViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/services/$serviceId/$viewId/$database/$objectName/$tabId",
  component: ServiceObjectView,
});
const pageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/services/$serviceId/$",
  component: ServicePage,
});
const pluginPageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plugins/$pluginId/$",
  component: PluginPageScreen,
});
const routeTree = rootRoute.addChildren([
  indexRoute,
  servicesRoute,
  settingsRoute,
  addRoute,
  detailRoute,
  viewRoute,
  objectViewRoute,
  pageRoute,
  pluginPageRoute,
]);
const basepath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const router = createRouter({
  routeTree,
  ...(basepath ? { basepath } : {}),
  defaultPreload: "intent",
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
