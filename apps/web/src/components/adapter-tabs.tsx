import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import type { Service } from "../api";
import { useAdapterTabs } from "../features/adapter-workspace/adapter-tabs-context";
import { visibleAdapterTabs } from "../features/adapter-workspace/adapter-tabs-state";
import { AdapterTabItem, type DropEdge } from "./adapter-tab-item";
import { AdapterTabsMenu } from "./adapter-tabs-menu";

export function AdapterTabs({
  services,
  activeServiceId,
}: {
  services: Service[];
  activeServiceId: string;
}) {
  const navigate = useNavigate();
  const { state, dispatch } = useAdapterTabs();
  const activeTab = useRef<HTMLDivElement>(null);
  const byId = new Map(services.map((service) => [service.id, service]));
  const opened = visibleAdapterTabs(state).flatMap((tab) => {
    const service = byId.get(tab.kind === "split" ? tab.leftId : tab.id);
    const pairedService =
      tab.kind === "split" ? byId.get(tab.rightId) : undefined;
    return service ? [{ service, pairedService }] : [];
  });

  useEffect(() => {
    if (state.openedIds.includes(activeServiceId))
      activeTab.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
  }, [activeServiceId, state.openedIds]);

  const close = (id: string, pairedId?: string) => {
    const index = state.openedIds.indexOf(id);
    const remaining = state.openedIds.filter(
      (openedId) => openedId !== id && openedId !== pairedId,
    );
    dispatch(pairedId ? { type: "close-split" } : { type: "close", id });
    if (id !== activeServiceId && pairedId !== activeServiceId) return;
    const nextId = remaining[Math.min(index, remaining.length - 1)];
    if (nextId) {
      void navigate({
        to: "/services/$serviceId",
        params: { serviceId: nextId },
      });
    } else {
      void navigate({ to: "/" });
    }
  };

  const drop = (id: string, targetId: string, edge: DropEdge) => {
    if (edge === "split") {
      dispatch({ type: "split", id, targetId });
      void navigate({
        to: "/services/$serviceId",
        params: { serviceId: targetId },
      });
    } else {
      dispatch({ type: "move", id, targetId, edge });
    }
  };

  const open = (id: string) => {
    dispatch({ type: "unsplit" });
    dispatch({ type: "open", id });
    void navigate({ to: "/services/$serviceId", params: { serviceId: id } });
  };

  return (
    <nav className="adapter-tabs" aria-label="Open adapter tabs">
      <div className="adapter-tabs-list">
        {opened.map(({ service, pairedService }) => (
          <AdapterTabItem
            key={service.id}
            service={service}
            pairedService={pairedService}
            active={service.id === activeServiceId}
            activeRef={service.id === activeServiceId ? activeTab : undefined}
            onSelect={() => {
              if (state.split && state.split.leftId !== service.id)
                dispatch({ type: "unsplit" });
            }}
            onSeparate={() => dispatch({ type: "unsplit" })}
            onClose={() => close(service.id, pairedService?.id)}
            onDropTab={drop}
          />
        ))}
        <AdapterTabsMenu
          services={services}
          openedIds={state.openedIds}
          onOpen={open}
        />
      </div>
    </nav>
  );
}
