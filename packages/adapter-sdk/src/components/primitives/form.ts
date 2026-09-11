import { defineComponent } from "../define";
import type { z } from "zod";
import type { ActionTarget } from "../../action";
import type { PageNode } from "../nodes";

export interface FormProps {
  schema: z.ZodTypeAny;
  fields?: readonly PageNode[];
  onSubmit: ActionTarget | { readonly kind: "action"; readonly id: string };
  submitLabel?: string;
}

export interface FormNode {
  readonly kind: "form";
  readonly props: FormProps;
}

export const Form = defineComponent<FormProps, FormNode>({
  id: "form",
  render: (props) => ({
    kind: "form",
    props: { ...props, fields: props.fields ? [...props.fields] : undefined },
  }),
});
