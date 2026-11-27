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
import type { ComponentType, ReactElement, ReactNode } from "react";

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

export type TooltipProps = {
  label: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  /** One element that can take focus and a ref, such as a button. */
  children: ReactElement;
};

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
};

export type MenuProps = {
  /** The button that opens the menu. */
  trigger: ReactElement;
  items: readonly MenuItem[];
  align?: "start" | "end";
};

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names the object, such as "Pause daily_revenue?". */
  title: string;
  /** What happens, including side effects. */
  description: string;
  /** Repeats the verb, such as "Pause DAG". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => unknown;
};

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Defaults to false, so typed input is not lost by a stray click. */
  closeOnOutsideClick?: boolean;
  children: ReactNode;
};

export type NotifyOptions = {
  /** Calls with the same id update one toast. */
  id?: string;
  description?: string;
  /** Offered on errors, such as a safe retry. */
  action?: { label: string; onClick: () => void };
};

export type Notify = {
  success(message: string, options?: Omit<NotifyOptions, "action">): void;
  error(message: string, options?: NotifyOptions): void;
  dismiss(id: string): void;
};

export type UiKit = {
  readonly Select: ComponentType<SelectProps>;
  readonly Tooltip: ComponentType<TooltipProps>;
  readonly Menu: ComponentType<MenuProps>;
  readonly ConfirmDialog: ComponentType<ConfirmDialogProps>;
  readonly Modal: ComponentType<ModalProps>;
  /** Shared with the host, so extension toasts join the same stack. */
  readonly notify: Notify;
};
