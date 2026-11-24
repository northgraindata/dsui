import { Link } from "@tanstack/react-router";
import type { Service } from "../api";
import { Icon } from "./icon";

export function HomeGreeting() {
  return (
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
  );
}

export function HomeStats({
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
  );
}

export function HomeSidebar() {
  return (
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
  );
}
