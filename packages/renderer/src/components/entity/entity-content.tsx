import type { EntityItem, EntityPanel } from "@northgraindata/dsui-core";
import { Button } from "@northgraindata/dsui-ui";
import { useEffect, useRef, useState } from "react";
import { WorkbenchIcon } from "../icons";
import { EntityActionButton } from "./entity-actions";
import { Badge, EntityIcon } from "./entity-display";

export function EntityCode({
  label,
  value,
  language,
}: {
  label: string;
  value: string;
  language?: "sql" | "text";
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setError(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(true);
    }
  };
  const tokens =
    language === "sql"
      ? [
          ...value.matchAll(
            /'[^']*(?:''[^']*)*'|\b(?:SELECT|FROM|INSTALL|LOAD|CREATE|SECRET|TYPE|SET|AS|LIMIT|WHERE)\b|[^'\w]+|\w+|'/gi,
          ),
        ]
      : [];
  return (
    <div className="entity-code">
      <h3>{label}</h3>
      <div className="entity-code-box">
        <pre>
          <code>
            {language === "sql"
              ? tokens.map((match) => (
                  <span
                    key={match.index}
                    className={
                      match[0].startsWith("'")
                        ? "entity-sql-string"
                        : /^(SELECT|FROM|INSTALL|LOAD|CREATE|SECRET|TYPE|SET|AS|LIMIT|WHERE)$/i.test(
                              match[0],
                            )
                          ? "entity-sql-keyword"
                          : undefined
                    }
                  >
                    {match[0]}
                  </span>
                ))
              : value}
          </code>
        </pre>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={`Copy ${label}`}
          onClick={() => void copy()}
        >
          <WorkbenchIcon name={copied ? "check" : "copy"} />
        </Button>
      </div>
      <span className="sr-only" role="status">
        {copied
          ? "Copied to clipboard"
          : error
            ? "Could not copy. Select and copy the code manually."
            : ""}
      </span>
    </div>
  );
}

export function EntityMiniList({ items }: { items: EntityItem[] }) {
  return (
    <ul className="entity-mini-list">
      {items.map((item) => (
        <li key={item.id}>
          <span className="entity-mini-icon">
            <EntityIcon name={item.icon} />
          </span>
          <div>
            <span>{item.title}</span>
            {item.description && <small>{item.description}</small>}
          </div>
          {item.detail && (
            <span className="entity-mini-detail">{item.detail}</span>
          )}
          {item.actions?.slice(0, 1).map((action) => (
            <EntityActionButton key={action.label} action={action} />
          ))}
        </li>
      ))}
    </ul>
  );
}

export function EntityPanelView({ panel }: { panel: EntityPanel }) {
  return (
    <section className="entity-panel">
      <h2>{panel.title}</h2>
      {panel.status && <Badge badge={panel.status} dot />}
      {panel.description && (
        <p className="entity-panel-description">{panel.description}</p>
      )}
      {panel.links && (
        <div className="entity-links">
          {panel.links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
              <EntityIcon name={link.icon ?? "file"} size={18} />
              {link.label}
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      )}
      {panel.facts && (
        <dl className="entity-facts">
          {panel.facts.map((fact) => (
            <div key={fact.label}>
              <span className="entity-fact-icon">
                <EntityIcon name={fact.icon ?? "file"} size={19} />
              </span>
              <div>
                <dt>{fact.label}</dt>
                <dd data-tone={fact.tone}>{fact.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}
      {panel.actions && (
        <div
          className={
            panel.actions.some((action) => action.description)
              ? "entity-action-tiles"
              : "entity-panel-actions"
          }
        >
          {panel.actions.map((action) => (
            <EntityActionButton
              key={action.label}
              action={action}
              tile={Boolean(action.description)}
            />
          ))}
        </div>
      )}
      {panel.code?.map((block) => (
        <EntityCode key={block.label} {...block} />
      ))}
      {panel.items && <EntityMiniList items={panel.items} />}
    </section>
  );
}
