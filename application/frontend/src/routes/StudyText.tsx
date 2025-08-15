import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getJSON, patchJSON, postJSON } from "../api/client";
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  Popover,
  Tooltip,
} from "@mui/material";
import { ArrowBack, HelpOutline as HelpOutlineIcon } from "@mui/icons-material";
import { t } from "../i18n";

interface SentenceDTO {
  id: number | string;
  index: number;
  uz: string;
  en: string;
}
interface TokenDTO {
  id: number | string;
  order: number;
  uz: string;
  en: string;
  pos?: string | null;
  note?: string | null;
}
interface TextDTO {
  id: number | string;
  title: string;
  sentences: SentenceDTO[];
}

export default function StudyText() {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { id } = useParams();
  const navigate = useNavigate();
  const [text, setText] = useState<TextDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [tokens, setTokens] = useState<TokenDTO[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  //setAutoPlay
  const [autoPlay] = useState(false);
  const [intervalMs] = useState(3000);
  const timerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [buildPool, setBuildPool] = useState<string[]>([]);
  const [buildAnswer, setBuildAnswer] = useState<string[]>([]);

  // Refs for tour anchors
  const buildAreaRef = useRef<HTMLDivElement | null>(null);
  const poolRef = useRef<HTMLDivElement | null>(null);
  const vocabBtnRef = useRef<HTMLButtonElement | null>(null);
  const editBtnRef = useRef<HTMLButtonElement | null>(null);
  const revealBtnRef = useRef<HTMLButtonElement | null>(null);
  const resetBtnRef = useRef<HTMLButtonElement | null>(null);
  const checkBtnRef = useRef<HTMLButtonElement | null>(null);
  const zoomMinusRef = useRef<HTMLButtonElement | null>(null);
  const zoomPlusRef = useRef<HTMLButtonElement | null>(null);
  const navPrevRef = useRef<HTMLButtonElement | null>(null);
  const navNextRef = useRef<HTMLButtonElement | null>(null);
  const progressRef = useRef<HTMLSpanElement | null>(null);

  // Study page tour
  type Step = {
    key: string;
    title: string;
    body: string;
    anchor?: () => HTMLElement | null;
  };
  const studySteps: Step[] = [
    {
      key: "overview",
      title: t("tourStudyOverviewTitle"),
      body: t("tourStudyOverviewBody"),
    },
    {
      key: "build",
      title: t("tourBuildAreaTitle"),
      body: t("tourBuildAreaBody"),
      anchor: () => buildAreaRef.current,
    },
    {
      key: "pool",
      title: t("tourWordPoolTitle"),
      body: t("tourWordPoolBody"),
      anchor: () => poolRef.current,
    },
    {
      key: "vocab",
      title: t("tourVocabButtonTitle"),
      body: t("tourVocabButtonBody"),
      anchor: () => vocabBtnRef.current,
    },
    {
      key: "edit",
      title: t("tourEditTokensTitle"),
      body: t("tourEditTokensBody"),
      anchor: () => editBtnRef.current,
    },
    {
      key: "reveal",
      title: t("tourRevealTitle"),
      body: t("tourRevealBody"),
      anchor: () => revealBtnRef.current,
    },
    {
      key: "reset",
      title: t("tourResetTitle"),
      body: t("tourResetBody"),
      anchor: () => resetBtnRef.current,
    },
    {
      key: "check",
      title: t("tourCheckTitle"),
      body: t("tourCheckBody"),
      anchor: () => checkBtnRef.current,
    },
    {
      key: "zoom",
      title: t("tourZoomTitle"),
      body: t("tourZoomBody"),
      anchor: () => zoomPlusRef.current || zoomMinusRef.current,
    },
    {
      key: "nav",
      title: t("tourNavTitle"),
      body: t("tourNavBody"),
      anchor: () => navNextRef.current || navPrevRef.current,
    },
    {
      key: "progress",
      title: t("tourProgressTitle"),
      body: t("tourProgressBody"),
      anchor: () => progressRef.current as any,
    },
  ];
  const [openTour, setOpenTour] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  useEffect(() => {
    try {
      const key = "tour-study-v1-done";
      if (!localStorage.getItem(key)) {
        setOpenTour(true);
        setTourIndex(0);
      }
    } catch {}
  }, []);
  const currentStep = openTour ? studySteps[tourIndex] : undefined;
  function nextIndex(from: number): number {
    for (let i = from + 1; i < studySteps.length; i++) {
      const s = studySteps[i];
      if (!s.anchor || s.anchor()) return i;
    }
    return -1;
  }
  const hasNext = nextIndex(tourIndex) !== -1;
  function closeTour() {
    try {
      localStorage.setItem("tour-study-v1-done", "1");
    } catch {}
    setOpenTour(false);
  }
  function goNext() {
    const ni = nextIndex(tourIndex);
    if (ni === -1) closeTour();
    else setTourIndex(ni);
  }
  function restartTour() {
    try {
      localStorage.removeItem("tour-study-v1-done");
    } catch {}
    setOpenTour(true);
    setTourIndex(0);
  }

  // Add-to-vocabulary dialog
  const [vocabOpen, setVocabOpen] = useState(false);
  const [vocabWord, setVocabWord] = useState("");
  const [vocabTranslation, setVocabTranslation] = useState("");
  const [vocabNote, setVocabNote] = useState("");
  const [vocabSaving, setVocabSaving] = useState(false);
  const [vocabError, setVocabError] = useState<string | null>(null);
  const [vocabDropOver, setVocabDropOver] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editUzRaw, setEditUzRaw] = useState("");
  const [editEnRaw, setEditEnRaw] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Toggle for tokens editor
  const [showTokensEditor, setShowTokensEditor] = useState(false);

  // Zoom state (persisted)
  const [zoom, setZoom] = useState(() => {
    try {
      const raw = localStorage.getItem("studyText.zoom");
      const val = raw ? parseFloat(raw) : 1;
      const clamped = Math.min(2, Math.max(0.6, isNaN(val) ? 1 : val));
      return Math.round(clamped * 100) / 100;
    } catch {
      return 1;
    }
  });

  const fontScale = useMemo(() => {
    const base = isSmallScreen ? 1.12 : 1;
    const scaled = Math.min(
      2,
      Math.max(0.8, Math.round(zoom * base * 100) / 100)
    );
    return scaled;
  }, [zoom, isSmallScreen]);

  // Load text
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getJSON<TextDTO>(`/api/texts/${id}`);
        if (!cancelled) {
          setText(data as any);
          setIdx((data as any) ? (data as any).lastIndex ?? 0 : 0);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load text");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const total = text?.sentences.length ?? 0;
  const currentSentence = text && total ? text.sentences[idx] : null;

  // Load or generate tokens for current sentence
  useEffect(() => {
    let cancelled = false;
    async function ensureTokens() {
      if (!currentSentence) {
        setTokens(null);
        return;
      }
      try {
        const tok = await getJSON<TokenDTO[]>(
          `/api/sentences/${currentSentence.id}/tokens`
        );
        if (!cancelled) setTokens(tok);
        if (tok.length === 0) throw new Error("Empty");
      } catch {
        try {
          const created = await postJSON<{}, TokenDTO[]>(
            `/api/sentences/${currentSentence.id}/tokens/generate`,
            {}
          );
          if (!cancelled) setTokens(created);
        } catch (e) {
          if (!cancelled) setTokens([]);
        }
      }
    }
    void ensureTokens();
    return () => {
      cancelled = true;
    };
  }, [currentSentence?.id]);

  // Debounced progress save on index change
  useEffect(() => {
    if (!text) return;
    if (progressTimerRef.current) window.clearTimeout(progressTimerRef.current);
    progressTimerRef.current = window.setTimeout(() => {
      patchJSON(`/api/texts/${text.id}/progress`, { index: idx }).catch(
        () => {}
      );
    }, 300);
    return () => {
      if (progressTimerRef.current)
        window.clearTimeout(progressTimerRef.current);
    };
  }, [idx, text?.id]);

  // Autoplay
  useEffect(() => {
    if (!autoPlay) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    const len = text?.sentences.length ?? 0;
    if (len === 0) return;
    timerRef.current = window.setInterval(() => {
      setIdx((i) => (i + 1 < len ? i + 1 : 0));
    }, intervalMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [autoPlay, intervalMs, text?.sentences.length]);

  // Initialize build pool from sentence.en tokens on sentence change
  useEffect(() => {
    if (!currentSentence) {
      setBuildPool([]);
      setBuildAnswer([]);
      setShowCorrect(false);
      return;
    }
    const parts = (currentSentence.en || "").split(/\s+/).filter(Boolean);
    // Shuffle
    for (let i = parts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [parts[i], parts[j]] = [parts[j], parts[i]];
    }
    setBuildPool(parts);
    setBuildAnswer([]);
    setShowCorrect(false);
  }, [currentSentence?.id]);

  const expected = useMemo(
    () => (currentSentence?.en || "").trim(),
    [currentSentence?.en]
  );
  const built = useMemo(() => buildAnswer.join(" ").trim(), [buildAnswer]);

  function moveWord(word: string, fromPool: boolean) {
    if (fromPool) {
      const idx = buildPool.indexOf(word);
      if (idx >= 0) setBuildPool((p) => p.filter((_, i) => i !== idx));
      setBuildAnswer((a) => [...a, word]);
    } else {
      const idx = buildAnswer.indexOf(word);
      if (idx >= 0) setBuildAnswer((a) => a.filter((_, i) => i !== idx));
      setBuildPool((p) => [...p, word]);
    }
  }

  function openVocabDialog(word: string) {
    setVocabWord(word);
    setVocabTranslation("");
    setVocabNote("");
    setVocabError(null);
    setVocabOpen(true);
  }

  async function saveVocab() {
    const w = vocabWord.trim();
    const tr = vocabTranslation.trim();
    if (!w || !tr) {
      setVocabError(t("pleaseFillAllFieldsCorrectly"));
      return;
    }
    try {
      setVocabSaving(true);
      await postJSON(`/api/vocabulary`, {
        word: w,
        translation: tr,
        note: vocabNote.trim() || undefined,
      });
      setToast(t("saved"));
      setVocabOpen(false);
    } catch (e) {
      setVocabError(e instanceof Error ? e.message : t("failed"));
    } finally {
      setVocabSaving(false);
    }
  }

  function checkBuilt() {
    if (!expected) return;
    if (built === expected) {
      setToast(t("correct"));
      setShowCorrect(false);
      setTimeout(() => setIdx((i) => (i + 1 < total ? i + 1 : 0)), 400);
    } else {
      setToast(t("incorrect"));
      setShowCorrect(true);
    }
  }

  function revealBuilt() {
    const parts = (currentSentence?.en || "").split(/\s+/).filter(Boolean);
    setBuildAnswer(parts);
    setBuildPool([]);
    setShowCorrect(true);
  }

  const canPrev = total > 1;
  const canNext = total > 1;

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")
        setIdx((i) => (i > 0 ? i - 1 : total ? total - 1 : 0));
      if (e.key === "ArrowRight")
        setIdx((i) => (i + 1 < total ? i + 1 : total ? 0 : i));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  // Zoom controls: Ctrl/Cmd + Mouse Wheel
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setZoom((z) => {
          const step = e.deltaY > 0 ? -0.05 : 0.05;
          const next = Math.min(
            2,
            Math.max(0.6, Math.round((z + step) * 100) / 100)
          );
          return next;
        });
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false } as any);
    return () => window.removeEventListener("wheel", onWheel as any);
  }, []);

  // Zoom controls: Keyboard shortcuts (Ctrl/Cmd + '+', '-', '0')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const accel = e.ctrlKey || e.metaKey;
      if (!accel) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(2, Math.round((z + 0.1) * 100) / 100));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 100) / 100));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Persist zoom changes
  useEffect(() => {
    try {
      localStorage.setItem("studyText.zoom", String(zoom));
    } catch {}
  }, [zoom]);

  async function saveToken(
    tokenId: number | string,
    fields: Partial<{ en: string; pos: string; note: string }>
  ) {
    if (!currentSentence) return;
    try {
      const updated = await patchJSON<
        Partial<{ en: string; pos?: string; note?: string }>,
        TokenDTO
      >(`/api/sentences/${currentSentence.id}/tokens/${tokenId}`, fields);
      setTokens((prev) =>
        prev
          ? prev.map((t) =>
              t.id === tokenId ? { ...(t as any), ...updated } : t
            )
          : prev
      );
      setToast(t("saved"));
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("failed"));
    }
  }

  return (
    <Box
      sx={{
        p: 1,
        maxWidth: 600,
        mx: "auto",
        pb: 18,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        color: "text.primary",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <IconButton
          onClick={() => navigate(-1)}
          aria-label={t("back")}
          sx={{
            bgcolor:
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
            borderRadius: 2,
            color: "text.primary",
            "&:hover": {
              bgcolor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.2)"
                  : "rgba(0, 0, 0, 0.2)",
              color: "primary.main",
            },
          }}
        >
          <ArrowBack fontSize="small" />
        </IconButton>
        <Typography
          variant="subtitle1"
          sx={{ flexGrow: 1, color: "text.primary", fontWeight: 600 }}
        >
          {text?.title ?? "..."}
        </Typography>
        <Tooltip title={t("tourRestart")}>
          <IconButton aria-label="show tour" onClick={restartTour}>
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary" }}
          ref={progressRef as any}
        >
          {total ? `${idx + 1}/${total}` : ""}
        </Typography>
      </Stack>

      {isLoading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 4 }}>
          <CircularProgress size={20} sx={{ color: "text.secondary" }} />
          <Typography sx={{ color: "text.primary" }}>{t("loading")}</Typography>
        </Stack>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : text && currentSentence ? (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Uzbek sentence at top center */}
          <Box sx={{ mb: 2, textAlign: "center", px: 1 }}>
            <Typography
              sx={{
                mb: 1,
                lineHeight: 1.3,
                fontWeight: 700,
                fontSize: `clamp(${(1 * fontScale).toFixed(2)}rem, ${
                  4 * fontScale
                }vw, ${(1.4 * fontScale).toFixed(2)}rem)`,
                color: "text.primary",
              }}
            >
              {currentSentence.uz}
            </Typography>
          </Box>

          {/* Show correct sentence when needed */}
          {showCorrect && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                mx: 1,
                borderRadius: 2,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                textAlign: "center",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  display: "block",
                  mb: 0.5,
                  fontSize: `${(0.78 * fontScale).toFixed(3)}rem`,
                }}
              >
                {t("correctAnswer")}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.primary",
                  fontWeight: 500,
                  fontSize: `${(0.95 * fontScale).toFixed(3)}rem`,
                }}
              >
                {currentSentence.en}
              </Typography>
            </Box>
          )}

          {/* English sentence building area - center */}
          <Box
            ref={buildAreaRef}
            sx={{
              mb: 2,
              px: 1,
              flexGrow: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Build area for English sentence */}
            <Box
              sx={{
                minHeight: 50 * fontScale,
                p: 1.5,
                borderRadius: 2,
                border: "1px dashed",
                borderColor:
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.3)"
                    : "rgba(0, 0, 0, 0.3)",
                mb: 2,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.02)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexGrow: 1,
              }}
            >
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  flexWrap: "wrap",
                  rowGap: 0.5,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {buildAnswer.length > 0 ? (
                  buildAnswer.map((w, i) => (
                    <Button
                      key={`a-${i}`}
                      size="small"
                      variant="contained"
                      onClick={() => moveWord(w, false)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openVocabDialog(w);
                      }}
                      sx={{
                        borderRadius: 1.5,
                        px: 1.2,
                        py: 0.4,
                        minHeight: 32 * fontScale,
                        backgroundColor: "primary.main",
                        color: "primary.contrastText",
                        fontSize: `${(0.8 * fontScale).toFixed(3)}rem`,
                        fontWeight: 500,
                        textTransform: "none",
                        "&:hover": {
                          backgroundColor: "primary.dark",
                        },
                        "&:active": {
                          transform: "scale(0.95)",
                        },
                      }}
                    >
                      {w}
                    </Button>
                  ))
                ) : (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontStyle: "italic",
                      textAlign: "center",
                      px: 2,
                      fontSize: `${(0.78 * fontScale).toFixed(3)}rem`,
                    }}
                  >
                    {t("tapWordsBelow")}
                  </Typography>
                )}
              </Stack>
            </Box>

            {/* Word pool at bottom */}
            <Box sx={{ mt: "auto", mb: 1 }} ref={poolRef}>
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  flexWrap: "wrap",
                  rowGap: 0.5,
                  justifyContent: "center",
                }}
              >
                {buildPool.map((w, i) => (
                  <Button
                    key={`p-${i}`}
                    size="small"
                    variant="outlined"
                    onClick={() => moveWord(w, true)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openVocabDialog(w);
                    }}
                    sx={{
                      borderRadius: 1.5,
                      px: 1.2,
                      py: 0.4,
                      minHeight: 32 * fontScale,
                      color: "text.primary",
                      borderColor:
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.4)"
                          : "rgba(0, 0, 0, 0.4)",
                      fontSize: `${(0.8 * fontScale).toFixed(3)}rem`,
                      fontWeight: 500,
                      textTransform: "none",
                      "&:hover": {
                        borderColor: "primary.main",
                        color: "primary.main",
                        backgroundColor: "action.hover",
                      },
                      "&:active": {
                        transform: "scale(0.95)",
                      },
                    }}
                  >
                    {w}
                  </Button>
                ))}
              </Stack>
            </Box>
          </Box>
          {/* Tokens editor (optional) */}
          {showTokensEditor && (
            <Box
              sx={{
                mb: 2,
                px: 1,
                py: 1.5,
                borderRadius: 2,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.06)"
                    : "rgba(0, 0, 0, 0.04)",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  display: "block",
                  mb: 1,
                  fontSize: `${(0.78 * fontScale).toFixed(3)}rem`,
                }}
              >
                {t("edit")}
              </Typography>
              {tokens === null ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress
                    size={16}
                    sx={{ color: "text.secondary" }}
                  />
                  <Typography
                    sx={{
                      color: "text.primary",
                      fontSize: `${(0.95 * fontScale).toFixed(3)}rem`,
                    }}
                  >
                    {t("loading")}
                  </Typography>
                </Stack>
              ) : tokens.length === 0 ? (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    fontSize: `${(0.9 * fontScale).toFixed(3)}rem`,
                  }}
                >
                  {t("noSentences")}
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {tokens.map((tok) => (
                    <Stack
                      key={String(tok.id)}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                    >
                      <Typography
                        sx={{
                          color: "text.primary",
                          minWidth: 80,
                          fontSize: `${(0.95 * fontScale).toFixed(3)}rem`,
                        }}
                      >
                        {tok.uz}
                      </Typography>
                      <TextField
                        size="small"
                        value={tok.en ?? ""}
                        onChange={(e) =>
                          setTokens((prev) =>
                            prev
                              ? prev.map((t) =>
                                  t.id === tok.id
                                    ? { ...(t as any), en: e.target.value }
                                    : t
                                )
                              : prev
                          )
                        }
                        onBlur={(e) =>
                          saveToken(tok.id, { en: e.target.value })
                        }
                        sx={{
                          flex: 1,
                          "& .MuiInputBase-input": {
                            color: "text.primary",
                            fontSize: `${(0.95 * fontScale).toFixed(3)}rem`,
                          },
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": {
                              borderColor:
                                theme.palette.mode === "dark"
                                  ? "rgba(255, 255, 255, 0.3)"
                                  : "rgba(0, 0, 0, 0.3)",
                            },
                            "&:hover fieldset": {
                              borderColor:
                                theme.palette.mode === "dark"
                                  ? "rgba(255, 255, 255, 0.5)"
                                  : "rgba(0, 0, 0, 0.5)",
                            },
                            "&.Mui-focused fieldset": {
                              borderColor: "primary.main",
                            },
                          },
                        }}
                      />
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          )}
          {/* Zoom controls */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: "center", mt: 1 }}
          >
            <Button
              variant="text"
              ref={zoomMinusRef}
              onClick={() =>
                setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 100) / 100))
              }
              aria-label={t("zoomOut")}
            >
              -
            </Button>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                alignSelf: "center",
                minWidth: 44,
                textAlign: "center",
              }}
            >
              {Math.round(zoom * 100)}%
            </Typography>
            <Button
              variant="text"
              ref={zoomPlusRef}
              onClick={() =>
                setZoom((z) => Math.min(2, Math.round((z + 0.1) * 100) / 100))
              }
              aria-label={t("zoomIn")}
            >
              +
            </Button>
            <Button
              variant="text"
              onClick={() => setZoom(1)}
              aria-label={t("resetZoom")}
            >
              100%
            </Button>
          </Stack>
        </Box>
      ) : (
        <Typography
          sx={{ color: "text.secondary", textAlign: "center", py: 4 }}
        >
          {t("noSentences")}
        </Typography>
      )}

      {/* Guided Tour UI */}
      {openTour && currentStep && (
        <Popover
          open={Boolean(!currentStep.anchor || currentStep.anchor())}
          anchorEl={currentStep.anchor ? currentStep.anchor() : null}
          onClose={closeTour}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          transformOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Box sx={{ p: 2, maxWidth: 320 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              {currentStep.title}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {currentStep.body}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button size="small" onClick={closeTour}>
                {t("tourSkip")}
              </Button>
              <Button size="small" variant="contained" onClick={goNext}>
                {hasNext ? t("tourNext") : t("tourDone")}
              </Button>
            </Box>
          </Box>
        </Popover>
      )}

      {/* Fixed Footer with Action Buttons */}
      {text && currentSentence && (
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor:
              theme.palette.mode === "dark"
                ? "rgba(0, 0, 0, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            borderTop: `1px solid ${
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)"
            }`,
            p: 1.5,
            zIndex: 1000,
            boxShadow:
              theme.palette.mode === "dark"
                ? "0 -4px 20px rgba(0, 0, 0, 0.3)"
                : "0 -4px 20px rgba(0, 0, 0, 0.1)",
          }}
        >
          <Box sx={{ maxWidth: 600, mx: "auto" }}>
            {/* Action buttons row */}
            <Stack
              direction="row"
              spacing={1}
              sx={{ mb: 1.5, justifyContent: "center" }}
            >
              <Button
                variant={vocabDropOver ? "contained" : "outlined"}
                onClick={() => {
                  // If clicked without drag, open empty dialog
                  openVocabDialog("");
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setVocabDropOver(true);
                }}
                onDragLeave={() => setVocabDropOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setVocabDropOver(false);
                  const word =
                    e.dataTransfer.getData("application/x-ebt-word") ||
                    e.dataTransfer.getData("text/plain");
                  if (!word) return;
                  openVocabDialog(word);
                }}
                ref={vocabBtnRef}
                sx={{
                  minWidth: 90,
                  borderRadius: 2,
                  color: vocabDropOver
                    ? "primary.contrastText"
                    : "text.primary",
                  borderColor:
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.3)"
                      : "rgba(0, 0, 0, 0.3)",
                  minHeight: 36 * fontScale,
                  fontSize: `${(0.85 * fontScale).toFixed(3)}rem`,
                  fontWeight: 600,
                  textTransform: "none",
                }}
              >
                {t("vocabulary")}
              </Button>
              <Button
                variant="text"
                onClick={() => setShowTokensEditor((v) => !v)}
                ref={editBtnRef}
                sx={{
                  color: showTokensEditor ? "primary.main" : "text.secondary",
                  "&:hover": {
                    color: "primary.main",
                    backgroundColor: "action.hover",
                  },
                  minWidth: 70,
                  minHeight: 36 * fontScale,
                  fontSize: `${(0.8 * fontScale).toFixed(3)}rem`,
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 2,
                  "&:active": {
                    transform: "scale(0.95)",
                  },
                }}
              >
                {t("edit")}
              </Button>
              <Button
                variant="text"
                onClick={revealBuilt}
                ref={revealBtnRef}
                sx={{
                  color: "text.secondary",
                  "&:hover": {
                    color: "primary.main",
                    backgroundColor: "action.hover",
                  },
                  minWidth: 70,
                  minHeight: 36 * fontScale,
                  fontSize: `${(0.8 * fontScale).toFixed(3)}rem`,
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 2,
                  "&:active": {
                    transform: "scale(0.95)",
                  },
                }}
              >
                {t("reveal")}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setBuildAnswer([]);
                  setBuildPool(
                    (currentSentence?.en || "").split(/\s+/).filter(Boolean)
                  );
                }}
                ref={resetBtnRef}
                sx={{
                  color: "text.primary",
                  borderColor:
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.3)"
                      : "rgba(0, 0, 0, 0.3)",
                  "&:hover": {
                    borderColor: "primary.main",
                    color: "primary.main",
                    backgroundColor: "action.hover",
                  },
                  minWidth: 70,
                  minHeight: 36 * fontScale,
                  fontSize: `${(0.8 * fontScale).toFixed(3)}rem`,
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 2,
                  "&:active": {
                    transform: "scale(0.95)",
                  },
                }}
              >
                {t("reset")}
              </Button>
              <Button
                variant="contained"
                onClick={checkBuilt}
                ref={checkBtnRef}
                sx={{
                  backgroundColor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": {
                    backgroundColor: "primary.dark",
                  },
                  minWidth: 70,
                  minHeight: 36 * fontScale,
                  fontSize: `${(0.8 * fontScale).toFixed(3)}rem`,
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 2,
                  "&:active": {
                    transform: "scale(0.95)",
                  },
                }}
              >
                {t("check")}
              </Button>
            </Stack>

            {/* Navigation buttons row */}
            <Stack
              direction="row"
              spacing={2}
              sx={{ justifyContent: "center" }}
            >
              <Button
                variant="outlined"
                disabled={!canPrev}
                onClick={() =>
                  setIdx((i) => (i > 0 ? i - 1 : total ? total - 1 : 0))
                }
                ref={navPrevRef}
                sx={{
                  color: "text.primary",
                  borderColor:
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.3)"
                      : "rgba(0, 0, 0, 0.3)",
                  "&:hover": {
                    borderColor: "primary.main",
                    color: "primary.main",
                    backgroundColor: "action.hover",
                  },
                  "&.Mui-disabled": {
                    color: "text.disabled",
                    borderColor:
                      theme.palette.mode === "dark"
                        ? "rgba(255, 255, 255, 0.12)"
                        : "rgba(0, 0, 0, 0.12)",
                  },
                  minWidth: 80,
                  minHeight: 40 * fontScale,
                  fontSize: `${(0.85 * fontScale).toFixed(3)}rem`,
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 2,
                  "&:active": {
                    transform: "scale(0.95)",
                  },
                }}
              >
                {t("prev")}
              </Button>
              <Button
                variant="contained"
                disabled={!canNext}
                onClick={() => setIdx((i) => (i + 1 < total ? i + 1 : 0))}
                ref={navNextRef}
                sx={{
                  backgroundColor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": {
                    backgroundColor: "primary.dark",
                  },
                  "&.Mui-disabled": {
                    backgroundColor: "action.disabledBackground",
                    color: "text.disabled",
                  },
                  minWidth: 80,
                  minHeight: 40 * fontScale,
                  fontSize: `${(0.85 * fontScale).toFixed(3)}rem`,
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 2,
                  "&:active": {
                    transform: "scale(0.95)",
                  },
                }}
              >
                {t("next")}
              </Button>
            </Stack>
          </Box>
        </Box>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: "background.paper",
            color: "text.primary",
          },
        }}
      >
        <DialogTitle sx={{ color: "text.primary" }}>
          {t("editText")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("titleLabel")}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              inputProps={{ maxLength: 200 }}
              fullWidth
              sx={{
                "& .MuiInputLabel-root": { color: "text.secondary" },
                "& .MuiInputBase-input": { color: "text.primary" },
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "divider" },
                  "&:hover fieldset": {
                    borderColor: "text.secondary",
                  },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
              }}
            />
            <TextField
              label={t("uzRawLabel")}
              value={editUzRaw}
              onChange={(e) => setEditUzRaw(e.target.value)}
              fullWidth
              multiline
              minRows={6}
              sx={{
                "& .MuiInputLabel-root": { color: "text.secondary" },
                "& .MuiInputBase-input": { color: "text.primary" },
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "divider" },
                  "&:hover fieldset": {
                    borderColor: "text.secondary",
                  },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
              }}
            />
            <TextField
              label={t("enRawLabel")}
              value={editEnRaw}
              onChange={(e) => setEditEnRaw(e.target.value)}
              fullWidth
              multiline
              minRows={6}
              sx={{
                "& .MuiInputLabel-root": { color: "text.secondary" },
                "& .MuiInputBase-input": { color: "text.primary" },
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "divider" },
                  "&:hover fieldset": {
                    borderColor: "text.secondary",
                  },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
              }}
            />
            {editError && <Alert severity="error">{editError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditOpen(false)}
            disabled={isSavingEdit}
            sx={{ color: "text.secondary" }}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={async () => {
              const titleTrim = editTitle.trim();
              if (
                titleTrim.length < 1 ||
                titleTrim.length > 200 ||
                !editUzRaw.trim() ||
                !editEnRaw.trim()
              ) {
                setEditError(t("pleaseFillAllFieldsCorrectly"));
                return;
              }
              try {
                setIsSavingEdit(true);
                await patchJSON(`/api/texts/${id}`, {
                  title: titleTrim,
                  uzRaw: editUzRaw,
                  enRaw: editEnRaw,
                });
                // Update local state title immediately
                setText((prev) =>
                  prev ? { ...prev, title: titleTrim } : prev
                );
                setToast(t("textUpdated"));
                setEditOpen(false);
              } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed";
                setEditError(msg);
              } finally {
                setIsSavingEdit(false);
              }
            }}
            variant="contained"
            disabled={isSavingEdit}
            sx={{
              backgroundColor: "primary.main",
              color: "primary.contrastText",
              "&:hover": {
                backgroundColor: "primary.dark",
              },
            }}
          >
            {isSavingEdit ? (
              <CircularProgress
                size={20}
                sx={{ color: "primary.contrastText" }}
              />
            ) : (
              t("save")
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add to vocabulary dialog */}
      <Dialog
        open={vocabOpen}
        onClose={() => setVocabOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ color: "text.primary" }}>
          {t("addToVocabulary")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("wordLabel")}
              value={vocabWord}
              onChange={(e) => setVocabWord(e.target.value)}
            />
            <TextField
              label={t("translationLabel")}
              value={vocabTranslation}
              onChange={(e) => setVocabTranslation(e.target.value)}
            />
            <TextField
              label={t("noteLabel")}
              value={vocabNote}
              onChange={(e) => setVocabNote(e.target.value)}
              multiline
              minRows={3}
            />
            {vocabError && <Alert severity="error">{vocabError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVocabOpen(false)}>{t("cancel")}</Button>
          <Button
            onClick={() => void saveVocab()}
            variant="contained"
            disabled={vocabSaving}
          >
            {vocabSaving ? t("loading") : t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={1200}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </Box>
  );
}
