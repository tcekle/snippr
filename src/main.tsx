import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { RegionSelector } from "./components/RegionSelector";
import { RecToolbar } from "./components/RecToolbar";
import { RecBorder } from "./components/RecBorder";
import "./index.css";

// Outside Tauri (plain-browser dev for README screenshots) getCurrentWindow throws
let label = "main";
try {
  label = getCurrentWindow().label;
} catch {
  /* not running under Tauri */
}

function rootFor(label: string) {
  if (label.startsWith("rec-toolbar")) return <RecToolbar />;
  if (label.startsWith("rec-border")) return <RecBorder />;
  if (label.startsWith("overlay")) return <RegionSelector />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{rootFor(label)}</React.StrictMode>,
);
