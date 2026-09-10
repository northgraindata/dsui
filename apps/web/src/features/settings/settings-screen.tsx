import { cn, Surface } from "@northgraindata/dsui-ui";
import { PageHeading, pageClass } from "../../components/page";

export function SettingsScreen() {
  return (
    <div className={cn(pageClass, "max-w-xl")}>
      <PageHeading
        title="Settings"
        detail="Configuration for this local dsui workspace."
      />
      <Surface className="grid gap-3 p-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Installation
          </p>
          <p className="mt-1 text-[12px] text-primary">Local workspace</p>
        </div>
        <p className="text-[11.5px] text-secondary">
          Services defined in <code>dsui.yaml</code> are managed by
          configuration and are read-only here.
        </p>
      </Surface>
    </div>
  );
}
