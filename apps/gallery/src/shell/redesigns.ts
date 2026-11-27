/** The services that have a redesign to compare with their current pages. */
import type { ComponentType } from "react";
import * as airflow from "../prototype/airflow/views";
import * as s3 from "../prototype/s3/views";

export interface Redesigned {
  prefix: string;
  Page: ComponentType<{ path: string }>;
  SideNav: ComponentType<{ path: string }>;
  /** The current page that is closest to a redesigned one. */
  currentPageFor: (path: string) => string;
  redesignedPageFor: (pathname: string) => string;
}

const pathOf = (path: string) => path.split("?")[0] ?? "/";

const redesigns: Redesigned[] = [
  {
    prefix: "/services/airflow",
    Page: airflow.Page,
    SideNav: airflow.SideNav,
    currentPageFor: (path) => {
      const pathname = pathOf(path);
      if (pathname === "/runs") return "/dags";
      if (pathname === "/activity") return "/event-logs";
      return pathname;
    },
    redesignedPageFor: (pathname) => {
      const path = pathname.slice("/services/airflow".length) || "/";
      if (path === "/event-logs") return "/activity";
      const [, section, id, ...rest] = path.split("/");
      // A run or a task opens over its DAG in the redesign.
      if (section === "dags" && id && rest.length) return `/dags/${id}`;
      if (section === "users") return "/";
      return path;
    },
  },
  {
    prefix: "/services/s3",
    Page: s3.Page,
    SideNav: s3.SideNav,
    currentPageFor: (path) => {
      const [, section, bucket] = pathOf(path).split("/");
      return section === "buckets" && bucket ? `/buckets/${bucket}` : "/";
    },
    redesignedPageFor: (pathname) =>
      pathname.slice("/services/s3".length) || "/",
  },
];

export const redesignFor = (pathname: string) =>
  redesigns.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
