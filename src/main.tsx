import { InstallApp } from "./components/InstallApp";
import "./lib/uuid";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import "./tropical.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <InstallApp />
  </React.StrictMode>,
);
import "./brand-theme.css";
import "./responsive.css";
