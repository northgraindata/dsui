import { Link } from "@tanstack/react-router";
import type { Service } from "../api";
import { Icon } from "./Icon";
import { ServiceMark } from "./ServiceMark";

export function HomeDashboard({
  services,
  loading,
  error,
}: {
  services: Service[];
  loading: boolean;
  error?: string;
}) {
  const connected = services.filter(
    (service) => service.health === "healthy",
  ).length;
  const issues = services.filter(
    (service) =>
      service.health === "unavailable" || service.health === "warning",
  ).length;
  const stats = [
    {
      label: "Connected services",
      value: connected,
      icon: "layers",
      tone: "accent",
    },
    {
      label: "Issues detected",
      value: issues,
      icon: "alert",
      tone: "unavailable",
    },
    {
      label: "Configured adapters",
      value: new Set(services.map((service) => service.adapter)).size,
      icon: "check",
      tone: "healthy",
    },
    {
      label: "Estimated daily cost",
      value: "—",
      icon: "activity",
      tone: "muted",
      detail: "Coming soon",
    },
  ];
  return (
    <div className="home-dashboard">
      <header className="home-heading">
        <div className="home-greeting">
          <span className="greeting-icon">
            <Icon name="sun" size={26} />
          </span>
          <div>
            <h1>Your workspace, at a glance</h1>
            <p>Here's what's happening with your data stack today.</p>
          </div>
        </div>
        <time dateTime={new Date().toISOString().slice(0, 10)}>
          {new Intl.DateTimeFormat(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(new Date())}
        </time>
      </header>
      {error && (
        <p role="alert" className="dashboard-error">
          {error}
        </p>
      )}
      <div className="home-stats" aria-busy={loading}>
        {stats.map((stat) => (
          <section className="home-stat" key={stat.label}>
            <div>
              <strong>{loading || error ? "—" : stat.value}</strong>
              <p>{stat.label}</p>
            </div>
            <div className={`stat-icon stat-icon--${stat.tone}`}>
              <Icon name={stat.icon} size={22} />
              {stat.detail && <small>{stat.detail}</small>}
            </div>
          </section>
        ))}
      </div>
      <div className="home-panels">
        <section className="stack-panel">
          <header>
            <div>
              <h2>Your data stack</h2>
              <p>All connected services in one place.</p>
            </div>
            <Link to="/services/new" className="outline-action">
              <Icon name="plus" />
              Add adapter
            </Link>
          </header>
          <div className="stack-cards" aria-busy={loading}>
            {loading && (
              <p className="stack-loading" role="status">
                Checking your services…
              </p>
            )}
            {services.map((service) => (
              <Link
                key={service.id}
                to="/services/$serviceId"
                params={{ serviceId: service.id }}
                className="stack-card"
              >
                <div className="stack-card-heading">
                  <ServiceMark
                    adapter={service.adapter}
                    logo={service.logo}
                    size={42}
                    variant="bare"
                  />
                  <div>
                    <h3>{service.name}</h3>
                    <span>
                      <i className="health-dot" data-health={service.health} />
                      {service.health === "healthy"
                        ? "Connected"
                        : service.health}
                    </span>
                  </div>
                  <Icon name="chevron" size={15} />
                </div>
                <div className="stack-card-detail">
                  <p title={service.endpoint}>
                    {service.endpoint || service.adapter}
                  </p>
                  <small title={service.detail ?? undefined}>
                    {service.detail ??
                      (service.latencyMs !== undefined
                        ? `${service.latencyMs} ms response time`
                        : "Ready to explore")}
                  </small>
                  <Icon name="database" size={21} />
                </div>
              </Link>
            ))}
            <Link to="/services/new" className="stack-card stack-card--add">
              <Icon name="plus" size={24} />
              <strong>Add new adapter</strong>
              <p>Connect more tools to your stack.</p>
            </Link>
          </div>
        </section>
        <aside className="home-aside">
          <section className="activity-panel">
            <header>
              <h2>Recent activity</h2>
            </header>
            <div className="activity-empty">
              <span className="greeting-icon">
                <Icon name="activity" size={24} />
              </span>
              <h3>Your stack's story starts here</h3>
              <p>
                Activity across your adapters will appear here. Query history is
                available inside each adapter.
              </p>
              <span className="coming-soon">Coming soon</span>
            </div>
          </section>
          <section className="quick-panel">
            <h2>Quick actions</h2>
            <Link to="/services">
              <Icon name="terminal" />
              Open query editor
              <Icon name="chevron" size={13} />
            </Link>
            <Link to="/services">
              <Icon name="database" />
              Browse data
              <Icon name="chevron" size={13} />
            </Link>
            <Link to="/services/new">
              <Icon name="gear" />
              Manage adapters
              <Icon name="chevron" size={13} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
