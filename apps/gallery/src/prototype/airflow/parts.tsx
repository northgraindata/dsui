import type { ReactNode } from "react";
import {
  stateName,
  TASK_STATES,
} from "../../../../../packages/adapter-airflow/src/states";
import type { State } from "./data";

export const stateLabel = Object.fromEntries(
  TASK_STATES.map((state) => [state, stateName(state)]),
) as Record<State, string>;

export function Dot({ state }: { state: State }) {
  return <i className="ax-dot" data-state={state} aria-hidden="true" />;
}

export function Pill({
  state,
  children,
}: {
  state: State;
  children?: ReactNode;
}) {
  return (
    <span className="ax-pill" data-state={state}>
      <Dot state={state} />
      {children ?? stateLabel[state]}
    </span>
  );
}

import type { ComponentProps } from "react";
import { Header as PageHeader } from "../shared/ui";
import { Art, type ArtName } from "./icons";

export { Act, go, IconButton, Panel, setNavigator, Tabs } from "../shared/ui";

export function Header({
  art,
  ...props
}: Omit<ComponentProps<typeof PageHeader>, "art"> & { art: ArtName }) {
  return <PageHeader {...props} art={<Art name={art} size={52} />} />;
}
