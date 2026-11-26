/**
 * One origin serves two things. `/` is the gallery. Every other path, and `/`
 * with `?shell=1`, is the real web application running on fixture data.
 */
const isShell =
  location.pathname !== "/" ||
  new URLSearchParams(location.search).has("shell");

if (isShell) void import("./shell/main").then((shell) => shell.startShell());
else if (new URLSearchParams(location.search).get("harness") === "select")
  void import("./harness/select").then((page) => page.startSelectHarness());
else if (new URLSearchParams(location.search).get("harness") === "overlays")
  void import("./harness/overlays").then((page) => page.startOverlayHarness());
else if (new URLSearchParams(location.search).get("harness") === "airflow")
  void import("./prototype/airflow/main").then((page) =>
    page.startAirflowPrototype(),
  );
else void import("./gallery-main").then((gallery) => gallery.startGallery());
