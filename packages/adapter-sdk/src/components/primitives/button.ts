import type { ActionTarget } from "../../action";
import { defineComponent } from "../define";
import type { FieldReference } from "./collection";
import type { TableRowLink } from "./table";

export interface ButtonProps {
  label: string | FieldReference;
  action?: ActionTarget | FieldReference;
  successLink?: TableRowLink;
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

export const Button = defineComponent<ButtonProps, ButtonNode>({
  id: "button",
  render: (props) => {
    if (!props.label) throw new Error("Button requires a label");
    if (typeof props.link === "string" && !props.link.startsWith("/"))
      throw new Error("Button link path must be absolute");
    if (props.successLink && !props.successLink.path.startsWith("/"))
      throw new Error("Button successLink path must be absolute");
    return { kind: "button", props: { ...props } };
  },
});
