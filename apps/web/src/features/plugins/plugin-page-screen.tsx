import type { PluginCatalog } from "@northgraindata/dsui-plugin-sdk";
import { useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPluginCatalog } from "../../api";
import {
  PageHeading,
  pageClass,
  UnavailableState,
} from "../../components/page";

export function PluginPageScreen() {
  const { pluginId } = useParams({ from: "/plugins/$pluginId/$" });
  const pageId = useParams({
    from: "/plugins/$pluginId/$",
    select: (params) => params._splat,
  });
  const [page, setPage] = useState<PluginCatalog["pages"][number]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setPage(undefined);
    setError(undefined);
    getPluginCatalog()
      .then((catalog) => {
        if (!active) return;
        const found = catalog.pages.find(
          (candidate) =>
            candidate.pluginId === pluginId && candidate.id === pageId,
        );
        if (!found) {
          setError("Plugin page not found or plugin is disabled.");
          return;
        }
        setPage(found);
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

  if (!page)
    return (
      <div className={pageClass}>
        <p role="status" className="py-10 text-center text-[12px] text-muted">
          Loading plugin page…
        </p>
      </div>
    );

  return (
    <div className={pageClass}>
      <PageHeading title={page.title} detail={page.description} />
    </div>
  );
}
