import "../shared/base.css";
import { Activity } from "./activity";
import { AssetPage, Assets } from "./assets";
import { Connections, Pools, Variables } from "./configure";
import { DagPage } from "./dag";
import { Dags } from "./dags";
import { assets, dags, failingDags, pools } from "./data";
import { Home } from "./home";
import { Art, type ArtName } from "./icons";
import { go } from "./parts";
import { Runs } from "./runs";

interface Item {
  label: string;
  art: ArtName;
  path: string;
  count?: number;
  alert?: boolean;
}

const failing = failingDags().length;
const navigation: { group?: string; items: Item[] }[] = [
  { items: [{ label: "Home", art: "home", path: "/" }] },
  {
    group: "Monitor",
    items: [
      {
        label: "DAGs",
        art: "dags",
        path: "/dags",
        count: failing,
        alert: true,
      },
      { label: "Runs", art: "runs", path: "/runs" },
      { label: "Assets", art: "assets", path: "/assets" },
    ],
  },
  {
    group: "Configure",
    items: [
      { label: "Connections", art: "connections", path: "/connections" },
      { label: "Variables", art: "variables", path: "/variables" },
      {
        label: "Pools",
        art: "pools",
        path: "/pools",
        count: pools.filter((pool) => pool.running >= pool.slots).length,
      },
      { label: "Activity", art: "activity", path: "/activity" },
    ],
  },
];

export function Page({ path }: { path: string }) {
  const [pathname = "/", search = ""] = path.split("?");
  const [, section, first] = pathname.split("/");
  if (section === "dags") {
    const dag = dags.find((item) => item.id === first);
    return dag ? (
      <DagPage key={dag.id} dag={dag} />
    ) : (
      <Dags key={search} query={new URLSearchParams(search)} />
    );
  }
  if (section === "assets") {
    const asset = assets.find((item) => item.id === first);
    return asset ? <AssetPage key={asset.id} asset={asset} /> : <Assets />;
  }
  const pages = {
    runs: Runs,
    connections: Connections,
    pools: Pools,
    variables: Variables,
    activity: Activity,
  };
  const Found = pages[section as keyof typeof pages] ?? Home;
  return <Found />;
}

export function SideNav({ path }: { path: string }) {
  // A filtered list is still that list.
  const pathname = path.split("?")[0] ?? "/";
  const within = (target: string) =>
    target === "/"
      ? pathname === "/"
      : pathname === target || pathname.startsWith(`${target}/`);
  return (
    <nav>
      {navigation.map((section) => (
        <div key={section.group ?? "top"}>
          {section.group ? <p>{section.group}</p> : null}
          {section.items.map((item) => (
            <div key={item.path}>
              <button
                type="button"
                className="ax-nav"
                aria-current={within(item.path) ? "page" : undefined}
                onClick={() => go(item.path)}
              >
                <Art name={item.art} size={28} />
                <span>{item.label}</span>
                {item.count ? (
                  <b data-alert={item.alert}>{item.count}</b>
                ) : null}
              </button>
            </div>
          ))}
        </div>
      ))}
    </nav>
  );
}
