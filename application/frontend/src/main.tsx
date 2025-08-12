import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import {
  ThemeProvider,
  createTheme,
  responsiveFontSizes,
} from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import "./index.css";
import "./App.css";
import App from "./App.tsx";
import Folders from "./routes/Folders.tsx";
import StudyText from "./routes/StudyText.tsx";
import Vocabulary from "./routes/Vocabulary.tsx";

function AppWrapper() {
  const isTWA = Boolean(window.Telegram?.WebApp);
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (!isTWA) return;

    const wa = window.Telegram!.WebApp;
    wa.ready();
    wa.expand();

    // Initialize theme from Telegram
    if (wa.colorScheme === "dark" || wa.colorScheme === "light") {
      console.log("Setting theme to:", wa.colorScheme);
      setMode(wa.colorScheme);
    }

    // Subscribe to live theme changes
    const handler = () => {
      const scheme = wa.colorScheme;
      if (scheme === "dark" || scheme === "light") {
        console.log("Theme changed to:", scheme);
        setMode(scheme);
      }
    };
    wa.onEvent("themeChanged", handler);

    return () => {
      try {
        wa.offEvent?.("themeChanged", handler);
      } catch {}
    };
  }, [isTWA]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === "dark" && {
            background: {
              default: "#17212b", // Telegram's dark blue-grey background
              paper: "#242f3d", // Telegram's slightly lighter dark blue-grey
            },
            text: {
              primary: "#ffffff",
              secondary: "#a8a8a8",
            },
            primary: {
              main: "#2ea6ff", // Telegram's blue accent color
              dark: "#1e8bd1",
            },
            divider: "rgba(255, 255, 255, 0.12)",
            action: {
              hover: "rgba(255, 255, 255, 0.08)",
              selected: "rgba(255, 255, 255, 0.12)",
              disabled: "rgba(255, 255, 255, 0.3)",
              disabledBackground: "rgba(255, 255, 255, 0.12)",
            },
          }),
        },
        typography: {
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
          h3: { fontWeight: 700 },
          h4: { fontSize: "1.8rem", fontWeight: 700 },
          h6: { fontSize: "1.1rem", fontWeight: 700 },
          body1: { fontSize: "1rem", lineHeight: 1.6 },
          body2: { fontSize: "0.95rem" },
          button: { textTransform: "none", fontWeight: 600 },
        },
        components: {
          MuiButton: {
            defaultProps: { size: "large" },
            styleOverrides: {
              root: {
                minHeight: 44,
                borderRadius: 12,
                paddingLeft: 16,
                paddingRight: 16,
              },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: { width: 44, height: 44, borderRadius: 12 },
            },
          },
          MuiListItemButton: {
            styleOverrides: { root: { minHeight: 48, borderRadius: 12 } },
          },
          MuiTextField: {
            defaultProps: { size: "medium" },
          },
          MuiContainer: {
            styleOverrides: { root: { paddingLeft: 16, paddingRight: 16 } },
          },
        },
      }),
    [mode]
  );

  const responsiveTheme = responsiveFontSizes(theme);

  return (
    <ThemeProvider theme={responsiveTheme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

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
  } else {
    // Fallback to Telegram's default dark theme colors
    const root = document.documentElement;
    root.style.setProperty("--tg-bg", "#17212b");
    root.style.setProperty("--tg-text", "#ffffff");
    root.style.setProperty("--tg-accent", "#2ea6ff");
  }
} catch {
  // Fallback to Telegram's default dark theme colors
  const root = document.documentElement;
  root.style.setProperty("--tg-bg", "#17212b");
  root.style.setProperty("--tg-text", "#ffffff");
  root.style.setProperty("--tg-accent", "#2ea6ff");
}

const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/folders", element: <Folders /> },
  { path: "/texts/:id", element: <StudyText /> },
  { path: "/vocabulary", element: <Vocabulary /> },
]);

createRoot(rootElement).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>
);
