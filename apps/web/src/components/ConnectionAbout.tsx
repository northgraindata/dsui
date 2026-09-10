import type { Adapter } from "../api";
import { Icon } from "./Icon";

// Editorial product information only. Connection behavior and fields always
// come from the adapter's public schema, never from this presentation copy.
const duckdbFeatures = [
  {
    icon: "activity",
    title: "Local analytics",
    detail: "Query data directly on your machine",
  },
  {
    icon: "file",
    title: "Supports multiple file formats",
    detail: "Parquet, CSV, JSON, and more",
  },
  {
    icon: "database",
    title: "No server required",
    detail: "Just a single file",
  },
  {
    icon: "terminal",
    title: "Great for development",
    detail: "Fast and lightweight",
  },
];

export function ConnectionAbout({ adapter }: { adapter: Adapter }) {
  const isDuckDb = adapter.id === "duckdb";
  const features = isDuckDb
    ? duckdbFeatures
    : [
        {
          icon: "plug",
          title: "One connected workspace",
          detail: "Work with your data stack in dsui",
        },
        {
          icon: "check",
          title: "Test before connecting",
          detail: "Verify your connection settings",
        },
        {
          icon: "gear",
          title: "Your configuration",
          detail: "Manage your connection in one place",
        },
      ];
  return (
    <aside className="connection-about" aria-label={`About ${adapter.name}`}>
      <h3>About {adapter.name}</h3>
      <p>
        {isDuckDb
          ? "DuckDB is an embeddable analytical database that runs directly on your machine. It’s fast, easy to use, and perfect for local analytics."
          : adapter.description}
      </p>
      <ul>
        {features.map((feature) => (
          <li key={feature.title}>
            <span className="connection-feature-icon">
              <Icon name={feature.icon} size={20} />
            </span>
            <div>
              <h4>{feature.title}</h4>
              <p>{feature.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {isDuckDb && (
        <a
          className="connection-learn"
          href="https://duckdb.org/docs/"
          target="_blank"
          rel="noreferrer"
        >
          <span>
            Learn more<strong>DuckDB documentation ↗</strong>
          </span>
          <span aria-hidden="true">↗</span>
        </a>
      )}
    </aside>
  );
}
