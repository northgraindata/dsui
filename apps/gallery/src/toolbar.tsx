import { SCENARIOS, type Scenario } from "@northgraindata/dsui-ui-fixtures";
import type { ReactNode } from "react";
import "./toolbar.css";

/** Floating gallery controls. `?toolbar=0` hides them for screenshots. */
export function Toolbar({
  scenario,
  onScenario,
  children,
}: {
  scenario: Scenario;
  onScenario: (scenario: Scenario) => void;
  children: ReactNode;
}) {
  return (
    <nav className="gallery-toolbar" aria-label="Gallery controls">
      <a href="/">Gallery</a>
      <label>
        Data
        <select
          value={scenario}
          onChange={(event) => onScenario(event.target.value as Scenario)}
        >
          {SCENARIOS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      {children}
    </nav>
  );
}
