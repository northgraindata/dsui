import "../shared/base.css";
import "./styles.css";
import { go } from "../shared/ui";
import { Art, type ArtName } from "./art";
import { Browser } from "./browser";
import { buckets } from "./data";
import { Activity, Buckets, Settings } from "./pages";
import { folderPath } from "./pathbar";
import { BucketSwitcher } from "./switcher";
import { Transfers } from "./transfers";

/** The open bucket. The sidebar always names it, so it is never hidden. */
let remembered: string | undefined;

function openBucket(pathname: string) {
  const [, section, name] = pathname.split("/");
  if (section === "buckets" && buckets.some((item) => item.name === name))
    remembered = name;
  return remembered;
}

export function Page({ path }: { path: string }) {
  const [pathname = "/", search = ""] = path.split("?");
  const [, section, bucket, sub] = pathname.split("/");
  if (bucket && openBucket(pathname) === bucket && section === "buckets") {
    if (sub === "settings") return <Settings key={bucket} bucket={bucket} />;
    const query = new URLSearchParams(search);
    const prefix = query.get("prefix") ?? "";
    const key = query.get("key") ?? undefined;
    // Another folder starts with a clean selection and no search.
    return (
      <Browser
        key={`${bucket}/${prefix}/${key ?? ""}`}
        bucket={bucket}
        prefix={prefix}
        openKey={key}
      />
    );
  }
  if (section === "activity") return <Activity />;
  return <Buckets />;
}

function NavItem({
  art,
  label,
  path,
  current,
}: {
  art: ArtName;
  label: string;
  path: string;
  current: boolean;
}) {
  return (
    <button
      type="button"
      className="ax-nav"
      aria-label={label}
      title={label}
      aria-current={current ? "page" : undefined}
      onClick={() => go(path)}
    >
      <Art name={art} size={28} />
      <span>{label}</span>
    </button>
  );
}

export function SideNav({ path }: { path: string }) {
  const [pathname = "/"] = path.split("?");
  const bucket = openBucket(pathname);
  const inBucket = pathname.startsWith("/buckets/");
  const onSettings = inBucket && pathname.endsWith("/settings");
  return (
    <>
      <nav>
        <div>
          <p>All buckets</p>
          <NavItem
            art="buckets"
            label="Buckets"
            path="/"
            current={pathname === "/"}
          />
          <NavItem
            art="activity"
            label="Activity"
            path="/activity"
            current={pathname === "/activity"}
          />
        </div>
        {bucket ? (
          <div className="s3-open-bucket">
            <p>Open bucket</p>
            <BucketSwitcher
              bucket={bucket}
              onChoose={(next) =>
                go(
                  onSettings
                    ? `/buckets/${next}/settings`
                    : folderPath(next, ""),
                )
              }
            />
            <NavItem
              art="files"
              label="Files"
              path={folderPath(bucket, "")}
              current={inBucket && !onSettings}
            />
            <NavItem
              art="settings"
              label="Settings"
              path={`/buckets/${bucket}/settings`}
              current={onSettings}
            />
          </div>
        ) : null}
      </nav>
      <Transfers />
    </>
  );
}
