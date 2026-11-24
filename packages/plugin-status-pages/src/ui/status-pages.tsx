import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import {
  type ComponentStatusView,
  type NoticeView,
  type StatusComponentView,
  type StatusPageDetail,
  servicesSchema,
  statusPageDetailSchema,
  statusPageListSchema,
} from "../contract";
import { React } from "../react";
import { styles } from "../styles";
import { ago, dateTime, pagePath, percent } from "./format";
import { useAction, useNow, useResource } from "./hooks";
import { Empty, Notice, PageLink } from "./parts";
import { statusStyles } from "./status-styles";

type Client = ComponentProps["client"];
type Impact = Exclude<ComponentStatusView, "unknown">;
type NoticeStatus = NoticeView["status"];

export const componentLabel: Record<ComponentStatusView, string> = {
  operational: "Operational",
  maintenance: "Under maintenance",
  degraded: "Degraded performance",
  "partial-outage": "Partial outage",
  "major-outage": "Major outage",
  unknown: "No data yet",
};

const headline: Record<ComponentStatusView, string> = {
  operational: "All systems operational",
  maintenance: "Scheduled maintenance in progress",
  degraded: "Some systems are degraded",
  "partial-outage": "Partial outage",
  "major-outage": "Major outage",
  unknown: "Waiting for the first checks",
};

const noticeStatusLabel: Record<NoticeStatus, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

const IMPACTS: readonly Impact[] = [
  "degraded",
  "partial-outage",
  "major-outage",
  "maintenance",
  "operational",
];

function StatusDot({ status }: { status: ComponentStatusView }) {
  return <i className="sp-dot" data-status={status} aria-hidden="true" />;
}

function StatusText({ status }: { status: ComponentStatusView }) {
  return (
    <span className="sp-status" data-status={status}>
      <StatusDot status={status} />
      {componentLabel[status]}
    </span>
  );
}

/* ------------------------------------------------------------------ list */

