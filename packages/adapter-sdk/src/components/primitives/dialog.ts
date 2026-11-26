import type { PageNode } from "../nodes";

/** A modal a button or row action opens, usually to create or edit. */
export interface DialogSpec {
  /** May name the record with `{field}` placeholders. */
  title: string;
  description?: string;
  /** Rendered with the row or record as context, such as a `Form`. */
  content: PageNode | readonly PageNode[];
  /** Defaults to false, so typed input is not lost by a stray click. */
  closeOnOutsideClick?: boolean;
}
