export function withWebBasePath(
  path: string,
  basePath = process.env.DSUI_WEB_BASE_PATH ?? "/",
): string {
  const prefix =
    basePath === "/" ? "" : `/${basePath.replace(/^\/+|\/+$/g, "")}`;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${suffix}`;
}