export function StatusPagesPage({ client }: ComponentProps) {
  const { useState } = React;
  const list = useResource(client, "status-pages", {}, statusPageListSchema);
  const [creating, setCreating] = useState(false);
  const data = list.data;

  return (
    <div className="h-page sp-page">
      <style>{styles}</style>
      <style>{statusStyles}</style>

      {list.error && <Notice tone="error">{list.error}</Notice>}
      {data?.healthError && <Notice tone="error">{data.healthError}</Notice>}
      {data && !data.healthAvailable && !data.healthError && (
        <p className="h-muted">
          Enable Service health for automatic status and uptime. You can publish
          notices without it.
        </p>
      )}

      {creating && (
        <PageEditor
          client={client}
          onCancel={() => setCreating(false)}
          onSaved={(slug) => client.navigate(pagePath.statusPage(slug))}
        />
      )}

      {data && !creating && (
        <ul className="sp-cards">
          {data.items.map((page) => (
            <li key={page.id}>
              <PageLink
                client={client}
                to={pagePath.statusPage(page.slug)}
                className="sp-card"
              >
                <strong>{page.name}</strong>
                <span className="sp-card-description">
                  {page.description ?? `/${page.slug}`}
                </span>
                <span className="sp-card-foot">
                  <StatusText status={page.status} />
                  <span>
                    {page.components}{" "}
                    {page.components === 1 ? "component" : "components"}
                    {page.activeNotices > 0
                      ? ` · ${page.activeNotices} ${page.activeNotices === 1 ? "notice" : "notices"}`
                      : ""}
                  </span>
                </span>
              </PageLink>
            </li>
          ))}
          {data.canCreate && (
            <li>
              <button
                type="button"
                className="sp-card sp-card-new"
                onClick={() => setCreating(true)}
              >
                <span aria-hidden="true">+</span>
                <strong>New status page</strong>
                <span className="sp-card-description">
                  Pick the services a team relies on
                </span>
              </button>
            </li>
          )}
        </ul>
      )}

      {data && data.items.length === 0 && !data.canCreate && (
        <Empty>No status pages you can see yet.</Empty>
      )}

      {!data && !list.error && (
        <ul className="sp-cards" aria-busy="true">
          {[0, 1, 2].map((key) => (
            <li key={key}>
              <div className="sp-card">
                <span className="h-skeleton" />
                <span className="h-skeleton" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- detail */

export function StatusPageView({ client, node }: ComponentProps) {
  const { useState } = React;
  const props = (node.kind === "custom" ? node.props.props : undefined) as
    | { slug?: string }
    | undefined;
  const slug = props?.slug ?? "";
  const detail = useResource(
    client,
    "status-page",
    { slug },
    statusPageDetailSchema,
  );
  const now = useNow();
  const [mode, setMode] = useState<"view" | "edit" | "notice">("view");
  const data = detail.data;

  return (
    <div className="h-page sp-page">
      <style>{styles}</style>
      <style>{statusStyles}</style>

      <PageLink client={client} to={pagePath.statusPages} className="sp-back">
        <span aria-hidden="true">←</span> All status pages
      </PageLink>

      {detail.error && <Notice tone="error">{detail.error}</Notice>}
      {data?.healthError && <Notice tone="error">{data.healthError}</Notice>}
      {data && !data.healthAvailable && !data.healthError && (
        <p className="h-muted">
          Enable Service health for automatic status and uptime. You can publish
          notices without it.
        </p>
      )}
      {!data && !detail.error && <PageSkeleton />}

      {data && mode === "edit" && (
        <PageEditor
          client={client}
          page={data}
          onCancel={() => setMode("view")}
          onSaved={(next) => {
            setMode("view");
            if (next === data.page.slug) detail.reload();
            else client.navigate(pagePath.statusPage(next));
          }}
          onDeleted={() => client.navigate(pagePath.statusPages)}
        />
      )}

      {data && mode !== "edit" && (
        <>
          <header className="sp-hero" data-status={data.status}>
            <div className="sp-hero-main">
              <span className="sp-status" data-status={data.status}>
                <StatusDot status={data.status} />
                {headline[data.status]}
              </span>
              <h2>{data.page.name}</h2>
              {data.page.description && <p>{data.page.description}</p>}
            </div>
            <div className="sp-hero-side">
              <div className="sp-actions">
                {data.can.edit && (
                  <button
                    type="button"
                    className="h-button"
                    onClick={() => setMode("edit")}
                  >
                    Edit
                  </button>
                )}
                {data.can.post && (
                  <button
                    type="button"
                    className="h-button"
                    data-variant="primary"
                    disabled={mode === "notice"}
                    onClick={() => setMode("notice")}
                  >
                    Post notice
                  </button>
                )}
              </div>
              <span className="sp-hero-meta">
                Updated {ago(data.generatedAt, now)}
              </span>
            </div>
          </header>

          {mode === "notice" && (
            <NoticeForm
              client={client}
              page={data}
              onDone={() => {
                setMode("view");
                detail.reload();
              }}
            />
          )}

          {data.active.length > 0 && (
            <section className="sp-block" aria-labelledby="sp-active">
              <h3 className="sp-label" id="sp-active">
                Active notices
              </h3>
              {data.active.map((notice) => (
                <NoticeCard
                  key={notice.id}
                  client={client}
                  notice={notice}
                  components={data.components}
                  canPost={data.can.post}
                  onChange={detail.reload}
                />
              ))}
            </section>
          )}

          <section className="sp-block" aria-labelledby="sp-components">
            <h3 className="sp-label" id="sp-components">
              Components
            </h3>
            <ComponentList components={data.components} />
          </section>

          <section className="sp-block" aria-labelledby="sp-history">
            <h3 className="sp-label" id="sp-history">
              Past notices
            </h3>
            {data.history.length === 0 ? (
              <p className="sp-quiet">Nothing in the last 30 days.</p>
            ) : (
              data.history.map((notice) => (
                <NoticeCard
                  key={notice.id}
                  client={client}
                  notice={notice}
                  components={data.components}
                  canPost={false}
                  onChange={detail.reload}
                />
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="sp-components" aria-busy="true">
      {[0, 1, 2].map((key) => (
        <div key={key} className="sp-component">
          <span className="h-skeleton" />
          <span className="h-skeleton" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ components */

function ComponentList({
  components,
}: {
  components: readonly StatusComponentView[];
}) {
  if (components.length === 0)
    return <p className="sp-quiet">This page has no components yet.</p>;
  return (
    <div className="sp-components">
      {components.map((component) => (
        <article key={component.id} className="sp-component">
          <header>
            <h4>{component.name}</h4>
            <span className="sp-uptime">{percent(component.availability)}</span>
            <StatusText status={component.status} />
          </header>
          <UptimeBars component={component} />
          <footer>
            <span>{component.days.length} days ago</span>
            <span>Today</span>
          </footer>
        </article>
      ))}
    </div>
  );
}

function dayTitle(day: StatusComponentView["days"][number]): string {
  const date = new Date(day.time).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  if (day.status === null) return `${date}: no data`;
  return `${date}: ${componentLabel[day.status]}, ${percent(day.availability)} uptime`;
}

function UptimeBars({ component }: { component: StatusComponentView }) {
  const width = 4;
  const gap = 1.6;
  const height = 24;
  const total = component.days.length * (width + gap) - gap;
  return (
    <svg
      className="sp-bars"
      viewBox={`0 0 ${total} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${component.name}, daily status for the last ${component.days.length} days`}
    >
      {component.days.map((day, index) => (
        <rect
          key={day.time}
          x={index * (width + gap)}
          y={0}
          width={width}
          height={height}
          rx={1}
          data-status={day.status ?? "missing"}
        >
          <title>{dayTitle(day)}</title>
        </rect>
      ))}
    </svg>
  );
}

/* --------------------------------------------------------------- notices */

function NoticeCard({
  client,
  notice,
  components,
  canPost,
  onChange,
}: {
  client: Client;
  notice: NoticeView;
  components: readonly StatusComponentView[];
  canPost: boolean;
  onChange: () => void;
}) {
  const { useState } = React;
  const [open, setOpen] = useState(false);
  const resolved = notice.resolvedAt !== null;
  const affected = components
    .filter((component) => notice.componentIds.includes(component.id))
    .map((component) => component.name);
  return (
    <article
      className="sp-notice"
      data-status={resolved ? "resolved" : notice.impact}
    >
      <header>
        <div className="sp-notice-title">
          <h4>{notice.title}</h4>
          <p>
            {resolved ? "Resolved" : componentLabel[notice.impact]}
            {" · "}
            {affected.length > 0 ? affected.join(", ") : "Whole page"}
            {notice.source ? ` · via ${notice.source}` : ""}
          </p>
        </div>
        {canPost && !resolved && !open && (
          <button
            type="button"
            className="h-button"
            onClick={() => setOpen(true)}
          >
            Add update
          </button>
        )}
      </header>
      {open && (
        <UpdateForm
          client={client}
          notice={notice}
          onDone={() => {
            setOpen(false);
            onChange();
          }}
        />
      )}
      <ol className="sp-updates">
        {notice.updates.map((update) => (
          <li key={update.id} data-status={update.status}>
            <time dateTime={new Date(update.time).toISOString()}>
              {dateTime(update.time)}
            </time>
            <div>
              <strong>{noticeStatusLabel[update.status]}</strong>
              <p>{update.message}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

function UpdateForm({
  client,
  notice,
  onDone,
}: {
  client: Client;
  notice: NoticeView;
  onDone: () => void;
}) {
  const { useState } = React;
  const action = useAction(client, onDone);
  const [status, setStatus] = useState<NoticeStatus>(
    notice.status === "investigating" ? "identified" : "monitoring",
  );
  const [message, setMessage] = useState("");
  return (
    <form
      className="h-form sp-form"
      onSubmit={(event) => {
        event.preventDefault();
        void action.run("update-notice", {
          noticeId: notice.id,
          status,
          message,
        });
      }}
    >
      <label className="h-field">
        Status
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.currentTarget.value as NoticeStatus)
          }
        >
          {(Object.keys(noticeStatusLabel) as NoticeStatus[]).map((value) => (
            <option key={value} value={value}>
              {noticeStatusLabel[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="h-field h-grow">
        Message
        <textarea
          required
          maxLength={2000}
          value={message}
          placeholder="What changed since the last update?"
          onChange={(event) => setMessage(event.currentTarget.value)}
        />
      </label>
      <div className="h-section-actions">
        <button type="button" className="h-button" onClick={onDone}>
          Cancel
        </button>
        <button
          type="submit"
          className="h-button"
          data-variant="primary"
          disabled={action.pending || message.trim() === ""}
        >
          {status === "resolved" ? "Resolve" : "Post update"}
        </button>
      </div>
      {action.error && <Notice tone="error">{action.error}</Notice>}
    </form>
  );
}

function NoticeForm({
  client,
  page,
  onDone,
}: {
  client: Client;
  page: StatusPageDetail;
  onDone: () => void;
}) {
  const { useState } = React;
  const action = useAction(client, onDone);
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState<Impact>("degraded");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <form
      className="h-card sp-form"
      onSubmit={(event) => {
        event.preventDefault();
        void action.run("post-notice", {
          pageId: page.page.id,
          title,
          impact,
          message,
          componentIds: [...selected],
        });
      }}
    >
      <h2>New notice</h2>
      <div className="sp-form-row">
        <label className="h-field h-grow">
          Title
          <input
            required
            maxLength={160}
            value={title}
            placeholder="Dashboards load slowly"
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        </label>
        <label className="h-field">
          Impact
          <select
            value={impact}
            onChange={(event) => setImpact(event.currentTarget.value as Impact)}
          >
            {IMPACTS.map((value) => (
              <option key={value} value={value}>
                {componentLabel[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="sp-choices">
        <legend>Affected components</legend>
        {page.components.map((component) => (
          <label key={component.id}>
            <input
              type="checkbox"
              checked={selected.has(component.id)}
              onChange={() => toggle(component.id)}
            />
            {component.name}
          </label>
        ))}
        <span className="h-muted">None selected means the whole page.</span>
      </fieldset>
      <label className="h-field">
        Message
        <textarea
          required
          maxLength={2000}
          value={message}
          placeholder="What is happening, and what should people expect?"
          onChange={(event) => setMessage(event.currentTarget.value)}
        />
      </label>
      <div className="h-section-actions">
        <button type="button" className="h-button" onClick={onDone}>
          Cancel
        </button>
        <button
          type="submit"
          className="h-button"
          data-variant="primary"
          disabled={
            action.pending || title.trim() === "" || message.trim() === ""
          }
        >
          Post notice
        </button>
      </div>
      {action.error && <Notice tone="error">{action.error}</Notice>}
    </form>
  );
}

/* ---------------------------------------------------------------- editor */

type DraftComponent = {
  key: string;
  id?: string;
  name: string;
  serviceIds: string[];
};

let draftKey = 0;
const nextKey = () => `draft-${++draftKey}`;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function PageEditor({
  client,
  page,
  onCancel,
  onSaved,
  onDeleted,
}: {
  client: Client;
  page?: StatusPageDetail;
  onCancel: () => void;
  onSaved: (slug: string) => void;
  onDeleted?: () => void;
}) {
  const { useState } = React;
  const services = useResource(client, "services", {}, servicesSchema);
  const [name, setName] = useState(page?.page.name ?? "");
  const [slug, setSlug] = useState(page?.page.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(page));
  const [description, setDescription] = useState(page?.page.description ?? "");
  const [components, setComponents] = useState<DraftComponent[]>(
    page?.components.map((component) => ({
      key: component.id,
      id: component.id,
      name: component.name,
      serviceIds: [...component.serviceIds],
    })) ?? [{ key: nextKey(), name: "", serviceIds: [] }],
  );
  const save = useAction(client);
  const remove = useAction(client, onDeleted);

  const update = (key: string, change: Partial<DraftComponent>) =>
    setComponents((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  const move = (index: number, by: number) =>
    setComponents((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (item) next.splice(index + by, 0, item);
      return next;
    });

  const valid =
    name.trim() !== "" &&
    slug.length >= 2 &&
    components.every(
      (component) =>
        component.name.trim() !== "" && component.serviceIds.length > 0,
    );

  return (
    <form
      className="h-card sp-editor"
      onSubmit={(event) => {
        event.preventDefault();
        const input = {
          name: name.trim(),
          slug,
          ...(description.trim() ? { description: description.trim() } : {}),
          components: components.map((component) => ({
            ...(component.id ? { id: component.id } : {}),
            name: component.name.trim(),
            serviceIds: component.serviceIds,
          })),
        };
        void save
          .run(
            page ? "update-status-page" : "create-status-page",
            page ? { id: page.page.id, ...input } : input,
          )
          .then((ok) => {
            if (ok) onSaved(slug);
          });
      }}
    >
      <h2>{page ? "Edit status page" : "New status page"}</h2>
      <div className="sp-form-row">
        <label className="h-field h-grow">
          Name
          <input
            required
            maxLength={80}
            value={name}
            placeholder="Finance reporting"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setName(value);
              if (!slugTouched) setSlug(slugify(value));
            }}
          />
        </label>
        <label className="h-field">
          Address
          <input
            required
            maxLength={60}
            value={slug}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.currentTarget.value));
            }}
          />
        </label>
      </div>
      <label className="h-field">
        Description
        <input
          maxLength={500}
          value={description}
          placeholder="Who this page is for and what it covers"
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </label>

      <fieldset className="sp-editor-components">
        <legend>Components</legend>
        <p className="h-muted">
          A component is something people recognise, backed by one or more
          services. Its status is the worst of its services.
        </p>
        {components.map((component, index) => (
          <div key={component.key} className="sp-editor-component">
            <div className="sp-form-row">
              <label className="h-field h-grow">
                Component name
                <input
                  required
                  maxLength={80}
                  value={component.name}
                  placeholder="Revenue dashboards"
                  onChange={(event) =>
                    update(component.key, { name: event.currentTarget.value })
                  }
                />
              </label>
              <div className="sp-editor-tools">
                <button
                  type="button"
                  className="h-button"
                  aria-label={`Move ${component.name || "component"} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="h-button"
                  aria-label={`Move ${component.name || "component"} down`}
                  disabled={index === components.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="h-button"
                  data-variant="danger"
                  disabled={components.length === 1}
                  onClick={() =>
                    setComponents((current) =>
                      current.filter((item) => item.key !== component.key),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </div>
            <fieldset className="sp-choices">
              <legend className="sp-visually-hidden">Services</legend>
              {(services.data?.items ?? []).map((service) => (
                <label key={service.id}>
                  <input
                    type="checkbox"
                    checked={component.serviceIds.includes(service.id)}
                    onChange={(event) =>
                      update(component.key, {
                        serviceIds: event.currentTarget.checked
                          ? [...component.serviceIds, service.id]
                          : component.serviceIds.filter(
                              (id) => id !== service.id,
                            ),
                      })
                    }
                  />
                  {service.name}
                  <span className="h-muted">{service.adapter}</span>
                </label>
              ))}
              {services.data?.items.length === 0 && (
                <span className="h-muted">No services to choose from.</span>
              )}
            </fieldset>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="h-button"
            onClick={() =>
              setComponents((current) => [
                ...current,
                { key: nextKey(), name: "", serviceIds: [] },
              ])
            }
          >
            Add component
          </button>
        </div>
      </fieldset>

      {save.error && <Notice tone="error">{save.error}</Notice>}
      {remove.error && <Notice tone="error">{remove.error}</Notice>}

      <div className="sp-editor-actions">
        {page && (
          <button
            type="button"
            className="h-button"
            data-variant="danger"
            disabled={remove.pending}
            onClick={() => {
              if (
                window.confirm(
                  `Delete "${page.page.name}" and its notices? This cannot be undone.`,
                )
              )
                void remove.run("delete-status-page", { id: page.page.id });
            }}
          >
            Delete page
          </button>
        )}
        <span className="sp-spacer" />
        <button type="button" className="h-button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="h-button"
          data-variant="primary"
          disabled={!valid || save.pending}
        >
          {page ? "Save changes" : "Create page"}
        </button>
      </div>
    </form>
  );
}
