import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "@northgraindata/dsui-renderer/app.css";
import "@northgraindata/dsui-adapter-sdk/styles.css";
// The web workspace styles own the page gutters and split panes, so the
// gallery loads them to frame pages exactly as the product does.
import "../../web/src/workspace.css";
import "./gallery.css";

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
