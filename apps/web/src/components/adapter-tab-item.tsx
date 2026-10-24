import { Link } from "@tanstack/react-router";
import { type DragEvent, type Ref, useState } from "react";
import type { Service } from "../api";
import { Icon } from "./icon";
import { ServiceMark } from "./service-mark";

export type DropEdge = "before" | "split" | "after";
const dragType = "application/x-dsui-adapter-tab";

function dropEdge(event: DragEvent<HTMLDivElement>): DropEdge {
  const { left, width } = event.currentTarget.getBoundingClientRect();
  const position = (event.clientX - left) / width;
  if (position < 0.25) return "before";
  if (position > 0.75) return "after";
  return "split";
}

export function AdapterTabItem({
  service,
  pairedService,
  active,
  activeRef,
  onSelect,
  onSeparate,
  onClose,
  onDropTab,
}: {
  service: Service;
  pairedService?: Service;
  active: boolean;
  activeRef?: Ref<HTMLDivElement>;
  onSelect(): void;
  onSeparate(): void;
  onClose(): void;
  onDropTab(id: string, targetId: string, edge: DropEdge): void;
}) {
  const [dragging, setDragging] = useState(false);
  const [targetEdge, setTargetEdge] = useState<DropEdge>();
  const pairName = pairedService ? ` and ${pairedService.name}` : "";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Dragging augments the tab link and buttons; navigation and actions remain keyboard accessible.
    <div
      ref={activeRef}
      className="adapter-tab"
      data-active={active}
      data-paired={Boolean(pairedService)}
      data-dragging={dragging}
      data-drop-edge={targetEdge}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(dragType, service.id);
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(event) => {
        if (!Array.from(event.dataTransfer.types).includes(dragType)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setTargetEdge(dropEdge(event));
      }}
      onDragLeave={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setTargetEdge(undefined);
      }}
      onDrop={(event) => {
        const id = event.dataTransfer.getData(dragType);
        if (!id) return;
        event.preventDefault();
        setTargetEdge(undefined);
        if (id !== service.id) onDropTab(id, service.id, dropEdge(event));
      }}
    >
      <Link
        to="/services/$serviceId"
        params={{ serviceId: service.id }}
        aria-current={active ? "page" : undefined}
        title={`${service.name}${pairedService ? ` + ${pairedService.name}` : ""} · Drag to an edge to reorder or onto another tab's center to split`}
        onClick={onSelect}
      >
        <ServiceMark
          adapter={service.adapter}
          logo={service.logo}
          size={26}
          variant="bare"
          fallback="icon"
        />
        <span className="adapter-tab-name">{service.name}</span>
        {pairedService && (
          <>
            <span className="adapter-tab-pair-divider" aria-hidden="true">
              +
            </span>
            <ServiceMark
              adapter={pairedService.adapter}
              logo={pairedService.logo}
              size={26}
              variant="bare"
              fallback="icon"
            />
            <span className="adapter-tab-name">{pairedService.name}</span>
          </>
        )}
      </Link>
      {pairedService && (
        <button
          type="button"
          className="adapter-tab-separate"
          aria-label={`Separate ${service.name} and ${pairedService.name} tabs`}
          title="Separate tabs"
          onClick={onSeparate}
        >
          <Icon name="grid" size={14} />
        </button>
      )}
      <button
        type="button"
        className="adapter-tab-close"
        aria-label={`Close ${service.name}${pairName} tab`}
        title={`Close ${service.name}${pairName} tab`}
        onClick={onClose}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
