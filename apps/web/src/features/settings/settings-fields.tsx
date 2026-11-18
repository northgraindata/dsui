import type { ReactNode } from "react";

export function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-panel">
      <header className="settings-panel-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}
export function SettingsRow({
  id,
  label,
  description,
  source,
  children,
}: {
  id: string;
  label: string;
  description?: string;
  source?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div>
        <label htmlFor={id}>{label}</label>
        {description && <p>{description}</p>}
      </div>
      <div className="settings-control">
        {children}
        {source && <span className="settings-source">{source}</span>}
      </div>
    </div>
  );
}
export function TimeZoneInput({
  id,
  value,
  onChange,
  disabled,
  inherit,
}: {
  id: string;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  inherit?: boolean;
}) {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [
          "Europe/Warsaw",
          "Europe/London",
          "America/New_York",
          "America/Los_Angeles",
          "Asia/Tokyo",
          "Asia/Singapore",
          "Australia/Sydney",
        ];
  const named = [
    ...new Set([
      "UTC",
      ...zones,
      ...(value !== "inherit" && value !== "browser" ? [value] : []),
    ]),
  ];
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      {inherit && <option value="inherit">Use workspace default</option>}
      <option value="browser">Use device time zone</option>
      {named.map((zone) => (
        <option key={zone} value={zone}>
          {zone.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
