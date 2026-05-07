import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

// Electron loads the production build via file:// protocol, which requires HashRouter.
// In the browser (dev or deployed web app), BrowserRouter works normally.
const isElectron = Boolean(window.electronAPI);
const Router = isElectron ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <App />
    </Router>
  </React.StrictMode>
);

