const CLOUD_ORIGIN = "https://cloud.dsui.northgraindata.com";

/**
 * The link into DSUI Cloud, tagged so the cloud app's analytics can say which
 * part of the site a sign-up came from. `medium` is the place on the page.
 */
export function cloudUrl(medium: "navbar" | "section" | "footer"): string {
  const url = new URL(CLOUD_ORIGIN);
  url.searchParams.set("utm_source", "dsui-site");
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", "cloud");
  return url.toString();
}
