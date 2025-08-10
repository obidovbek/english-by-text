import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import "./App.css";
import App from "./App.tsx";
import Folders from "./routes/Folders.tsx";

const rootElement = document.getElementById("root")!;
// Ensure the app spans the full viewport width despite Vite's default body flex styles
(document.body.style as any).display = "block";
(document.body.style as any).margin = "0";
(document.body.style as any).minHeight = "100vh";
(rootElement.style as any).width = "100%";
(rootElement.style as any).minHeight = "100vh";

// Apply Telegram theme params to CSS variables if available
try {
  const tp = (window as any).Telegram?.WebApp?.themeParams;
  if (tp) {
    const root = document.documentElement;
    if (tp.bg_color) root.style.setProperty("--tg-bg", tp.bg_color);
    if (tp.text_color) root.style.setProperty("--tg-text", tp.text_color);
    if (tp.link_color) root.style.setProperty("--tg-accent", tp.link_color);
  }
} catch {}

const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/folders", element: <Folders /> },
]);

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
