import type { ActionTarget } from "../../action";
import { defineComponent } from "../define";
import type { FieldReference } from "./collection";

export interface ButtonProps {
  label: string | FieldReference;
  action?: ActionTarget | FieldReference;
  link?: string | FieldReference;
  icon?: string | FieldReference;
  description?: string | FieldReference;
  kbd?: string | FieldReference;
  confirmation?:
    | {
        title: string;
        description: string;
        confirmLabel?: string;
      }
    | FieldReference;
  variant?: "primary" | "secondary" | "danger" | "list-item";
}

export interface ButtonNode {
  readonly kind: "button";
  readonly props: ButtonProps;
}

export const Button = defineComponent<ButtonProps>({
  id: "button",
  path: "./ui/button",
});
