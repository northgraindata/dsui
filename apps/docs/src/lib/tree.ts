import type { Folder, Item, Node, Root } from "fumadocs-core/page-tree";

export const normalizePath = (path: string): string =>
  path.length > 1 ? path.replace(/\/$/, "") : path;

/** Every page URL under a node, used to find which section is active. */
export function pageUrls(node: Node): string[] {
  if (node.type === "page") return [normalizePath(node.url)];
  if (node.type === "folder") {
    return [
      ...(node.index ? [normalizePath(node.index.url)] : []),
      ...node.children.flatMap(pageUrls),
    ];
  }
  return [];
}

export function folderHref(folder: Folder): string | undefined {
  return folder.index?.url ?? pageUrls(folder)[0];
}

export interface Section {
  name: string;
  href: string;
  active: boolean;
}

/** Top-level folders become the header's section switcher. */
export function sectionsOf(tree: Root, pathname: string): Section[] {
  const active = activeSection(tree, pathname);
  return tree.children.flatMap((node) => {
    if (node.type !== "folder") return [];
    const href = folderHref(node);
    if (!href) return [];
    return [
      {
        name: String(node.name),
        href,
        active: node === active,
      },
    ];
  });
}

/**
 * The top-level folder that holds the current page. Pages outside every
 * folder, such as the home page, belong to the first section, so the sidebar
 * always shows one section's tree.
 */
export function activeSection(
  tree: Root,
  pathname: string,
): Folder | undefined {
  const current = normalizePath(pathname);
  const folders = tree.children.filter(
    (node): node is Folder => node.type === "folder",
  );
  return (
    folders.find((folder) => pageUrls(folder).includes(current)) ?? folders[0]
  );
}

export type { Folder, Item, Node };
