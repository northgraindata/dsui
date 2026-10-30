import { posthog } from "@c15t/integrations/posthog";
import type { C15tClientOptionsExtension } from "c15t/astro";

const token = import.meta.env.PUBLIC_POSTHOG_TOKEN;

/**
 * PostHog loads only after the visitor allows measurement. With no token (local
 * dev, previews) nothing is registered, so no request is ever made.
 */
export default {
  scripts: token
    ? [
        posthog({
          id: token,
          region: "eu",
          loadMode: "after-consent",
          initOptions: {
            cookieless_mode: "never",
            api_host: import.meta.env.PUBLIC_POSTHOG_HOST,
            defaults: "2026-05-30",
          },
        }),
      ]
    : [],
} satisfies C15tClientOptionsExtension;
