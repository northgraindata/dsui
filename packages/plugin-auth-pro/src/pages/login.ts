/**
 * The sign-in page.
 *
 * Declared with `definePage` like any other. It is a public page in a bare
 * shell, so the host serves it before a principal exists; `definePlugin` only
 * allows that for a plugin declaring `security: true`.
 */
import {
  definePage,
  type PluginContext,
} from "@northgraindata/dsui-plugin-sdk";
import { BASE_PATH } from "../base-path.js";
import { SignInForm } from "../components/sign-in-form.js";

/** The plugin's own config, as the sign-in page reads it. */
type AuthConfig = {
  registration: { enabled: boolean };
};

export const loginPage = definePage<"/auth/sign-in", PluginContext<AuthConfig>>(
  {
    path: "/auth/sign-in",
    render: ({ context }) => [
      SignInForm({
        basePath: BASE_PATH,
        registrationEnabled: context.config.registration.enabled,
      }),
    ],
  },
);

export type { AuthConfig };
