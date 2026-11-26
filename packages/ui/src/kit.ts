/**
 * The contract between the host and extension bundles: what the third argument
 * of `createComponents` holds.
 *
 * A bundle that imported the components would carry its own copy of React, and
 * hooks fail with two copies on one page. So the host passes them in, and an
 * extension imports only these types. This file stays free of implementations,
 * so that importing it never pulls component sources into an extension.
 *
 * This is a public contract: add to it freely, but change or remove with care.
 */
import type { ComponentType, ReactNode } from "react";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export type SelectProps = {
  id?: string;
  name?: string;
  ariaLabel?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  options: readonly SelectOption[];
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** `ghost` drops the frame, for toolbars. */
  variant?: "default" | "ghost";
  size?: "default" | "small";
};

export type UiKit = {
  readonly Select: ComponentType<SelectProps>;
};
