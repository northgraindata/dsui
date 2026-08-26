import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import {
  AddService,
  AppShell,
  Dashboard,
  Login,
  ServiceDetail,
  Services,
  ServiceView,
  Settings,
  Setup,
} from "./screens";

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});
const servicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/services",
  component: Services,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Settings,
});
const addRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/services/new",
  component: AddService,
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
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: Login,
});
const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: Setup,
});
const routeTree = rootRoute.addChildren([
  indexRoute,
  servicesRoute,
  settingsRoute,
  addRoute,
  detailRoute,
  viewRoute,
  loginRoute,
  setupRoute,
]);
export const router = createRouter({ routeTree, defaultPreload: "intent" });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
