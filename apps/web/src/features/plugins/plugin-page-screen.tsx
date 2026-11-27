import {
  type PageDocument,
  type PluginCatalog,
  resolvePluginPage,
} from "@northgraindata/dsui-plugin-sdk";
import { DeclarativePageRenderer } from "@northgraindata/dsui-renderer";
import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ApiError,
  currentPrincipal,
  getPluginCatalog,
  getPluginPage,
} from "../../api";
import {
  PageHeading,
  pageClass,
  UnavailableState,
} from "../../components/page";
import { pluginRendererClient } from "./plugin-client";
import { PluginErrorBoundary } from "./plugin-error-boundary";

export function PluginPageScreen() {
  const navigate = useNavigate();
  const { pluginId } = useParams({ from: "/plugins/$pluginId/$" });
  const pageId = useLocation({
    select: (location) => location.pathname.split("/").slice(3).join("/"),
  });
  const [page, setPage] = useState<PluginCatalog["pages"][number]>();
  const [document, setDocument] = useState<PageDocument>();
  const [backPage, setBackPage] = useState<{ pageId: string; label: string }>();
  const [error, setError] = useState<{ message: string; status?: number }>();

  useEffect(() => {
    let active = true;
    setPage(undefined);
    setDocument(undefined);
    setError(undefined);
    setBackPage(undefined);
    getPluginCatalog()
      .then(async (catalog) => {
        if (!active) return;
        setBackPage(
          catalog.navigation.find(
            (item) => item.pluginId === pluginId && item.area === "primary",
          ),
        );
        const found = resolvePluginPage(
          catalog.pages.filter((candidate) => candidate.pluginId === pluginId),
          pageId,
        );
        if (!found) {
          const principal = await currentPrincipal().catch(() => undefined);
          const signInPage = catalog.pages.find(
            (candidate) => candidate.public && candidate.shell === "bare",
          );
          if (!principal && signInPage) {
            await navigate({
              to: "/plugins/$pluginId/$",
              params: {
                pluginId: signInPage.pluginId,
                _splat: signInPage.id,
              },
            });
            return;
          }
          setError({
            message: "Plugin page not found or plugin is disabled.",
            status: 404,
          });
          return;
        }
        setPage(found);
        const pageDocument = await getPluginPage(pluginId, pageId ?? found.id);
        if (!active) return;
        setDocument(pageDocument);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError({
          message:
            cause instanceof Error
              ? cause.message
              : "Could not load plugin page.",
          ...(cause instanceof ApiError ? { status: cause.status } : {}),
        });
      });
    return () => {
      active = false;
    };
  }, [pageId, pluginId, navigate]);

  if (error?.status === 404 && backPage && backPage.pageId !== pageId)
    return (
      <div className={pageClass}>
        <PageHeading title="Plugin page unavailable" detail={error.message} />
        <button
          type="button"
          className="text-accent"
          onClick={() =>
            navigate({
              to: "/plugins/$pluginId/$",
              params: { pluginId, _splat: backPage.pageId },
            })
          }
        >
          Back to {backPage.label}
        </button>
      </div>
    );

  if (error)
    return (
      <div className={pageClass}>
        <UnavailableState detail={error.message} />
      </div>
    );

  if (page?.shell === "bare" && !document)
    return (
      <div
        className="grid min-h-screen place-items-center bg-background px-4 text-[12px] text-muted"
        role="status"
      >
        Loading page…
      </div>
    );

  if (!page || !document)
    return (
      <div className={pageClass}>
        <p role="status" className="py-10 text-center text-[12px] text-muted">
          Loading plugin page…
        </p>
      </div>
    );

  if (page.shell === "bare")
    return (
      <PluginErrorBoundary key={`${pluginId}/${pageId}`}>
        <DeclarativePageRenderer
          nodes={document.nodes}
          client={pluginRendererClient(pluginId, (path) =>
            navigate({
              href: `/plugins/${encodeURIComponent(pluginId)}/${path.replace(/^\/+/, "")}`,
            }),
          )}
        />
      </PluginErrorBoundary>
    );

  return (
    <div className={pageClass}>
      <PageHeading title={page.title} detail={page.description} />
      <PluginErrorBoundary key={`${pluginId}/${pageId}`}>
        <DeclarativePageRenderer
          nodes={document.nodes}
          client={pluginRendererClient(pluginId, (path) =>
            navigate({
              href: `/plugins/${encodeURIComponent(pluginId)}/${path.replace(/^\/+/, "")}`,
            }),
          )}
        />
      </PluginErrorBoundary>
    </div>
  );
}
