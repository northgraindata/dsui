import { defineComponent, z } from "@northgraindata/dsui-plugin-sdk";

/**
 * The DSUI sign-in form.
 *
 * The screen belongs to this plugin rather than to the web app, so DSUI never
 * learns how a credential is checked and the Enterprise plugin can publish a
 * different form behind the same page contract.
 */
export const SignInForm = defineComponent<{
  basePath: string;
  registrationEnabled: boolean;
}>({
  id: "auth-pro/sign-in",
  path: "./browser.mjs",
  props: z.object({
    basePath: z.string(),
    registrationEnabled: z.boolean(),
  }),
});
