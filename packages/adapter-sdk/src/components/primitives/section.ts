import { defineComponent } from "../define";
import type { PageNode } from "../nodes";

export interface SectionLink {
  label: string;
  path: string;
}

export type PageSectionLink = SectionLink;

export interface SectionProps {
  title: string;
  description?: string;
  link?: SectionLink;
  content: PageNode | readonly PageNode[];
}

export interface SectionNode {
  readonly kind: "section";
  readonly props: SectionProps;
}

export const Section = defineComponent<SectionProps, SectionNode>({
  id: "section",
  render: (props) => {
    if (!props.title) throw new Error("Section requires a title");
    if (props.link?.path && !props.link.path.startsWith("/"))
      throw new Error("Section link path must be absolute");
    return { kind: "section", props: { ...props } };
  },
});
