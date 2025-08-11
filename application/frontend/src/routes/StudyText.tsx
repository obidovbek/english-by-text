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
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
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
  const { id } = useParams();
  const navigate = useNavigate();
  const [text, setText] = useState<TextDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [, setTokens] = useState<TokenDTO[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [intervalMs] = useState(3000);
  const timerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [buildPool, setBuildPool] = useState<string[]>([]);
  const [buildAnswer, setBuildAnswer] = useState<string[]>([]);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editUzRaw, setEditUzRaw] = useState("");
  const [editEnRaw, setEditEnRaw] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
      void patchJSON(`/api/texts/${text.id}/progress`, { index: idx });
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
    if (!text) return;
    timerRef.current = window.setInterval(() => {
      setIdx((i) => {
        if (i + 1 < (text?.sentences.length ?? 0)) return i + 1;
        setAutoPlay(false);
        return i;
      });
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

  function checkBuilt() {
    if (!expected) return;
    if (built === expected) {
      setToast(t("correct"));
      setShowCorrect(false);
      if (canNext) setTimeout(() => setIdx((i) => i + 1), 400);
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

  const canPrev = idx > 0;
  const canNext = idx + 1 < total;

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIdx((i) => (i > 0 ? i - 1 : i));
      if (e.key === "ArrowRight") setIdx((i) => (i + 1 < total ? i + 1 : i));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  // async function saveToken(
  //   tokenId: number | string,
  //   fields: Partial<{ en: string; pos: string; note: string }>
  // ) {
  //   if (!currentSentence) return;
  //   try {
  //     const updated = await patchJSON<
  //       Partial<{ en: string; pos?: string; note?: string }>,
  //       TokenDTO
  //     >(`/api/sentences/${currentSentence.id}/tokens/${tokenId}`, fields);
  //     setTokens((prev) =>
  //       prev
  //         ? prev.map((t) =>
  //             t.id === tokenId ? { ...(t as any), ...updated } : t
  //           )
  //         : prev
  //     );
  //     setToast(t("saved"));
  //   } catch (e) {
  //     setToast(e instanceof Error ? e.message : t("failed"));
  //   }
  // }

  return (
    <Box
      sx={{
        p: 1,
        maxWidth: 600,
        mx: "auto",
        pb: 18,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <IconButton
          onClick={() => navigate(-1)}
          aria-label="back"
          sx={{
            bgcolor: "rgba(255, 255, 255, 0.1)",
            borderRadius: 2,
            color: "#ffffff",
            size: "small",
            "&:hover": {
              bgcolor: "rgba(255, 255, 255, 0.2)",
              color: "#64b5f6",
            },
          }}
        >
          <ArrowBack fontSize="small" />
        </IconButton>
        <Typography
          variant="subtitle1"
          sx={{ flexGrow: 1, color: "#ffffff", fontWeight: 600 }}
        >
          {text?.title ?? "..."}
        </Typography>
        <Typography variant="caption" sx={{ color: "#b0b0b0" }}>
          {total ? `${idx + 1}/${total}` : ""}
        </Typography>
      </Stack>

      {isLoading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 4 }}>
          <CircularProgress size={20} sx={{ color: "#b0b0b0" }} />
          <Typography sx={{ color: "#ffffff" }}>{t("loading")}</Typography>
        </Stack>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : text && currentSentence ? (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Uzbek sentence at top center */}
          <Box sx={{ mb: 2, textAlign: "center", px: 1 }}>
            <Typography
              sx={{
                mb: 1,
                lineHeight: 1.3,
                fontWeight: 700,
                fontSize: "clamp(1rem, 4vw, 1.4rem)",
                color: "#ffffff",
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
                bgcolor: "rgba(255, 255, 255, 0.1)",
                textAlign: "center",
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "#b0b0b0", display: "block", mb: 0.5 }}
              >
                {t("correctAnswer")}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "#ffffff", fontWeight: 500 }}
              >
                {currentSentence.en}
              </Typography>
            </Box>
          )}

          {/* English sentence building area - center */}
          <Box
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
                minHeight: 50,
                p: 1.5,
                borderRadius: 2,
                border: "1px dashed",
                borderColor: "rgba(255, 255, 255, 0.3)",
                mb: 2,
                bgcolor: "rgba(255, 255, 255, 0.05)",
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
                      sx={{
                        borderRadius: 1.5,
                        px: 1.2,
                        py: 0.4,
                        minHeight: 32,
                        backgroundColor: "#1976d2",
                        color: "#ffffff",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        textTransform: "none",
                        "&:hover": {
                          backgroundColor: "#1565c0",
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
                      color: "#b0b0b0",
                      fontStyle: "italic",
                      textAlign: "center",
                      px: 2,
                    }}
                  >
                    {t("tapWordsBelow")}
                  </Typography>
                )}
              </Stack>
            </Box>

            {/* Word pool at bottom */}
            <Box sx={{ mt: "auto", mb: 1 }}>
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
                    sx={{
                      borderRadius: 1.5,
                      px: 1.2,
                      py: 0.4,
                      minHeight: 32,
                      color: "#ffffff",
                      borderColor: "rgba(255, 255, 255, 0.4)",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      textTransform: "none",
                      "&:hover": {
                        borderColor: "#64b5f6",
                        color: "#64b5f6",
                        backgroundColor: "rgba(100, 181, 246, 0.1)",
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
        </Box>
      ) : (
        <Typography sx={{ color: "#b0b0b0", textAlign: "center", py: 4 }}>
          {t("noSentences")}
        </Typography>
      )}

      {/* Fixed Footer with Action Buttons */}
      {text && currentSentence && (
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: "rgba(0, 0, 0, 0.95)",
            backdropFilter: "blur(10px)",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            p: 1.5,
            zIndex: 1000,
            boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.3)",
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
                variant="contained"
                onClick={checkBuilt}
                sx={{
                  backgroundColor: "#1976d2",
                  color: "#ffffff",
                  "&:hover": {
                    backgroundColor: "#1565c0",
                  },
                  minWidth: 70,
                  minHeight: 36,
                  fontSize: "0.8rem",
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
              <Button
                variant="outlined"
                onClick={() => {
                  setBuildAnswer([]);
                  setBuildPool(
                    (currentSentence?.en || "").split(/\s+/).filter(Boolean)
                  );
                }}
                sx={{
                  color: "#ffffff",
                  borderColor: "rgba(255, 255, 255, 0.3)",
                  "&:hover": {
                    borderColor: "#64b5f6",
                    color: "#64b5f6",
                    backgroundColor: "rgba(100, 181, 246, 0.1)",
                  },
                  minWidth: 70,
                  minHeight: 36,
                  fontSize: "0.8rem",
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
                variant="text"
                onClick={revealBuilt}
                sx={{
                  color: "#b0b0b0",
                  "&:hover": {
                    color: "#64b5f6",
                    backgroundColor: "rgba(100, 181, 246, 0.1)",
                  },
                  minWidth: 70,
                  minHeight: 36,
                  fontSize: "0.8rem",
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
                onClick={() => setIdx((i) => i - 1)}
                sx={{
                  color: "#ffffff",
                  borderColor: "rgba(255, 255, 255, 0.3)",
                  "&:hover": {
                    borderColor: "#64b5f6",
                    color: "#64b5f6",
                    backgroundColor: "rgba(100, 181, 246, 0.1)",
                  },
                  "&.Mui-disabled": {
                    color: "rgba(255, 255, 255, 0.3)",
                    borderColor: "rgba(255, 255, 255, 0.12)",
                  },
                  minWidth: 80,
                  minHeight: 40,
                  fontSize: "0.85rem",
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
                onClick={() => setIdx((i) => i + 1)}
                sx={{
                  backgroundColor: "#1976d2",
                  color: "#ffffff",
                  "&:hover": {
                    backgroundColor: "#1565c0",
                  },
                  "&.Mui-disabled": {
                    backgroundColor: "rgba(255, 255, 255, 0.12)",
                    color: "rgba(255, 255, 255, 0.3)",
                  },
                  minWidth: 80,
                  minHeight: 40,
                  fontSize: "0.85rem",
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
            bgcolor: "#424242",
            color: "#ffffff",
          },
        }}
      >
        <DialogTitle sx={{ color: "#ffffff" }}>{t("editText")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("titleLabel")}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              inputProps={{ maxLength: 200 }}
              fullWidth
              sx={{
                "& .MuiInputLabel-root": { color: "#b0b0b0" },
                "& .MuiInputBase-input": { color: "#ffffff" },
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                  "&:hover fieldset": {
                    borderColor: "rgba(255, 255, 255, 0.5)",
                  },
                  "&.Mui-focused fieldset": { borderColor: "#64b5f6" },
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
                "& .MuiInputLabel-root": { color: "#b0b0b0" },
                "& .MuiInputBase-input": { color: "#ffffff" },
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                  "&:hover fieldset": {
                    borderColor: "rgba(255, 255, 255, 0.5)",
                  },
                  "&.Mui-focused fieldset": { borderColor: "#64b5f6" },
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
                "& .MuiInputLabel-root": { color: "#b0b0b0" },
                "& .MuiInputBase-input": { color: "#ffffff" },
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                  "&:hover fieldset": {
                    borderColor: "rgba(255, 255, 255, 0.5)",
                  },
                  "&.Mui-focused fieldset": { borderColor: "#64b5f6" },
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
            sx={{ color: "#b0b0b0" }}
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
              backgroundColor: "#1976d2",
              color: "#ffffff",
              "&:hover": {
                backgroundColor: "#1565c0",
              },
            }}
          >
            {isSavingEdit ? (
              <CircularProgress size={20} sx={{ color: "#ffffff" }} />
            ) : (
              t("save")
            )}
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
