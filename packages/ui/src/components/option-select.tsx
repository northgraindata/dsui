import * as React from "react";
import { createOptionSelect } from "./option-select-factory";

export const OptionSelect = createOptionSelect(React);
export type {
  OptionSelectOption,
  OptionSelectProps,
} from "./option-select-factory";
