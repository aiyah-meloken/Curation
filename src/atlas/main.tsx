// Atlas — preview entry point.
// Mounted by index.atlas.html into #atlas-root.

import React from "react";
import ReactDOM from "react-dom/client";
import { AtlasPreviewApp } from "./AtlasPreviewApp";

const root = document.getElementById("atlas-root");
if (!root) throw new Error("[atlas] #atlas-root mount node not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AtlasPreviewApp />
  </React.StrictMode>,
);
