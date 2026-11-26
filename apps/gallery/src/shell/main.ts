import { toScenario } from "../scenario";
import { installFixtureApi } from "./api";
import { mountControls } from "./controls";

const KEY = "dsui-gallery-scenario";

/** The app's own navigation drops query strings, so the tab remembers them. */
function remembered(search: URLSearchParams): string | null {
  try {
    const requested = search.get("scenario");
    if (requested) sessionStorage.setItem(KEY, requested);
    return sessionStorage.getItem(KEY);
  } catch {
    return search.get("scenario");
  }
}

export async function startShell(): Promise<void> {
  const search = new URLSearchParams(location.search);
  const scenario = toScenario(remembered(search));
  // Must precede the app, which fetches as soon as it mounts.
  installFixtureApi(scenario);
  await import("../../../web/src/main");
  if (search.get("toolbar") !== "0") mountControls(scenario);
}
