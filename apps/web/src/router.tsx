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
import { LoginScreen, SetupScreen } from "./features/auth/auth-screens";
import { DashboardScreen } from "./features/dashboard/dashboard-screen";
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
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginScreen,
});
const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: SetupScreen,
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
  loginRoute,
  setupRoute,
]);
export const router = createRouter({ routeTree, defaultPreload: "intent" });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
