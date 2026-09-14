import { navigate } from "astro:transitions/client";
import type { AstroProviderProps } from "fumadocs-core/framework/astro";
import type { Root } from "fumadocs-core/page-tree";
import { GlassLayout } from "fumadocs-ui/layouts/glass";
import { DocsPage, type DocsPageProps } from "fumadocs-ui/layouts/glass/page";
import { RootProvider } from "fumadocs-ui/provider/astro";
import type { ReactNode } from "react";
import Search from "./Search";

const landingUrl = import.meta.env.DEV
  ? "http://localhost:4321"
  : "https://dsui.northgraindata.com";

export function Docs({
  tree,
  children,
  pathname,
  params,
  page,
}: {
  tree: Root;
  children: ReactNode;
  pathname: string;
  params: AstroProviderProps["params"];
  page?: DocsPageProps;
}) {
  return (
    <RootProvider
      pathname={pathname}
      params={params}
      navigate={navigate}
      theme={{ enabled: false }}
      search={{ SearchDialog: Search }}
    >
      <GlassLayout
        tree={tree}
        themeSwitch={{ enabled: false }}
        nav={{
          title: (
            <a
              href={landingUrl}
              aria-label="Go to dsui landing page"
              className="docs-brand inline-flex items-center text-lg font-semibold tracking-tight"
            >
              <img
                src={`${import.meta.env.BASE_URL}/branding/logo-icon.svg`}
                alt=""
                width="24"
                height="24"
                className="size-6"
              />
              dsui
              <span className="nav-subtitle">Docs</span>
            </a>
          ),
        }}
        links={[
          {
            text: "Back to dsui",
            url: "https://dsui.northgraindata.com",
            external: true,
          },
        ]}
        githubUrl="https://github.com/northgraindata/dsui"
      >
        <DocsPage {...page}>{children}</DocsPage>
      </GlassLayout>
    </RootProvider>
  );
}
