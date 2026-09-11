import type { PageDocument } from "@northgraindata/dsui-adapter-sdk";
import { DeclarativePageRenderer } from "@northgraindata/dsui-renderer";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  executeAction,
  executeResource,
  getPage,
  getServicePages,
  getServices,
  type Service,
} from "../../api";
import { AdapterWorkspace } from "../../components/adapter-workspace";
import { EmptyState, pageClass, UnavailableState } from "../../components/page";

/** Loads and renders the declarative page for an adapter workspace. */
export function ServiceScreen({
  serviceId,
  viewId,
  pagePath,
}: {
  serviceId: string;
  viewId?: string;
  pagePath?: string;
}) {
  const navigate = useNavigate();
  const [service, setService] = useState<Service>();
  const [paths, setPaths] = useState<string[]>([]);
  const [page, setPage] = useState<PageDocument>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    Promise.all([getServices(), getServicePages(serviceId)])
      .then(([all, response]) => {
        if (!active) return;
        setService(all.find((candidate) => candidate.id === serviceId));
        setPaths(response.pages.map((item) => item.path));
      })
      .catch(
        (cause) =>
          active &&
          setError(
            cause instanceof Error ? cause.message : "Could not load service.",
          ),
      );
    return () => {
      active = false;
    };
  }, [serviceId]);

  const path =
    pagePath ?? (viewId ? `/${decodeURIComponent(viewId)}` : paths[0]);

  useEffect(() => {
    if (!path) return;
    let active = true;
    setPage(undefined);
    getPage(serviceId, path)
      .then((document) => active && setPage(document))
      .catch(
        (cause) =>
          active &&
          setError(
            cause instanceof Error ? cause.message : "Could not load page.",
          ),
      );
    return () => {
      active = false;
    };
  }, [serviceId, path]);

  if (error)
    return (
      <div className={pageClass}>
        <UnavailableState detail={error} />
      </div>
    );

  if (!service)
    return (
      <div className={pageClass}>
        <div className="py-10 text-center font-mono text-[11px] text-muted">
          Loading service…
        </div>
      </div>
    );

  return (
    <AdapterWorkspace service={service} paths={paths} path={path}>
      {page ? (
        <DeclarativePageRenderer
          nodes={page.nodes}
          client={{
            connection: {
              name: service.name,
              endpoint: service.endpoint ?? "",
            },
            executeResource: async (reference) =>
              (
                await executeResource(
                  service.id,
                  reference.resourceId,
                  reference.input,
                )
              ).data,
            executeAction: async (reference) => {
              const result = await executeAction(
                service.id,
                reference.actionId,
                reference.input,
              );
              return result.status === "success"
                ? { status: "success" as const, data: result.data }
                : { status: "error" as const, message: result.message };
            },
            navigate: (destination) =>
              navigate({
                to: "/services/$serviceId/$",
                params: {
                  serviceId: service.id,
                  _splat: decodeURIComponent(destination.slice(1)),
                },
              }),
          }}
        />
      ) : (
        <EmptyState
          title="Loading page"
          detail="The adapter page is being prepared."
        />
      )}
    </AdapterWorkspace>
  );
}
