import { adapterPages } from "virtual:dsui-adapters";
import { available } from "virtual:dsui-pro-suite";
import type { CatalogEntry } from "./catalog-types";
import { pluginCatalog } from "./plugin-catalog";
import { proCatalog } from "./pro-catalog";
function Coverage() {
  const adapters = [...new Set(adapterPages.map((page) => page.adapter))];
  return (
    <div className="lab-coverage">
      <h2>Official surfaces</h2>
      <p>
        Route and component previews, with synthetic local resources. This is a
        visual workbench, not proof of backend compatibility or every possible
        interaction state.
      </p>
      <h3>Adapters</h3>
      <table>
        <thead>
          <tr>
            <th>Adapter</th>
            <th>Page previews</th>
            <th>Scenarios</th>
          </tr>
        </thead>
        <tbody>
          {adapters.map((adapter) => (
            <tr key={adapter}>
              <th>{adapter}</th>
              <td>
                {adapterPages.filter((page) => page.adapter === adapter).length}
              </td>
              <td>normal · empty · loading · error · stress</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Page definitions are discovered from adapter source at startup and
        build. Changes to adapter source refresh the Lab. Store-backed pages
        currently use initial store state.
      </p>
      <h3>Plugins</h3>
      <table>
        <thead>
          <tr>
            <th>Plugin / surface</th>
            <th>States</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {[...pluginCatalog, ...proCatalog].map((entry) => (
            <tr key={entry.id}>
              <th>
                <a href={`#${entry.id}`}>{entry.title}</a>
              </th>
              <td>{entry.examples.map((example) => example.id).join(" · ")}</td>
              <td>
                {entry.source.startsWith("dsui-pro/")
                  ? available
                    ? "Local Pro source"
                    : "Pro checkout required"
                  : "Workspace source"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Known gaps</h3>
      <ul>
        <li>
          Auth invitation and sign-in submission states need a dedicated fixture
          transport. Sign-in form submission is blocked locally.
        </li>
        <li>
          Code-change patch browsing and additional Investigator session/thread
          combinations are not yet enumerated separately.
        </li>
        <li>
          Adapter resources use generated presentation samples. Add
          resource-specific fixtures before judging detailed values or domain
          behavior.
        </li>
        <li>
          Standalone CodeEditor serialization remains unsupported, as recorded
          in SDK blocks.
        </li>
      </ul>
    </div>
  );
}
export const coverageCatalog: CatalogEntry[] = [
  {
    id: "foundations/coverage",
    title: "Coverage",
    group: "Foundations",
    description:
      "What's in the workshop, where it comes from, and what is still missing.",
    source: "apps/ui-lab/src/coverage.tsx",
    examples: [
      { id: "inventory", title: "Inventory", render: () => <Coverage /> },
    ],
  },
];
