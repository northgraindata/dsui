export type SplitView = {
  leftId: string;
  rightId: string;
  rightPath?: string;
  rightSearch?: string;
};

export type AdapterTabsState = {
  openedIds: string[];
  split?: SplitView;
};

export type AdapterTabsAction =
  | { type: "open"; id: string }
  | { type: "close"; id: string }
  | { type: "close-split" }
  | { type: "move"; id: string; targetId: string; edge: "before" | "after" }
  | { type: "split"; id: string; targetId: string }
  | { type: "navigate-secondary"; id: string; path: string; search: string }
  | { type: "unsplit" };

export const initialAdapterTabsState: AdapterTabsState = { openedIds: [] };

export type VisibleTab =
  | { kind: "single"; id: string }
  | { kind: "split"; leftId: string; rightId: string };

export function visibleAdapterTabs(state: AdapterTabsState): VisibleTab[] {
  return state.openedIds.flatMap<VisibleTab>((id) => {
    if (id === state.split?.rightId) return [];
    if (id === state.split?.leftId)
      return [
        { kind: "split" as const, leftId: id, rightId: state.split.rightId },
      ];
    return [{ kind: "single" as const, id }];
  });
}

export function adapterTabsReducer(
  state: AdapterTabsState,
  action: AdapterTabsAction,
): AdapterTabsState {
  switch (action.type) {
    case "open":
      return state.openedIds.includes(action.id)
        ? state
        : { ...state, openedIds: [...state.openedIds, action.id] };
    case "close":
      return {
        openedIds: state.openedIds.filter((id) => id !== action.id),
        ...(state.split &&
        state.split.leftId !== action.id &&
        state.split.rightId !== action.id
          ? { split: state.split }
          : {}),
      };
    case "close-split":
      if (!state.split) return state;
      return {
        openedIds: state.openedIds.filter(
          (id) => id !== state.split?.leftId && id !== state.split?.rightId,
        ),
      };
    case "move": {
      if (action.id === action.targetId) return state;
      if (
        !state.openedIds.includes(action.id) ||
        !state.openedIds.includes(action.targetId)
      )
        return state;
      const openedIds = state.openedIds.filter((id) => id !== action.id);
      const targetIndex = openedIds.indexOf(action.targetId);
      openedIds.splice(
        targetIndex + (action.edge === "after" ? 1 : 0),
        0,
        action.id,
      );
      return { ...state, openedIds };
    }
    case "split":
      if (
        action.id === action.targetId ||
        !state.openedIds.includes(action.id) ||
        !state.openedIds.includes(action.targetId)
      )
        return state;
      return {
        ...state,
        split: { leftId: action.targetId, rightId: action.id },
      };
    case "navigate-secondary":
      if (state.split?.rightId !== action.id) return state;
      return {
        ...state,
        split: {
          ...state.split,
          rightPath: action.path,
          rightSearch: action.search,
        },
      };
    case "unsplit":
      return state.split ? { ...state, split: undefined } : state;
  }
}
