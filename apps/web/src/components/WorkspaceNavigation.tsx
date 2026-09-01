import { cn } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";
import { normalizeRenderer, type Renderer } from "../api";
import {
  buildWorkspaceAreas,
  type ServiceView,
  type WorkspaceArea,
} from "../workspace-navigation";
import { Icon } from "./Icon";

const navLink =
  "group relative flex h-8 items-center gap-2.5 px-2.5 text-[12px] no-underline transition-colors hover:bg-surface-hover hover:text-primary";

function iconFor(renderer: Renderer) {
  return renderer.includes("query")
    ? "terminal"
    : renderer.includes("object") ||
        renderer.includes("schema") ||
        renderer.includes("table")
      ? "folder"
      : "database";
}

function activeAreaFor(
  areas: WorkspaceArea[],
  activeViewId?: string,
): WorkspaceArea | undefined {
  return areas.find((area) =>
    area.allViews.some((view) => view.id === activeViewId),
  );
}

export function WorkspacePrimaryNavigation({
  serviceId,
  views,
  activeViewId,
}: {
  serviceId: string;
  views: ServiceView[];
  activeViewId?: string;
}) {
  const areas = buildWorkspaceAreas(views);
  const activeArea = activeAreaFor(areas, activeViewId);

  if (!areas.length)
    return (
      <nav aria-label="Service capabilities" className="grid gap-px">
        {views.map((view) => (
          <Link
            key={view.id}
            to="/services/$serviceId/$viewId"
            params={{ serviceId, viewId: view.id }}
            aria-current={activeViewId === view.id ? "page" : undefined}
            className={cn(
              navLink,
              activeViewId === view.id
                ? "bg-surface-hover text-primary"
                : "text-muted",
            )}
          >
            <Icon name={iconFor(normalizeRenderer(view.renderer))} />
            {view.title}
          </Link>
        ))}
      </nav>
    );

  return (
    <nav aria-label="Service workspace" className="grid gap-px">
      {areas.map((area) => {
        const destination = area.views[0] ?? area.allViews[0];
        if (!destination) return null;
        const active = activeArea?.id === area.id;
        return (
          <Link
            key={area.id}
            to="/services/$serviceId/$viewId"
            params={{ serviceId, viewId: destination.id }}
            aria-current={active ? "page" : undefined}
            className={cn(
              navLink,
              active ? "bg-surface-hover text-primary" : "text-muted",
            )}
          >
            <Icon name={iconFor(normalizeRenderer(destination.renderer))} />
            <span>{area.label}</span>
            <span className="ml-auto font-mono text-[9px] tabular-nums text-muted">
              {area.views.length}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function WorkspaceViewTabs({
  serviceId,
  views,
  activeViewId,
}: {
  serviceId: string;
  views: ServiceView[];
  activeViewId?: string;
}) {
  const area = activeAreaFor(buildWorkspaceAreas(views), activeViewId);
  if (!area || area.views.length < 2) return null;

  return (
    <nav
      aria-label={`${area.label} views`}
      className="mb-5 flex max-w-full gap-1 overflow-x-auto border-b border-border"
    >
      {area.views.map((view) => {
        const active = view.id === activeViewId;
        return (
          <Link
            key={view.id}
            to="/services/$serviceId/$viewId"
            params={{ serviceId, viewId: view.id }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative shrink-0 px-3 py-2 font-mono text-[10.5px] no-underline transition-colors hover:text-primary",
              active
                ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-accent"
                : "text-muted",
            )}
          >
            {view.title}
          </Link>
        );
      })}
    </nav>
  );
}
