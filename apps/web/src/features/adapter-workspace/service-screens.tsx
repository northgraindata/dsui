import { useParams } from "@tanstack/react-router";
import { ServiceScreen } from "./service-screen";

export function ServiceDetail() {
  const { serviceId } = useParams({ from: "/services/$serviceId" });
  return <ServiceScreen key={serviceId} serviceId={serviceId} />;
}

export function ServiceView() {
  const { serviceId, viewId } = useParams({
    from: "/services/$serviceId/$viewId",
  });
  return (
    <ServiceScreen key={serviceId} serviceId={serviceId} viewId={viewId} />
  );
}

export function ServiceObjectView() {
  const { serviceId, viewId, database, objectName, tabId } = useParams({
    from: "/services/$serviceId/$viewId/$database/$objectName/$tabId",
  });
  return (
    <ServiceScreen
      key={serviceId}
      serviceId={serviceId}
      pagePath={`/${viewId}/${database}/${objectName}/${tabId}`}
    />
  );
}

export function ServicePage() {
  const { serviceId } = useParams({ from: "/services/$serviceId/$" });
  const splat = useParams({
    from: "/services/$serviceId/$",
    select: (params) => params._splat,
  });
  return (
    <ServiceScreen
      key={serviceId}
      serviceId={serviceId}
      pagePath={splat ? `/${splat}` : undefined}
    />
  );
}
