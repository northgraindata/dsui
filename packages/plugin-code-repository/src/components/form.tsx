import type * as ReactTypes from "react";
import { z } from "zod";
import type { Connection, ConnectionInput } from "../model";
import { React } from "./react";
import { action, type Client, type overviewSchema } from "./shared";
export function RepositoryForm({
  client,
  serviceId,
  item,
  providers,
  done,
}: {
  client: Client;
  serviceId: string;
  item?: Connection;
  providers: z.infer<typeof overviewSchema>["providers"];
  done: () => void;
}) {
  const [value, setValue] = React.useState<ConnectionInput>(
    () =>
      item ?? {
        serviceId,
        name: "",
        provider: "github",
        repository: "",
        instance: providers.gitlab[0]?.id ?? "gitlab",
        branch: "",
        folder: "",
        instructions: "",
        refreshMinutes: 15,
      },
  );
  const [branchNames, setBranchNames] = React.useState<string[]>([]);
  const [folderNames, setFolderNames] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const change = <K extends keyof ConnectionInput>(
    key: K,
    next: ConnectionInput[K],
  ) => setValue((previous) => ({ ...previous, [key]: next }));
  const loadBranches = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setBranchNames(
        z.array(z.string()).parse(await action(client, "branches", value)),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not list branches",
      );
    } finally {
      setBusy(false);
    }
  };
  const loadFolders = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setFolderNames(
        z.array(z.string()).parse(await action(client, "folders", value)),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not list folders",
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async (event: ReactTypes.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await action(client, "save", value);
      done();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save repository",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="cr-form" onSubmit={(event) => void save(event)}>
      <h3>{item ? "Edit connection" : "Connect code"}</h3>
      <label>
        Name
        <input
          required
          value={value.name}
          onChange={(event) => change("name", event.target.value)}
        />
      </label>
      <label>
        Source
        <select
          value={value.provider}
          onChange={(event) => {
            change(
              "provider",
              z.enum(["github", "gitlab", "local"]).parse(event.target.value),
            );
            setBranchNames([]);
          }}
        >
          <option value="github">GitHub</option>
          {providers.gitlab.length > 0 && (
            <option value="gitlab">GitLab</option>
          )}
          {providers.local && <option value="local">Local folder</option>}
        </select>
      </label>
      {value.provider === "gitlab" && (
        <label>
          GitLab instance
          <select
            value={value.instance}
            onChange={(event) => {
              change("instance", event.target.value);
              setBranchNames([]);
            }}
          >
            {providers.gitlab.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.url}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {value.provider === "local"
          ? "Folder on the DSUI host"
          : "Repository (owner/name or URL)"}
        <input
          required
          value={value.repository}
          onChange={(event) => {
            change("repository", event.target.value);
            setBranchNames([]);
          }}
        />
      </label>
      {value.provider !== "local" && (
        <label>
          Branch
          <div className="cr-row">
            <input
              required
              list="cr-branches"
              value={value.branch}
              onChange={(event) => change("branch", event.target.value)}
            />
            <button
              type="button"
              disabled={busy || !value.repository}
              onClick={() => void loadBranches()}
            >
              Load branches
            </button>
          </div>
          <datalist id="cr-branches">
            {branchNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
      )}
      <label>
        Subfolder (optional)
        <input
          value={value.folder}
          list="cr-folders"
          placeholder="packages/backend"
          onChange={(event) => change("folder", event.target.value)}
        />
        <datalist id="cr-folders">
          {folderNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <button
          type="button"
          disabled={
            busy ||
            !value.repository ||
            (value.provider !== "local" && !value.branch)
          }
          onClick={() => void loadFolders()}
        >
          Browse folders
        </button>
      </label>
      <label>
        Instructions
        <textarea
          rows={5}
          value={value.instructions}
          placeholder="Context about this code and its relationship to the service."
          onChange={(event) => change("instructions", event.target.value)}
        />
      </label>
      <label>
        Refresh interval in minutes (0 disables automatic refresh)
        <input
          type="number"
          min={0}
          max={10080}
          required
          value={value.refreshMinutes}
          onChange={(event) =>
            change("refreshMinutes", Number(event.target.value))
          }
        />
      </label>
      {error && (
        <p role="alert" className="cr-error">
          {error}
        </p>
      )}
      <div className="cr-row">
        <button type="submit" disabled={busy}>
          {busy ? "Working…" : "Save and fetch"}
        </button>
        <button type="button" onClick={done}>
          Cancel
        </button>
      </div>
    </form>
  );
}
