import type {
  PageDocument,
  PluginCatalog,
} from "@northgraindata/dsui-plugin-sdk";
import { DeclarativePageRenderer } from "@northgraindata/dsui-renderer";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { currentPrincipal, getPluginCatalog, getPluginPage } from "../../api";
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
  const pageId = useParams({
    from: "/plugins/$pluginId/$",
    select: (params) => params._splat,
  });
  const [page, setPage] = useState<PluginCatalog["pages"][number]>();
  const [document, setDocument] = useState<PageDocument>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setPage(undefined);
    setDocument(undefined);
    setError(undefined);
    getPluginCatalog()
      .then(async (catalog) => {
        if (!active) return;
        const found = catalog.pages.find(
          (candidate) =>
            candidate.pluginId === pluginId && candidate.id === pageId,
        );
        if (!found) {
          const principal = await currentPrincipal().catch(() => undefined);
          const signInPage = catalog.pages.find(
            (candidate) => candidate.public && candidate.shell === "bare",
          );
          if (!principal && signInPage) {
            navigate({
              to: "/plugins/$pluginId/$",
              params: {
                pluginId: signInPage.pluginId,
                _splat: signInPage.id,
              },
            });
            return;
          }
          setError("Plugin page not found or plugin is disabled.");
          return;
        }
        setPage(found);
        const pageDocument = await getPluginPage(pluginId, found.id);
        if (!active) return;
        setDocument(pageDocument);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load plugin page.",
        );
      });
    return () => {
      active = false;
    };
  }, [pageId, pluginId]);

  if (error)
    return (
      <div className={pageClass}>
        <UnavailableState detail={error} />
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
              to: "/plugins/$pluginId/$",
              params: {
                pluginId,
                _splat: path.replace(/^\/+/, ""),
              },
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
              to: "/plugins/$pluginId/$",
              params: {
                pluginId,
                _splat: path.replace(/^\/+/, ""),
              },
            }),
          )}
        />
      </PluginErrorBoundary>
    </div>
  );
}
