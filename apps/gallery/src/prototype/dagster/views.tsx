import "../shared/base.css";
import "./styles.css";
import { go } from "../shared/ui";
import { Art, type ArtName } from "./art";
import { AssetPage } from "./asset";
import { Assets } from "./assets";
import { Automation, InstigatorPage } from "./automation";
import { assetNow } from "./catalog";
import { Deployment } from "./deployment";
import { Home } from "./home";
import { jobByName } from "./jobs";
import { JobPage, Jobs } from "./jobs-pages";
import { Lineage } from "./lineage";
import { backfillById, instigatorByName, locations, tickFailing } from "./ops";
import { RunPage } from "./run";
import { runById, runs } from "./runs";
import { BackfillPage, Runs } from "./runs-pages";
import { NOW } from "./time";

function LineagePage({ query }: { query: URLSearchParams }) {
  const focus = query.get("focus") ?? undefined;
  const asset = focus ? assetNow.get(focus) : undefined;
  return (
    <div className="dx-lineage-page">
      <h1 className="dx-hidden">Lineage</h1>
      <Lineage
        key={focus ?? ""}
        stateKey={focus ? `focus:${focus}` : "all"}
        focusKey={asset?.def.key}
        initialQuery={asset ? `+${asset.def.name}+` : ""}
      />
    </div>
  );
}

export function Page({ path }: { path: string }) {
  const [pathname = "/", search = ""] = path.split("?");
  const [, section, ...rest] = pathname.split("/");
  const id = rest.join("/");
  const query = new URLSearchParams(search);
  // The same page with another filter starts afresh.
  const key = path;
  if (section === "runs") {
    const run = runById.get(id);
    return run ? (
      <RunPage key={id} run={run} />
    ) : (
      <Runs key={key} query={query} />
    );
  }
  if (section === "backfills") {
    const item = backfillById.get(id);
    return item ? (
      <BackfillPage key={id} item={item} />
    ) : (
      <Runs key={key} query={new URLSearchParams("tab=Backfills")} />
    );
  }
  if (section === "lineage") return <LineagePage query={query} />;
  if (section === "assets") {
    const item = assetNow.get(id);
    return item ? (
      <AssetPage key={key} item={item} query={query} />
    ) : (
      <Assets key={key} query={query} />
    );
  }
  if (section === "jobs") {
    const job = jobByName.get(id);
    return job ? <JobPage key={key} job={job} query={query} /> : <Jobs />;
  }
  if (section === "automation") {
    const item = instigatorByName.get(id);
    return item ? <InstigatorPage key={id} item={item} /> : <Automation />;
  }
  if (section === "deployment") return <Deployment key={key} query={query} />;
  return <Home />;
}

interface Item {
  label: string;
  art: ArtName;
  path: string;
  /** Also current on pages under these. */
  owns?: string[];
  count?: number;
}

const failedToday = new Set(
  runs
    .filter(
      (run) =>
        run.status === "FAILURE" &&
        NOW.getTime() - run.created.getTime() < 86_400_000,
    )
    .map((run) => run.job),
).size;

const navigation: { group?: string; items: Item[] }[] = [
  {
    items: [{ label: "Overview", art: "home", path: "/" }],
  },
  {
    group: "Monitor",
    items: [
      {
        label: "Runs",
        art: "runs",
        path: "/runs",
        owns: ["/backfills"],
        count: failedToday,
      },
    ],
  },
  {
    group: "Catalog",
    items: [
      { label: "Lineage", art: "lineage", path: "/lineage" },
      { label: "Assets", art: "assets", path: "/assets" },
      { label: "Jobs", art: "jobs", path: "/jobs" },
    ],
  },
  {
    group: "Operate",
    items: [
      {
        label: "Automation",
        art: "automation",
        path: "/automation",
        count: tickFailing().length,
      },
      {
        label: "Deployment",
        art: "deployment",
        path: "/deployment",
        count: locations.filter((item) => !item.loaded).length,
      },
    ],
  },
];

export function SideNav({ path }: { path: string }) {
  const pathname = path.split("?")[0] ?? "/";
  const within = (item: Item) =>
    item.path === "/"
      ? pathname === "/"
      : [item.path, ...(item.owns ?? [])].some(
          (target) => pathname === target || pathname.startsWith(`${target}/`),
        );
  return (
    <nav>
      {navigation.map((section) => (
        <div key={section.group ?? "top"}>
          {section.group ? <p>{section.group}</p> : null}
          {section.items.map((item) => (
            <button
              type="button"
              key={item.path}
              className="ax-nav"
              title={item.label}
              aria-current={within(item) ? "page" : undefined}
              onClick={() => go(item.path)}
            >
              <Art name={item.art} size={28} />
              <span>{item.label}</span>
              {item.count ? <b data-alert="true">{item.count}</b> : null}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
