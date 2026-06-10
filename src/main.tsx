import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { RegionSelector } from "./components/RegionSelector";
import { RecToolbar } from "./components/RecToolbar";
import { RecBorder } from "./components/RecBorder";
import { Studio } from "./components/studio/Studio";
import { CliRender } from "./cli/CliRender";
import "./index.css";

// Outside Tauri (plain-browser dev for README screenshots) getCurrentWindow throws
let label = "main";
try {
  label = getCurrentWindow().label;
} catch {
  /* not running under Tauri */
}

// `snippr generate` opens this bundle in a hidden window labelled "cli-render"
// (label-routed so it works under the release asset protocol; the legacy
// ?cli=render query is still honored as a fallback in dev).
const isCliRender =
  label.startsWith("cli-render") ||
  (() => {
    try {
      return new URLSearchParams(window.location.search).get("cli") === "render";
    } catch {
      return false;
    }
  })();

function hasQuery(key: string): boolean {
  try {
    return new URLSearchParams(window.location.search).has(key);
  } catch {
    return false;
  }
}

function rootFor(label: string) {
  if (isCliRender) return <CliRender />;
  if (label.startsWith("rec-toolbar")) return <RecToolbar />;
  if (label.startsWith("rec-border")) return <RecBorder />;
  // ?studio=1 is a plain-browser/dev preview of the Studio shell (no Tauri).
  if (label.startsWith("studio") || hasQuery("studio")) return <Studio />;
  if (label.startsWith("overlay")) return <RegionSelector />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{rootFor(label)}</React.StrictMode>,
);
