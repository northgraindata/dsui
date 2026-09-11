/** Serialized page returned by an adapter across the server/browser boundary. */
export interface PageDocument {
  path: string;
  nodes: readonly PageNode[];
}

/** A browser-safe node envelope. New adapters may add kinds without changing SDK code. */
export interface PageNode<
  TKind extends string = string,
  TProps = any,
> {
  readonly kind: TKind;
  readonly props: TProps;
}
