import type { AstroProviderProps } from "fumadocs-core/framework/astro";
import type { Root } from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsPage, type DocsPageProps } from "fumadocs-ui/layouts/docs/page";
import { RootProvider } from "fumadocs-ui/provider/astro";
import type { ReactNode } from "react";
import Search from "./Search";

export function Docs({ tree, children, pathname, params, page }: { tree: Root; children: ReactNode; pathname: string; params: AstroProviderProps["params"]; page?: DocsPageProps }) {
  return <RootProvider pathname={pathname} params={params} navigate={(href) => { window.location.href = href; }} theme={{ enabled: false }} search={{ SearchDialog: Search }}><DocsLayout tree={tree} themeSwitch={{ enabled: false }} nav={{ title: <><strong>dsui</strong><span className="nav-subtitle">Data Stack UI</span></> }} githubUrl="https://github.com/northgraindata/dsui"><DocsPage {...page}>{children}</DocsPage></DocsLayout></RootProvider>;
}
