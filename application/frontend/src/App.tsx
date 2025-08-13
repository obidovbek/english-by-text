import { useEffect, useState } from "react";
import {
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
  Folder as FolderIcon,
  Translate as TranslateIcon,
} from "@mui/icons-material";
import { useTelegramAuth } from "./hooks/useTelegramAuth";
import { useNavigate } from "react-router-dom";
import { ensureInitialLocale, locales, setLocale, t } from "./i18n";

function App() {
  //d
  const isTWA = Boolean(window.Telegram?.WebApp);
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
    console.log("wa", wa);
    wa.ready();
    wa.expand();

    // Optionally show user's first name when available
    const firstName = wa.initDataUnsafe?.user?.first_name;
    if (firstName) setTgFirstName(firstName);
  }, [isTWA]);

  // Auto-login on every app open inside Telegram (guarded for React StrictMode)
  useEffect(() => {
    if (isTelegram && !user && !isLoading) {
      const onceKey = "twa-login-once";
      if (!sessionStorage.getItem(onceKey)) {
        sessionStorage.setItem(onceKey, "1");
        login();
      }
    }
  }, [isTelegram, user, isLoading, login]);

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
    <>
      <AppBar position="static" sx={{ mt: isTWA ? 10 : 0 }}>
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
          <Button color="inherit" onClick={() => navigate("/vocabulary")}>
            Vocabulary
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
              onClick={() => {}} // Theme toggle removed since it's handled globally
              aria-label="toggle theme"
            >
              <Brightness4 />
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
    </>
  );
}

export default App;
