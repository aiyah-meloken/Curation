// Map — preview entry point.
// Mounted by index.map.html into #map-root.

import React from "react";
import ReactDOM from "react-dom/client";
import { MapPreviewApp } from "./MapPreviewApp";

const root = document.getElementById("map-root");
if (!root) throw new Error("[map] #map-root mount node not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <MapPreviewApp />
  </React.StrictMode>,
);
