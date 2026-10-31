import { Fragment, useEffect, useRef } from "react";
import { comboLabels, SHORTCUTS, type Shortcut } from "../shortcuts";
import { Icon } from "./icon";

function Keys({ shortcut }: { shortcut: Shortcut }) {
  return (
    <span className="shortcuts-keys">
      {shortcut.keys.combos.map((combo, index) => (
        <Fragment key={comboLabels(combo).join("+")}>
          {index > 0 ? <span className="shortcuts-then">or</span> : null}
          {comboLabels(combo).map((label) => (
            <kbd key={label}>{label}</kbd>
          ))}
        </Fragment>
      ))}
    </span>
  );
}

/** Every shortcut from the registry, grouped, in a modal dialog. */
export function ShortcutsDialog({
  close,
  agentAvailable,
}: {
  close: () => void;
  agentAvailable: boolean;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const shortcuts = SHORTCUTS.filter(
    (shortcut) => shortcut.id !== "agent" || agentAvailable,
  );
  const openShortcuts = SHORTCUTS.find(({ id }) => id === "shortcuts");
  const groups = [...new Set(shortcuts.map((shortcut) => shortcut.group))];

  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [close]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop dismisses on outside press; the dialog carries the semantic role
    <div className="shortcuts-backdrop" role="presentation" onMouseDown={close}>
      <div
        className="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shortcuts-header">
          <div>
            <h2 id="shortcuts-title">Keyboard shortcuts</h2>
            <p>
              Press {openShortcuts && <Keys shortcut={openShortcuts} />}{" "}
              anywhere to open this list.
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="shortcuts-close"
            onClick={close}
            aria-label="Close keyboard shortcuts"
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="shortcuts-body">
          {groups.map((group) => (
            <section key={group} className="shortcuts-group">
              <h3>{group}</h3>
              <dl>
                {shortcuts
                  .filter((shortcut) => shortcut.group === group)
                  .map((shortcut) => (
                    <div key={shortcut.id} className="shortcuts-row">
                      <dt>{shortcut.description}</dt>
                      <dd>
                        <Keys shortcut={shortcut} />
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
