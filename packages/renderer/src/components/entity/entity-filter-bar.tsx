import type { CatalogFilter } from "@northgraindata/dsui-core";
import { type KeyboardEvent, useId } from "react";
import { WorkbenchIcon } from "../icons";

export function EntityFilterBar({
  id: idPrefix,
  filters,
  selected,
  onSelect,
  search,
  onSearch,
  searchPlaceholder,
  category,
  categories,
  onCategory,
}: {
  id?: string;
  filters: readonly CatalogFilter[];
  selected: number;
  onSelect: (index: number) => void;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  category: string;
  categories: readonly string[];
  onCategory: (value: string) => void;
}) {
  const generatedId = useId();
  const id = idPrefix ?? generatedId;
  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % filters.length
        : event.key === "ArrowLeft"
          ? (index + filters.length - 1) % filters.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? filters.length - 1
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onSelect(next);
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]',
      );
    buttons?.[next]?.focus();
  };
  return (
    <div className="entity-catalog-toolbar">
      <div className="entity-tabs" role="tablist" aria-label="Catalog filters">
        {filters.map((filter, index) => (
          <button
            type="button"
            key={filter.label}
            role="tab"
            id={`${id}-filter-${index}`}
            aria-controls={`${id}-results`}
            tabIndex={selected === index ? 0 : -1}
            aria-selected={selected === index}
            onClick={() => onSelect(index)}
            onKeyDown={(event) => moveTab(event, index)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="entity-filter-controls">
        <label className="entity-search">
          <WorkbenchIcon name="search" />
          <input
            aria-label={searchPlaceholder ?? "Search catalog"}
            placeholder={searchPlaceholder ?? "Search catalog…"}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
        <select
          aria-label="Category"
          value={category}
          onChange={(event) => onCategory(event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
