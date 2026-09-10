import type { ActionReference } from "./page-document";

export type EntityTone =
  | "healthy"
  | "warning"
  | "unavailable"
  | "info"
  | "muted";
export interface EntityBadge {
  label: string;
  tone?: EntityTone;
}
export interface EntityAction {
  label: string;
  icon?: string;
  description?: string;
  action?: ActionReference;
  link?: string;
  tab?: string;
  disabledReason?: string;
  primary?: boolean;
  confirmation?: { title: string; description: string; confirmLabel: string };
}
export interface EntityLink {
  label: string;
  url: string;
  icon?: string;
}
export interface EntityFact {
  label: string;
  value: string;
  icon?: string;
  tone?: EntityTone;
}
export interface EntityItem {
  id: string;
  title: string;
  description: string;
  detail?: string;
  icon?: string;
  badge?: EntityBadge;
  category?: string;
  categoryColor?: "blue" | "cyan" | "amber" | "violet";
  status?: EntityBadge;
  version?: string;
  link?: string;
  actions?: EntityAction[];
  attributes?: Record<string, string | boolean>;
}
/** Composable content shared by detail panels, independent of provider semantics. */
export interface EntityPanel {
  title: string;
  description?: string;
  status?: EntityBadge;
  links?: EntityLink[];
  facts?: EntityFact[];
  actions?: EntityAction[];
  code?: { label: string; value: string; language?: "sql" | "text" }[];
  items?: EntityItem[];
}
export interface EntityDetail {
  title: string;
  description: string;
  icon?: string;
  status?: EntityBadge;
  tags?: string[];
  version?: string;
  breadcrumbs?: { label: string; path?: string }[];
  actions?: EntityAction[];
  tabs: {
    id: string;
    label: string;
    panels: EntityPanel[];
    aside?: EntityPanel[];
  }[];
}
export interface CatalogFilter {
  label: string;
  field?: string;
  equals?: string | boolean;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an entity record");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected entity text");
  return value;
}
function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : string(value);
}
function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > 1000)
    throw new Error("Expected a bounded entity list");
  return value.map(parse);
}
function optionalArray<T>(
  value: unknown,
  parse: (item: unknown) => T,
): T[] | undefined {
  return value === undefined ? undefined : array(value, parse);
}
function path(value: unknown): string | undefined {
  const text = optionalString(value);
  if (text !== undefined && (!text.startsWith("/") || text.startsWith("//")))
    throw new Error("Expected an adapter page path");
  return text;
}
function tone(value: unknown): EntityTone | undefined {
  if (value === undefined) return undefined;
  if (
    value === "healthy" ||
    value === "warning" ||
    value === "unavailable" ||
    value === "info" ||
    value === "muted"
  )
    return value;
  throw new Error("Unknown entity tone");
}
function badge(value: unknown): EntityBadge | undefined {
  if (value === undefined) return undefined;
  const item = record(value);
  return { label: string(item.label), tone: tone(item.tone) };
}
function action(value: unknown): EntityAction {
  const item = record(value);
  let reference: ActionReference | undefined;
  if (item.action !== undefined) {
    const target = record(item.action);
    reference = { actionId: string(target.actionId), input: target.input };
    if (!reference.actionId) throw new Error("An action ID is required");
  }
  const link = path(item.link);
  const tab = optionalString(item.tab);
  const disabledReason = optionalString(item.disabledReason);
  if ([reference, link, tab].filter((value) => value !== undefined).length > 1)
    throw new Error("An entity action must have one target");
  if (!reference && !link && !tab && !disabledReason)
    throw new Error("An entity action requires a target or disabled reason");
  if (item.primary !== undefined && typeof item.primary !== "boolean")
    throw new Error("Invalid primary action flag");
  let confirmation: EntityAction["confirmation"];
  if (item.confirmation !== undefined) {
    const confirm = record(item.confirmation);
    confirmation = {
      title: string(confirm.title),
      description: string(confirm.description),
      confirmLabel: string(confirm.confirmLabel),
    };
  }
  return {
    label: string(item.label),
    icon: optionalString(item.icon),
    description: optionalString(item.description),
    action: reference,
    link,
    tab,
    disabledReason,
    primary: item.primary,
    confirmation,
  };
}
function entity(value: unknown): EntityItem {
  const item = record(value);
  if (
    item.categoryColor !== undefined &&
    item.categoryColor !== "blue" &&
    item.categoryColor !== "cyan" &&
    item.categoryColor !== "amber" &&
    item.categoryColor !== "violet"
  )
    throw new Error("Unknown category color");
  let attributes: EntityItem["attributes"];
  if (item.attributes !== undefined) {
    attributes = {};
    for (const [key, value] of Object.entries(record(item.attributes))) {
      if (typeof value !== "string" && typeof value !== "boolean")
        throw new Error("Invalid entity attribute");
      attributes[key] = value;
    }
  }
  const id = string(item.id);
  if (!id) throw new Error("An entity ID is required");
  return {
    id,
    title: string(item.title),
    description: string(item.description),
    detail: optionalString(item.detail),
    icon: optionalString(item.icon),
    badge: badge(item.badge),
    category: optionalString(item.category),
    categoryColor: item.categoryColor,
    status: badge(item.status),
    version: optionalString(item.version),
    link: path(item.link),
    actions: optionalArray(item.actions, action),
    attributes,
  };
}
function panel(value: unknown): EntityPanel {
  const item = record(value);
  return {
    title: string(item.title),
    description: optionalString(item.description),
    status: badge(item.status),
    actions: optionalArray(item.actions, action),
    items: optionalArray(item.items, entity),
    links: optionalArray(item.links, (value) => {
      const link = record(value);
      const url = string(link.url);
      if (!/^https?:\/\//i.test(url))
        throw new Error("Entity links must use HTTP or HTTPS");
      return {
        label: string(link.label),
        url,
        icon: optionalString(link.icon),
      };
    }),
    facts: optionalArray(item.facts, (value) => {
      const fact = record(value);
      return {
        label: string(fact.label),
        value: string(fact.value),
        icon: optionalString(fact.icon),
        tone: tone(fact.tone),
      };
    }),
    code: optionalArray(item.code, (value) => {
      const block = record(value);
      if (
        block.language !== undefined &&
        block.language !== "sql" &&
        block.language !== "text"
      )
        throw new Error("Unknown code language");
      return {
        label: string(block.label),
        value: string(block.value),
        language: block.language,
      };
    }),
  };
}

export function parseEntityCatalog(value: unknown): EntityItem[] {
  const items = array(value, entity);
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new Error("Duplicate entity IDs");
  return items;
}
export function parseEntityDetail(value: unknown): EntityDetail {
  const detail = record(value);
  const tabs = array(detail.tabs, (value) => {
    const tab = record(value);
    return {
      id: string(tab.id),
      label: string(tab.label),
      panels: array(tab.panels, panel),
      aside: optionalArray(tab.aside, panel),
    };
  });
  if (
    !tabs.length ||
    tabs.some((tab) => !tab.id) ||
    new Set(tabs.map((tab) => tab.id)).size !== tabs.length
  )
    throw new Error("Detail tabs require unique IDs");
  return {
    title: string(detail.title),
    description: string(detail.description),
    icon: optionalString(detail.icon),
    status: badge(detail.status),
    tags: optionalArray(detail.tags, string),
    version: optionalString(detail.version),
    actions: optionalArray(detail.actions, action),
    tabs,
    breadcrumbs: optionalArray(detail.breadcrumbs, (value) => {
      const crumb = record(value);
      return { label: string(crumb.label), path: path(crumb.path) };
    }),
  };
}
