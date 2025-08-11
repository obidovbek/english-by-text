import { useEffect, useMemo, useState } from "react";
import {
  ThemeProvider,
  createTheme,
  responsiveFontSizes,
} from "@mui/material/styles";
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
  Menu,
  MenuItem,
} from "@mui/material";
import {
  Brightness4,
  Brightness7,
  Folder as FolderIcon,
  Translate as TranslateIcon,
} from "@mui/icons-material";
import { useTelegramAuth } from "./hooks/useTelegramAuth";
import { useNavigate } from "react-router-dom";
import { ensureInitialLocale, locales, setLocale, t } from "./i18n";

function App() {
  const isTWA = Boolean(window.Telegram?.WebApp);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [tgFirstName, setTgFirstName] = useState<string | undefined>(undefined);
  const { user, isLoading, error, isTelegram, login } = useTelegramAuth();
  const navigate = useNavigate();

  // Initialize locale once
  useEffect(() => {
    ensureInitialLocale();
  }, []);

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

  let theme = useMemo(
    () =>
      createTheme({
        palette: { mode },
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

  theme = responsiveFontSizes(theme);

  const toggleColorMode = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Language menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleLangClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleLangClose = () => setAnchorEl(null);

  const handleSelectLocale = (code: string) => {
    setLocale(code);
    handleLangClose();
    // Force a re-render of strings; simplest is to reload quickly
    window.location.reload();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {t("appTitle")}
          </Typography>
          <Button
            color="inherit"
            startIcon={<FolderIcon />}
            onClick={() => navigate("/folders")}
          >
            {t("folders")}
          </Button>
          <IconButton
            color="inherit"
            onClick={handleLangClick}
            aria-label="language"
          >
            <TranslateIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={open} onClose={handleLangClose}>
            {locales.map((l) => (
              <MenuItem key={l.code} onClick={() => handleSelectLocale(l.code)}>
                {l.label}
              </MenuItem>
            ))}
          </Menu>
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

      <Container maxWidth="sm">
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
            px: 1,
          }}
        >
          <Typography variant="h3" component="h1" align="center">
            {t("helloTitle")}
          </Typography>
          <Typography variant="body1" component="p" align="center">
            {t("environmentTWA")}{" "}
            {isTWA && tgFirstName
              ? ` ${t("andHelloName", { name: tgFirstName })}`
              : ""}
          </Typography>

          {/* Auth UI */}
          {isTelegram ? (
            isLoading ? (
              <Button
                variant="contained"
                disabled
                startIcon={<CircularProgress size={18} />}
              >
                {t("loggingIn")}
              </Button>
            ) : user ? (
              <Alert severity="success">
                {t("loggedInAs")} {user.firstName}
              </Alert>
            ) : (
              <Button variant="contained" onClick={login}>
                {t("loginWithTelegram")}
              </Button>
            )
          ) : (
            <Tooltip title="Open inside Telegram to log in">
              <span>
                <Button variant="contained" disabled>
                  {t("loginWithTelegram")}
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
