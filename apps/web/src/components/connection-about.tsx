import type { Adapter } from "../api";
import { Icon } from "./icon";

/** Connection help uses the same author-declared content as the catalog. */
export function ConnectionAbout({ adapter }: { adapter: Adapter }) {
  const features = adapter.presentation?.features?.slice(0, 3) ?? [];
  const guide = adapter.presentation?.links?.[0];
  return (
    <aside className="connection-about" aria-label={`About ${adapter.name}`}>
      <h3>About {adapter.name}</h3>
      {adapter.description && <p>{adapter.description}</p>}
      {!!features.length && (
        <ul>
          {features.map((feature) => (
            <li key={feature.title}>
              <span className="connection-feature-icon">
                <Icon name="check" size={18} />
              </span>
              <div>
                <h4>{feature.title}</h4>
                {feature.description && <p>{feature.description}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {guide && (
        <a
          className="connection-learn"
          href={guide.href}
          target="_blank"
          rel="noreferrer noopener"
        >
          <span>
            Documentation<strong>{guide.label} ↗</strong>
          </span>
          <span aria-hidden="true">↗</span>
        </a>
      )}
    </aside>
  );
}
