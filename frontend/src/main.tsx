import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const rootElement = document.getElementById("root")!;
// Ensure the app spans the full viewport width despite Vite's default body flex styles
document.body.style.display = "block";
document.body.style.margin = "0";
document.body.style.minHeight = "100vh";
rootElement.style.width = "100vw";
rootElement.style.minHeight = "100vh";

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
