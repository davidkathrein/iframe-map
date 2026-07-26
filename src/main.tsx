import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const isAdminRoute = window.location.pathname.replace(/\/+$/, "") === "/pflege";
document.documentElement.dataset.app = isAdminRoute ? "admin" : "map";
if (isAdminRoute) document.title = "Datenpflege | Kühle Orte im Walgau";

const loadApplication = isAdminRoute
  ? () => import("./AdminApp").then(({ AdminApp }) => AdminApp)
  : () => import("./App").then(({ App }) => App);

void loadApplication().then((Application) => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Application />
    </StrictMode>,
  );
});
