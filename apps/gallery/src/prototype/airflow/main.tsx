/** The prototype on its own page. Open with `/?harness=airflow`. */
import { Toaster } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { airflowIconUrl } from "../../../../../packages/adapter-airflow/src/logo";
import "@northgraindata/dsui-renderer/app.css";
import { Page, SideNav } from "./views";

const readPath = () => location.hash.slice(1) || "/";

function App() {
  const [path, setPath] = useState(readPath);
  useEffect(() => {
    const update = () => {
      setPath(readPath());
      document.querySelector(".ax-main")?.scrollTo(0, 0);
    };
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  return (
    <>
      <div className="ax-app ax-standalone">
        <aside className="ax-sidebar">
          <div className="ax-service">
            <img src={airflowIconUrl} alt="" />
            <div>
              <strong>Airflow</strong>
              <small>
                <i className="ax-dot" data-state="success" />
                production
              </small>
            </div>
          </div>
          <SideNav path={path} />
          <small className="ax-note">Design prototype · invented data</small>
        </aside>
        <main className="ax-main">
          <div className="ax-page">
            <Page path={path} />
          </div>
        </main>
      </div>
      <Toaster />
    </>
  );
}

export function startAirflowPrototype() {
  const root = document.getElementById("root");
  if (root) createRoot(root).render(<App />);
}
