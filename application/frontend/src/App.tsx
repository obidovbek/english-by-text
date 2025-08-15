import { useEffect, useState, useRef, useMemo } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Popover,
  Stack,
} from "@mui/material";
import {
  Brightness4,
  Folder as FolderIcon,
  Translate as TranslateIcon,
  HelpOutline as HelpOutlineIcon,
} from "@mui/icons-material";
import { useTelegramAuth } from "./hooks/useTelegramAuth";
import { useNavigate } from "react-router-dom";
import { ensureInitialLocale, locales, setLocale, t, getLocale } from "./i18n";
import { prewarmAudio, getMicrophoneStream } from "./api/media";
import { patchJSON } from "./api/client";

// Ensure saved locale is applied before first render
ensureInitialLocale();

function App() {
  //d
  const isTWA = Boolean(window.Telegram?.WebApp);
  const [tgFirstName, setTgFirstName] = useState<string | undefined>(undefined);
  const { user, isLoading, error, isTelegram, login } = useTelegramAuth();
  const navigate = useNavigate();

  // Track current locale to recompute tour steps when language changes
  const [localeCode, setLocaleCode] = useState<string>(getLocale());

  // refs for guided tour anchors
  const foldersBtnRef = useRef<HTMLButtonElement | null>(null);
  const vocabBtnRef = useRef<HTMLButtonElement | null>(null);
  const langBtnRef = useRef<HTMLButtonElement | null>(null);
  const loginBtnRef = useRef<HTMLButtonElement | null>(null);

  // Initialize locale once (kept for safety, but top-level call already applied)
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

  // Warm up audio on first tap/click to satisfy autoplay restrictions
  useEffect(() => {
    const handler = () => {
      try {
        prewarmAudio();
      } catch {}
      // Also request microphone permission early in Telegram to reduce repeated prompts
      if (isTWA) {
        setTimeout(async () => {
          try {
            await getMicrophoneStream();
          } catch {
            // Permission denied or error - user will be prompted later when needed
          }
        }, 1000);
      }
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("click", handler);
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("touchstart", handler, { once: true });
    window.addEventListener("click", handler, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("click", handler);
    };
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

  const handleSelectLocale = async (code: string) => {
    setLocale(code);
    try {
      // Persist preference for backend to use in greetings
      await patchJSON("/api/users/me", { languageCode: code });
    } catch {}
    handleLangClose();
    window.location.reload();
  };

  // Guided tour state
  type TourStep = {
    key: string;
    type: "dialog" | "popover";
    title: string;
    body: string;
    anchor?: () => HTMLElement | null;
  };

  const computedSteps = useMemo<TourStep[]>(() => {
    return [
      {
        key: "choose-language",
        type: "dialog",
        title: t("chooseLanguageTitle"),
        body: t("chooseLanguageBody"),
      },
      {
        key: "welcome",
        type: "dialog",
        title: t("tourWelcomeTitle"),
        body: t("tourWelcomeBody"),
      },
      {
        key: "features",
        type: "dialog",
        title: t("tourFeaturesTitle"),
        body: t("tourFeaturesBody"),
      },
      {
        key: "folders",
        type: "popover",
        title: t("tourFoldersTitle"),
        body: t("tourFoldersBody"),
        anchor: () => foldersBtnRef.current,
      },
      {
        key: "vocab",
        type: "popover",
        title: t("tourVocabTitle"),
        body: t("tourVocabBody"),
        anchor: () => vocabBtnRef.current,
      },
      {
        key: "lang",
        type: "popover",
        title: t("tourLangTitle"),
        body: t("tourLangBody"),
        anchor: () => langBtnRef.current,
      },
      {
        key: "login",
        type: "popover",
        title: t("tourLoginTitle"),
        body: t("tourLoginBody"),
        anchor: () => loginBtnRef.current,
      },
    ];
  }, [localeCode]);

  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);

  useEffect(() => {
    try {
      const done = localStorage.getItem("tour-v1-done");
      if (!done) {
        setIsTourOpen(true);
        setTourIndex(0);
      }
    } catch {}
  }, []);

  const currentStep = isTourOpen ? computedSteps[tourIndex] : undefined;

  function findNextValidIndex(from: number): number {
    for (let i = from + 1; i < computedSteps.length; i++) {
      const s = computedSteps[i];
      if (s.type === "dialog") return i;
      if (s.type === "popover" && s.anchor && s.anchor()) return i;
    }
    return -1;
  }

  const hasNext = useMemo(
    () => findNextValidIndex(tourIndex) !== -1,
    [tourIndex]
  );

  useEffect(() => {
    if (!isTourOpen) return;
    const s = computedSteps[tourIndex];
    if (s && s.type === "popover" && (!s.anchor || !s.anchor())) {
      const nextIdx = findNextValidIndex(tourIndex);
      if (nextIdx === -1) completeTour();
      else setTourIndex(nextIdx);
    }
  }, [isTourOpen, tourIndex, computedSteps]);

  function completeTour() {
    try {
      localStorage.setItem("tour-v1-done", "1");
    } catch {}
    setIsTourOpen(false);
  }

  function goNext() {
    const nextIdx = findNextValidIndex(tourIndex);
    if (nextIdx === -1) completeTour();
    else setTourIndex(nextIdx);
  }

  function restartTour() {
    try {
      localStorage.removeItem("tour-v1-done");
    } catch {}
    setIsTourOpen(true);
    setTourIndex(0);
  }

  // Language apply inside choose-language step (no reload; recompute steps)
  async function applyLanguage(code: string) {
    try {
      localStorage.setItem("locale", code);
    } catch {}
    setLocale(code);
    setLocaleCode(code);
    try {
      await patchJSON("/api/users/me", { languageCode: code });
    } catch {}
  }

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
            ref={foldersBtnRef}
          >
            {t("folders")}
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate("/vocabulary")}
            ref={vocabBtnRef}
          >
            {t("vocabulary")}
          </Button>
          <IconButton
            color="inherit"
            onClick={handleLangClick}
            aria-label="language"
            ref={langBtnRef}
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
          <Tooltip title={t("tourRestart")}>
            <IconButton
              color="inherit"
              aria-label="show tour"
              onClick={restartTour}
            >
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
          {!isTWA && (
            <IconButton
              color="inherit"
              onClick={() => {}}
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
            minHeight: "calc(100vh - 144px)",
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
              <Button variant="contained" onClick={login} ref={loginBtnRef}>
                {t("loginWithTelegram")}
              </Button>
            )
          ) : (
            <Tooltip title={t("openInTelegramToLogin")}>
              <span>
                <Button variant="contained" disabled ref={loginBtnRef}>
                  {t("loginWithTelegram")}
                </Button>
              </span>
            </Tooltip>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </Container>

      {/* Guided Tour UI */}
      {isTourOpen && currentStep && currentStep.key === "choose-language" && (
        <Dialog open onClose={goNext} maxWidth="xs" fullWidth>
          <DialogTitle>{currentStep.title}</DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {currentStep.body}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {locales.map((l) => (
                <Button
                  key={l.code}
                  variant="outlined"
                  onClick={() => applyLanguage(l.code)}
                >
                  {l.label}
                </Button>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={goNext}>{t("apply")}</Button>
          </DialogActions>
        </Dialog>
      )}

      {isTourOpen &&
        currentStep &&
        currentStep.type === "dialog" &&
        currentStep.key !== "choose-language" && (
          <Dialog open onClose={completeTour} maxWidth="xs" fullWidth>
            <DialogTitle>{currentStep.title}</DialogTitle>
            <DialogContent>
              <Typography variant="body1" whiteSpace="pre-line">
                {currentStep.body}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={completeTour}>{t("tourSkip")}</Button>
              <Button variant="contained" onClick={goNext}>
                {t("tourNext")}
              </Button>
            </DialogActions>
          </Dialog>
        )}

      {isTourOpen && currentStep && currentStep.type === "popover" && (
        <Popover
          open={Boolean(currentStep.anchor && currentStep.anchor())}
          anchorEl={currentStep.anchor ? currentStep.anchor() : null}
          onClose={completeTour}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          transformOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Box sx={{ p: 2, maxWidth: 280 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              {currentStep.title}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {currentStep.body}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button size="small" onClick={completeTour}>
                {t("tourSkip")}
              </Button>
              <Button size="small" variant="contained" onClick={goNext}>
                {hasNext ? t("tourNext") : t("tourDone")}
              </Button>
            </Box>
          </Box>
        </Popover>
      )}
    </>
  );
}

export default App;
