import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getServices, type Service } from "../api";
import { Icon } from "./icon";
import { ServiceMark } from "./service-mark";

export function AdapterTabsMenu({
  services,
  openedIds,
  onOpen,
}: {
  services: Service[];
  openedIds: string[];
  onOpen(id: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(services);
  const [error, setError] = useState<string>();
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const available = connected.filter(
    (service) => !openedIds.includes(service.id),
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    getServices()
      .then((items) => {
        if (active) setConnected(items);
      })
      .catch(() => {
        if (active) setError("Could not load connected adapters.");
      });
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !menu.current?.contains(target) &&
        !button.current?.contains(target)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOnMove = () => setOpen(false);
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnMove);
    document.addEventListener("scroll", closeOnMove, true);
    return () => {
      active = false;
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnMove);
      document.removeEventListener("scroll", closeOnMove, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.bottom + 6,
      right: Math.max(8, innerWidth - rect.right),
    });
    setConnected(services);
    setError(undefined);
    setOpen(true);
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="adapter-tab-add"
        aria-label="Open connected adapter"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Open connected adapter"
        onClick={toggle}
      >
        <Icon name="plus" size={18} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            className="adapter-tabs-menu"
            role="menu"
            aria-label="Connected adapters"
            style={position}
          >
            <div className="adapter-tabs-menu-title">Connected adapters</div>
            {error && <p className="adapter-tabs-menu-message">{error}</p>}
            {!error && available.length === 0 && (
              <p className="adapter-tabs-menu-message">
                All connected adapters are open.
              </p>
            )}
            {available.map((service) => (
              <button
                key={service.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onOpen(service.id);
                }}
              >
                <ServiceMark
                  adapter={service.adapter}
                  logo={service.logo}
                  size={26}
                  variant="bare"
                  fallback="icon"
                />
                <span>{service.name}</span>
              </button>
            ))}
            <Link
              to="/services/new"
              role="menuitem"
              className="adapter-tabs-menu-create"
              onClick={() => setOpen(false)}
            >
              <Icon name="plus" size={16} /> Connect a new adapter
            </Link>
          </div>,
          document.body,
        )}
    </>
  );
}
