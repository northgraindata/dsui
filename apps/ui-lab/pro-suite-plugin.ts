import { resolve } from "node:path";
import type { Plugin } from "vite";
export function proSuitePlugin(directory?: string): Plugin {
  return {
    name: "dsui-pro-suite-lab",
    resolveId(id) {
      if (id === "virtual:dsui-pro-suite") return "\0dsui-pro-suite";
    },
    load(id) {
      if (id !== "\0dsui-pro-suite") return;
      if (!directory)
        return "export const available=false; export function ProPluginView(){return null;}";
      const file = (path: string) =>
        JSON.stringify(resolve(directory, "packages", path));
      return `
import * as React from 'react';
import { initializeReact as notificationsReact } from ${file("plugin-notifications-pro/src/components/react.ts")};
import { NotificationScreen } from ${file("plugin-notifications-pro/src/components/screen.tsx")};
import { initializeReact as mcpReact } from ${file("plugin-mcp-pro/src/components/react.ts")};
import { McpScreen } from ${file("plugin-mcp-pro/src/components/screen.tsx")};
import { createComponents as authComponents } from ${file("plugin-auth-pro/src/browser.mjs")};
notificationsReact(React); mcpReact(React);
const auth = authComponents(React);
export const available = true;
export function ProPluginView({plugin,view,client,renderNode}) {
  const h=React.createElement;
  if(plugin==='notifications')return h(NotificationScreen,{node:{props:{props:{tab:view}}},client,renderNode});
  if(plugin==='mcp')return h(McpScreen,{node:{props:{props:{tab:view,requestId:'local-request'}}},client,renderNode});
  if(plugin==='auth')return h(auth['auth-pro/'+view],{node:{props:{props:{basePath:'/__lab_auth_disabled',registrationEnabled:true,name:'Alex Morgan',role:'owner'}}},client,renderNode});
  throw new Error('Unknown Pro plugin: '+plugin);
}`;
    },
  };
}
