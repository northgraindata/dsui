import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppShell } from "./app/app-shell";
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
import { AnalyticsScreen } from "./features/analytics/analytics-screen";
import { DashboardScreen } from "./features/dashboard/dashboard-screen";
import { PluginPageScreen } from "./features/plugins/plugin-page-screen";
import { SettingsScreen } from "./features/settings/settings-screen";

const rootRoute = createRootRoute({ component: AppShell });
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
const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics/dashboards",
  component: AnalyticsScreen,
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
  analyticsRoute,
  settingsRoute,
  addRoute,
  detailRoute,
  viewRoute,
  objectViewRoute,
  pageRoute,
  pluginPageRoute,
]);
export const router = createRouter({ routeTree, defaultPreload: "intent" });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
