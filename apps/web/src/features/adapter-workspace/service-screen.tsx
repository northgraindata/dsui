import type { PageDocument } from "@northgraindata/dsui-adapter-sdk";
import { DeclarativePageRenderer } from "@northgraindata/dsui-renderer";
import { useNavigate, useRouterState } from "@tanstack/react-router";
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
import { useAdapterTabs } from "./adapter-tabs-context";

/** Loads and renders the declarative page for an adapter workspace. */
export function ServiceScreen({
  serviceId,
  viewId,
  pagePath,
  embedded = false,
}: {
  serviceId: string;
  viewId?: string;
  pagePath?: string;
  embedded?: boolean;
}) {
  const navigate = useNavigate();
  const { state: tabs, dispatch } = useAdapterTabs();
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const [service, setService] = useState<Service>();
  const [services, setServices] = useState<Service[]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const [page, setPage] = useState<PageDocument>();
  // Without the service there is no workspace chrome to keep, so that error
  // takes the whole screen; page errors stay inside the workspace content.
  const [serviceError, setServiceError] = useState<string>();
  const [pagesError, setPagesError] = useState<string>();
  const [pageError, setPageError] = useState<string>();

  useEffect(() => {
    dispatch({ type: "open", id: serviceId });
  }, [dispatch, serviceId]);

  useEffect(() => {
    let active = true;
    setPagesError(undefined);
    getServices()
      .then((all) => {
        if (!active) return;
        setServices(all);
        setService(all.find((candidate) => candidate.id === serviceId));
      })
      .catch(
        (cause) =>
          active &&
          setServiceError(
            cause instanceof Error ? cause.message : "Could not load service.",
          ),
      );
    getServicePages(serviceId)
      .then((response) => {
        if (active) setPaths(response.pages.map((item) => item.path));
      })
      .catch(
        (cause) =>
          active &&
          setPagesError(
            cause instanceof Error ? cause.message : "Could not load pages.",
          ),
      );
    return () => {
      active = false;
    };
  }, [serviceId]);

  const secondary =
    embedded && tabs.split?.rightId === serviceId ? tabs.split : undefined;
  const path =
    secondary?.rightPath ??
    pagePath ??
    (viewId ? `/${decodeURIComponent(viewId)}` : paths[0]);
  const pageSearch = embedded ? (secondary?.rightSearch ?? "") : search;
  const split =
    !embedded && tabs.split?.leftId === serviceId ? tabs.split : undefined;
  const selectPage = (selectedPath: string) => {
    if (embedded) {
      dispatch({
        type: "navigate-secondary",
        id: serviceId,
        path: selectedPath,
        search: "",
      });
      return;
    }
    void navigate({
      to: "/services/$serviceId/$",
      params: { serviceId, _splat: selectedPath.slice(1) },
    });
  };

  useEffect(() => {
    if (!path) return;
    let active = true;
    setPage(undefined);
    setPageError(undefined);
    getPage(serviceId, `${path}${pageSearch}`)
      .then((document) => active && setPage(document))
      .catch(
        (cause) =>
          active &&
          setPageError(
            cause instanceof Error ? cause.message : "Could not load page.",
          ),
      );
    return () => {
      active = false;
    };
  }, [serviceId, path, pageSearch]);

  if (serviceError)
    return (
      <div className={pageClass}>
        <UnavailableState detail={serviceError} />
      </div>
    );

  const contentError = pagesError ?? pageError;

  if (!service)
    return (
      <div className={pageClass}>
        <div className="py-10 text-center font-mono text-[11px] text-muted">
          Loading service…
        </div>
      </div>
    );

  return (
    <AdapterWorkspace
      service={service}
      services={services}
      paths={paths}
      path={path}
      embedded={embedded}
      secondary={
        split ? (
          <ServiceScreen
            key={split.rightId}
            serviceId={split.rightId}
            embedded
          />
        ) : undefined
      }
      onSelectPage={embedded || split ? selectPage : undefined}
    >
      {contentError ? (
        <UnavailableState detail={contentError} />
      ) : page ? (
        <DeclarativePageRenderer
          key={`${serviceId}/${path}${pageSearch}`}
          nodes={page.nodes}
          client={{
            notifyInteraction: (interaction) =>
              window.dispatchEvent(
                new CustomEvent("dsui:interaction", {
                  detail: { ...interaction, serviceId },
                }),
              ),
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
            watchResource: (reference, listener) => {
              let active = true;
              let running = false;
              const refreshMs =
                reference.refresh?.kind === "poll"
                  ? reference.refresh.intervalMs
                  : 1000;
              const run = async () => {
                if (!active || running) return;
                running = true;
                try {
                  listener(
                    (
                      await executeResource(
                        service.id,
                        reference.resourceId,
                        reference.input,
                      )
                    ).data,
                  );
                } finally {
                  running = false;
                }
              };
              void run();
              const timer = window.setInterval(run, refreshMs);
              return () => {
                active = false;
                window.clearInterval(timer);
              };
            },
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
            navigate: (destination) => {
              const [destinationPath = "/", query = ""] = destination.split(
                "?",
                2,
              );
              if (embedded) {
                dispatch({
                  type: "navigate-secondary",
                  id: serviceId,
                  path: destinationPath,
                  search: query ? `?${query}` : "",
                });
                return Promise.resolve();
              }
              return navigate({
                to: "/services/$serviceId/$",
                params: {
                  serviceId: service.id,
                  _splat: decodeURIComponent(destinationPath.slice(1)),
                },
                search: Object.fromEntries(new URLSearchParams(query)),
              });
            },
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
