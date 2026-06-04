import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { RegionSelector } from "./components/RegionSelector";
import "./index.css";

// Outside Tauri (plain-browser dev for README screenshots) getCurrentWindow throws
let label = "main";
try {
  label = getCurrentWindow().label;
} catch {
  /* not running under Tauri */
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {label === "overlay" ? <RegionSelector /> : <App />}
  </React.StrictMode>,
);
