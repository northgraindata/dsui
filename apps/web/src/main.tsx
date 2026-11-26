import { Toaster } from "@northgraindata/dsui-ui";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { router } from "./router";
import "@northgraindata/dsui-renderer/app.css";
import "@northgraindata/dsui-adapter-sdk/styles.css";

const rootElement = document.getElementById("root");
if (rootElement)
  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
      <Toaster />
    </StrictMode>,
  );

import "./workspace.css";
import "./connections.css";
