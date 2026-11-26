import { useEffect, useState } from "react";

export type Design = "old" | "new";
const KEY = "dsui-gallery-design";

function initial(): Design {
  const requested = new URLSearchParams(location.search).get("design");
  if (requested === "old" || requested === "new") return requested;
  try {
    return sessionStorage.getItem(KEY) === "new" ? "new" : "old";
  } catch {
    return "old";
  }
}

export function useDesign() {
  const [design, setDesign] = useState(initial);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, design);
    } catch {
      // Private windows may refuse storage; the switch still works.
    }
  }, [design]);
  return [design, setDesign] as const;
}

export function DesignSwitch({
  design,
  onChange,
}: {
  design: Design;
  onChange: (design: Design) => void;
}) {
  return (
    <fieldset className="gallery-design">
      <legend>Design</legend>
      {(["old", "new"] as const).map((value) => (
        <button
          type="button"
          key={value}
          aria-pressed={design === value}
          onClick={() => onChange(value)}
        >
          {value === "old" ? "Old" : "New"}
        </button>
      ))}
    </fieldset>
  );
}

/** Reloads, because the prototype's data is built once. */
export function FailureSwitch() {
  let current = "some";
  try {
    current = sessionStorage.getItem("dsui-prototype-failing") ?? "some";
  } catch {
    // Without storage the prototype always shows failures.
  }
  return (
    <label>
      Failures
      <select
        value={current}
        onChange={(event) => {
          try {
            sessionStorage.setItem(
              "dsui-prototype-failing",
              event.target.value,
            );
          } catch {
            return;
          }
          const search = new URLSearchParams(location.search);
          search.set("shell", "1");
          search.set("design", "new");
          location.search = search.toString();
        }}
      >
        <option value="some">some</option>
        <option value="none">none</option>
      </select>
    </label>
  );
}
