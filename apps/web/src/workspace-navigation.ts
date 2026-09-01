import type { Manifest } from "./api";

export type ServiceView = Manifest["views"][number];

export type WorkspaceArea = {
  id: string;
  label: string;
  order: number;
  views: ServiceView[];
  allViews: ServiceView[];
};

export function buildWorkspaceAreas(views: ServiceView[]): WorkspaceArea[] {
  if (!views.some((view) => view.navigation)) return [];

  const areas = new Map<string, WorkspaceArea>();
  for (const view of views) {
    const declared = view.navigation?.area;
    const id = declared?.id ?? "other";
    const existing = areas.get(id);
    if (existing) {
      existing.allViews.push(view);
      if (!view.navigation?.parent) existing.views.push(view);
      continue;
    }
    areas.set(id, {
      id,
      label: declared?.label ?? "Other",
      order: declared?.order ?? Number.MAX_SAFE_INTEGER,
      views: view.navigation?.parent ? [] : [view],
      allViews: [view],
    });
  }

  return [...areas.values()].sort(
    (left, right) =>
      left.order - right.order || left.label.localeCompare(right.label),
  );
}
