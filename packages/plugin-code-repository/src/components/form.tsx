import { createOptionSelect } from "@northgraindata/dsui-ui/option-select-factory";
import type * as ReactTypes from "react";
import { z } from "zod";
import type { Connection, ConnectionInput } from "../model";
import { SourceIcon } from "./presentation";
import { React } from "./react";
import { action, type Client, type overviewSchema } from "./shared";

const OptionSelect = createOptionSelect(() => React);
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
  const [value, setValue] = React.useState<ConnectionInput>(() =>
    item
      ? { ...item, name: "" }
      : {
          serviceId,
          name: "",
          provider: "github",
          repository: "",
          instance: providers.gitlab[0]?.id ?? "gitlab",
          branch: "",
          folder: "",
          instructions: "",
        },
  );
  const fieldId = React.useId();
  const [branchNames, setBranchNames] = React.useState<string[]>([]);
  const [folderNames, setFolderNames] = React.useState<string[]>([]);
  const [foldersOpen, setFoldersOpen] = React.useState(false);
  const [checked, setChecked] = React.useState<{
    key: string;
    files: number;
    bytes: number;
  }>();
  const [checking, setChecking] = React.useState(false);
  const sourceKey = JSON.stringify([
    value.provider,
    value.instance,
    value.repository,
    value.branch,
    value.folder,
  ]);
  const verified = checked?.key === sourceKey;
  const check = async () => {
    setBusy(true);
    setChecking(true);
    setError(undefined);
    setChecked(undefined);
    try {
      const result = z
        .object({ files: z.number(), bytes: z.number() })
        .parse(await action(client, "check", value));
      setChecked({ key: sourceKey, ...result });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not check connection",
      );
    } finally {
      setBusy(false);
      setChecking(false);
    }
  };
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const change = <K extends keyof ConnectionInput>(
    key: K,
    next: ConnectionInput[K],
  ) => {
    setValue((previous) => ({ ...previous, [key]: next }));
    setError(undefined);
    if (["provider", "instance", "repository", "branch"].includes(key)) {
      setFolderNames([]);
      setFoldersOpen(false);
    }
    if (
      ["provider", "instance", "repository", "branch", "folder"].includes(key)
    )
      setChecked(undefined);
  };
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
      setFoldersOpen(true);
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
    if (!verified) {
      await check();
      return;
    }
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
      <header className="cr-form-heading">
        <h3>{item ? "Connection settings" : "Connect source code"}</h3>
        <p>
          Link a repository or folder to this service. Its code will be
          available in the explorer.
        </p>
      </header>
      <fieldset disabled={busy}>
        <legend>
          <span>01</span> Source
        </legend>
        <div className="cr-provider-options">
          {(["github", "gitlab", "local"] as const)
            .filter((provider) =>
              provider !== "local"
                ? provider !== "gitlab" || providers.gitlab.length > 0
                : providers.local,
            )
            .map((provider) => (
              <button
                type="button"
                key={provider}
                aria-pressed={value.provider === provider}
                onClick={() => {
                  change("provider", provider);
                  setBranchNames([]);
                  setFolderNames([]);
                }}
              >
                <SourceIcon provider={provider} />
                <strong>
                  {provider === "github"
                    ? "GitHub"
                    : provider === "gitlab"
                      ? "GitLab"
                      : "Local folder"}
                </strong>
                <small>
                  {provider === "local"
                    ? "On the DSUI host"
                    : "Public or private repos"}
                </small>
              </button>
            ))}
        </div>
        <div className="cr-fields">
          {value.provider === "gitlab" && (
            <label htmlFor={`${fieldId}-gitlab-instance`}>
              GitLab instance
              <OptionSelect
                id={`${fieldId}-gitlab-instance`}
                value={value.instance}
                onValueChange={(next) => {
                  change("instance", next);
                  setBranchNames([]);
                }}
                options={providers.gitlab.map((instance) => ({
                  value: instance.id,
                  label: instance.url,
                }))}
              />
            </label>
          )}
          <label>
            {value.provider === "local"
              ? "Folder on the DSUI host"
              : "Repository (owner/name or URL)"}
            <input
              required
              placeholder={
                value.provider === "local"
                  ? "/path/to/project"
                  : "organization/repository"
              }
              value={value.repository}
              onChange={(event) => {
                change("repository", event.target.value);
                setBranchNames([]);
              }}
            />
          </label>
        </div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>
          <span>02</span> Code scope
        </legend>
        <p className="cr-field-help">
          Choose which code to include. Leave the folder empty to include the
          full repository.
        </p>
        <div className="cr-fields">
          {value.provider !== "local" && (
            <label>
              Branch
              <div className="cr-row">
                <input
                  required
                  list={`${fieldId}-branches`}
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
              <datalist id={`${fieldId}-branches`}>
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
              placeholder="packages/backend"
              onChange={(event) => change("folder", event.target.value)}
            />
            <button
              type="button"
              disabled={
                busy ||
                !value.repository ||
                (value.provider !== "local" && !value.branch)
              }
              aria-expanded={foldersOpen}
              onClick={() =>
                foldersOpen ? setFoldersOpen(false) : void loadFolders()
              }
            >
              Choose folder
            </button>
            {foldersOpen && (
              <div className="cr-folder-picker">
                <button
                  type="button"
                  onClick={() => {
                    change("folder", "");
                    setFoldersOpen(false);
                  }}
                >
                  Entire source
                </button>
                {folderNames.map((folder) => (
                  <button
                    type="button"
                    key={folder}
                    onClick={() => {
                      change("folder", folder);
                      setFoldersOpen(false);
                    }}
                  >
                    {folder}/
                  </button>
                ))}
                {folderNames.length === 0 && <p>No subfolders found.</p>}
              </div>
            )}
          </label>
        </div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>
          <span>03</span> Code context
        </legend>
        <label>
          Instructions <span className="cr-optional">Optional</span>
          <textarea
            rows={5}
            value={value.instructions}
            placeholder="Context about this code and its relationship to the service."
            onChange={(event) => change("instructions", event.target.value)}
          />
        </label>
      </fieldset>
      {verified && checked && (
        <div className="cr-check-result" role="status">
          <strong>✓ Connection verified</strong>
          <p>
            Source and selected folder are readable ·{" "}
            {checked.files.toLocaleString()} files ·{" "}
            {(checked.bytes / 1024).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}{" "}
            KB
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="cr-error">
          {error}
        </p>
      )}
      <div className="cr-form-actions">
        <button className="cr-primary" type="submit" disabled={busy}>
          {checking
            ? "Checking connection…"
            : busy
              ? "Saving…"
              : verified
                ? "Save and fetch"
                : "Check connection"}
        </button>
        {verified && (
          <button type="button" disabled={busy} onClick={() => void check()}>
            Check again
          </button>
        )}
        <button type="button" disabled={busy} onClick={done}>
          Cancel
        </button>
      </div>
    </form>
  );
}
