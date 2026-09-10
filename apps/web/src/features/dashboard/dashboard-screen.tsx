import { useEffect, useState } from "react";
import { getServices, type Service } from "../../api";
import { HomeDashboard } from "../../components/home-dashboard";

export function DashboardScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getServices()
      .then(setServices)
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load services.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return <HomeDashboard services={services} loading={loading} error={error} />;
}
