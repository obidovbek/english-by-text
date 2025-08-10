import { useEffect, useMemo, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container,
  Box,
  Button,
  Tooltip,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Brightness4, Brightness7 } from "@mui/icons-material";
import { useTelegramAuth } from "./hooks/useTelegramAuth";

function App() {
  const isTWA = Boolean(window.Telegram?.WebApp);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [tgFirstName, setTgFirstName] = useState<string | undefined>(undefined);
  const { user, isLoading, error, isTelegram, login } = useTelegramAuth();

  useEffect(() => {
    if (!isTWA) return;

    const wa = window.Telegram!.WebApp;
    wa.ready();
    wa.expand();

    // Initialize theme from Telegram
    if (wa.colorScheme === "dark" || wa.colorScheme === "light") {
      setMode(wa.colorScheme);
    }

    // Optionally show user's first name when available
    const firstName = wa.initDataUnsafe?.user?.first_name;
    if (firstName) setTgFirstName(firstName);

    // Subscribe to live theme changes
    const handler = () => {
      const scheme = wa.colorScheme;
      if (scheme === "dark" || scheme === "light") {
        setMode(scheme);
      }
    };
    wa.onEvent("themeChanged", handler);

    return () => {
      // offEvent may not exist on older SDKs; guard it
      try {
        wa.offEvent?.("themeChanged", handler);
      } catch {}
    };
  }, [isTWA]);

  // Auto-login on every app open inside Telegram
  useEffect(() => {
    if (isTelegram && !user && !isLoading) {
      login();
    }
  }, [isTelegram, user, isLoading, login]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: { mode },
      }),
    [mode]
  );

  const toggleColorMode = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Uz→En Learning
          </Typography>
          {!isTWA && (
            <IconButton
              color="inherit"
              onClick={toggleColorMode}
              aria-label="toggle theme"
            >
              {mode === "dark" ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="md">
        <Box
          sx={{
            minHeight: "calc(100vh - 64px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            bgcolor: "background.default",
            color: "text.primary",
          }}
        >
          <Typography variant="h3" component="h1" align="center">
            Hello, Uzbek-English Learning App
          </Typography>
          <Typography variant="body1" component="p" align="center">
            Environment: {isTWA ? "Telegram WebApp ✅" : "Browser 🌐"}
            {isTWA && tgFirstName ? ` — Hello, ${tgFirstName}!` : ""}
          </Typography>

          {/* Auth UI */}
          {isTelegram ? (
            isLoading ? (
              <Button
                variant="contained"
                disabled
                startIcon={<CircularProgress size={18} />}
              >
                Logging in...
              </Button>
            ) : user ? (
              <Alert severity="success">Logged in as: {user.firstName}</Alert>
            ) : (
              <Button variant="contained" onClick={login}>
                Login with Telegram
              </Button>
            )
          ) : (
            <Tooltip title="Open inside Telegram to log in">
              {/* span wrapper so Tooltip works on disabled button */}
              <span>
                <Button variant="contained" disabled>
                  Login with Telegram
                </Button>
              </span>
            </Tooltip>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
