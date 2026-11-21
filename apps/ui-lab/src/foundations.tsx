import { useEffect, useState } from "react";
import tokenCss from "../../../packages/ui/src/styles.css?raw";
import type { CatalogEntry } from "./catalog-types";

export const colorTokens = [
  ...tokenCss.matchAll(/--(color-[\w-]+):\s*([^;]+);/g),
].map((match) => ({ name: `--${match[1]}`, fallback: match[2].trim() }));
function Colors() {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    setValues(
      Object.fromEntries(
        colorTokens.map((token) => [
          token.name,
          styles.getPropertyValue(token.name).trim(),
        ]),
      ),
    );
  }, []);
  return (
    <div className="lab-token-grid">
      {colorTokens.map((token) => (
        <div className="lab-token" key={token.name}>
          <div
            className="lab-swatch"
            style={{ background: `var(${token.name})` }}
          />
          <code>{token.name}</code>
          <span>{values[token.name] || token.fallback}</span>
        </div>
      ))}
    </div>
  );
}
function Typography() {
  return (
    <div className="lab-type-list">
      {[
        {
          name: "UI · --font-ui",
          font: "var(--font-ui)",
          size: 13,
          text: "The quick brown fox · Production warehouse",
        },
        {
          name: "Mono · --font-mono",
          font: "var(--font-mono)",
          size: 13,
          text: "SELECT revenue FROM analytics.orders;",
        },
        {
          name: "Heading convention · 26px",
          font: "var(--font-ui)",
          size: 26,
          text: "Analytics warehouse",
        },
        {
          name: "Section convention · 17px",
          font: "var(--font-ui)",
          size: 17,
          text: "Resource history",
        },
        {
          name: "Body convention · 13px",
          font: "var(--font-ui)",
          size: 13,
          text: "Monitor services and explore your data.",
        },
        {
          name: "Label convention · 11px",
          font: "var(--font-ui)",
          size: 11,
          text: "Updated 2 minutes ago",
        },
      ].map((item) => (
        <div key={item.name}>
          <code>{item.name}</code>
          <p style={{ fontFamily: item.font, fontSize: item.size }}>
            {item.text}
          </p>
        </div>
      ))}
    </div>
  );
}
function Geometry() {
  return (
    <div className="lab-geometry">
      <p>These are current conventions, not additional CSS tokens.</p>
      <h3>Layout gaps</h3>
      {[
        { name: "none", value: 0 },
        { name: "sm", value: 8 },
        { name: "md", value: 16 },
        { name: "lg", value: 24 },
      ].map((gap) => (
        <div key={gap.name} className="lab-gap-row">
          <code>
            {gap.name} · {gap.value}px
          </code>
          <div style={{ display: "flex", gap: gap.value }}>
            <i />
            <i />
            <i />
          </div>
        </div>
      ))}
      <h3>Shared control tokens</h3>
      <div className="lab-radius-row">
        <div
          style={{
            minHeight: "var(--spacing-control)",
            borderRadius: "var(--radius-control)",
          }}
        >
          36px height · 8px radius
        </div>
        <div
          style={{
            fontSize: "var(--text-metric)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          26<span style={{ fontSize: 11 }}>px metric</span>
        </div>
      </div>
      <p>
        <code>--spacing-control</code> · <code>--radius-control</code> ·{" "}
        <code>--text-metric</code>
      </p>
      <h3>Border radius</h3>
      <div className="lab-radius-row">
        {[0, 6, 8, 12].map((radius) => (
          <div key={radius} style={{ borderRadius: radius }}>
            {radius}px
          </div>
        ))}
      </div>
      <h3>Surfaces</h3>
      <div className="lab-radius-row">
        {[
          "canvas",
          "background",
          "surface",
          "surface-raised",
          "surface-hover",
        ].map((name) => (
          <div key={name} style={{ background: `var(--color-${name})` }}>
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}
export const foundations: CatalogEntry[] = [
  {
    id: "foundations/colors",
    title: "Colors",
    description:
      "Production semantic tokens, read directly from packages/ui/src/styles.css and resolved in the browser.",
    source: "packages/ui/src/styles.css",
    render: Colors,
  },
  {
    id: "foundations/typography",
    title: "Typography",
    description:
      "Font tokens and the current type conventions. System fonts are used when Inter or JetBrains Mono are not installed.",
    source: "packages/ui/src/styles.css",
    render: Typography,
  },
  {
    id: "foundations/geometry",
    title: "Spacing & surfaces",
    description:
      "Existing layout gaps, radius conventions and surface hierarchy.",
    source: "packages/renderer/src/styles.css",
    render: Geometry,
  },
].map(({ render: View, ...entry }) => ({
  ...entry,
  group: "Foundations",
  examples: [{ id: "all", title: "Overview", render: () => <View /> }],
}));
