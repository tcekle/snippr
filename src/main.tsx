import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { RegionSelector } from "./components/RegionSelector";
import { RecToolbar } from "./components/RecToolbar";
import { RecBorder } from "./components/RecBorder";
import { CliRender } from "./cli/CliRender";
import "./index.css";

// Outside Tauri (plain-browser dev for README screenshots) getCurrentWindow throws
let label = "main";
try {
  label = getCurrentWindow().label;
} catch {
  /* not running under Tauri */
}

// `snippr generate` opens this same bundle in a hidden window with ?cli=render.
const isCliRender = (() => {
  try {
    return new URLSearchParams(window.location.search).get("cli") === "render";
  } catch {
    return false;
  }
})();

function rootFor(label: string) {
  if (isCliRender) return <CliRender />;
  if (label.startsWith("rec-toolbar")) return <RecToolbar />;
  if (label.startsWith("rec-border")) return <RecBorder />;
  if (label.startsWith("overlay")) return <RegionSelector />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{rootFor(label)}</React.StrictMode>,
);
