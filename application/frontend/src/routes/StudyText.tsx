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
  const [tokens, setTokens] = useState<TokenDTO[] | null>(null);
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
      setToast("Saved");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Box sx={{ p: 2, maxWidth: 600, mx: "auto", pb: 10 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton
          onClick={() => navigate(-1)}
          aria-label="back"
          sx={{
            bgcolor: "rgba(255, 255, 255, 0.1)",
            borderRadius: 2,
            color: "#ffffff",
            "&:hover": {
              bgcolor: "rgba(255, 255, 255, 0.2)",
              color: "#64b5f6",
            },
          }}
        >
          <ArrowBack />
        </IconButton>
        <Typography
          variant="h6"
          sx={{ flexGrow: 1, color: "#ffffff", fontWeight: 600 }}
        >
          {text?.title ?? "..."}
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2" sx={{ color: "#b0b0b0" }}>
            {total ? `${idx + 1} / ${total}` : ""}
          </Typography>
        </Stack>
      </Stack>

      {isLoading ? (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={20} sx={{ color: "#b0b0b0" }} />
          <Typography sx={{ color: "#ffffff" }}>Loading…</Typography>
        </Stack>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : text && currentSentence ? (
        <>
          <Box sx={{ mb: 2 }}>
            <Typography
              sx={{
                mb: 1,
                lineHeight: 1.35,
                fontWeight: 700,
                fontSize: "clamp(1.25rem, 6vw, 2rem)",
                color: "#ffffff",
              }}
            >
              {currentSentence.uz}
            </Typography>
          </Box>

          {/* Token row */}
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ flexWrap: "wrap", rowGap: 0.75, mb: 2 }}
          >
            {(tokens ?? []).map((tk) => (
              <Box
                key={tk.id}
                sx={{
                  p: 0.75,
                  borderRadius: 1.25,
                  bgcolor: "rgba(255, 255, 255, 0.1)",
                  minWidth: 56,
                }}
              >
                <Typography
                  variant="body2"
                  align="center"
                  sx={{ fontWeight: 700, color: "#ffffff" }}
                >
                  {tk.uz}
                </Typography>
                <TextField
                  size="small"
                  value={tk.en}
                  onChange={(e) =>
                    setTokens((prev) =>
                      prev
                        ? prev.map((t) =>
                            t.id === tk.id ? { ...t, en: e.target.value } : t
                          )
                        : prev
                    )
                  }
                  onBlur={() =>
                    void saveToken(tk.id, {
                      en: tokens!.find((t) => t.id === tk.id)?.en || "",
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  inputProps={{ maxLength: 200 }}
                  sx={{
                    "& .MuiInputBase-input": {
                      color: "#ffffff",
                      fontSize: "0.875rem",
                    },
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                      "&:hover fieldset": {
                        borderColor: "rgba(255, 255, 255, 0.5)",
                      },
                      "&.Mui-focused fieldset": { borderColor: "#64b5f6" },
                    },
                  }}
                />
              </Box>
            ))}
          </Stack>

          {/* Show correct sentence when needed */}
          {showCorrect && (
            <Box
              sx={{
                mb: 2,
                p: 1,
                borderRadius: 2,
                bgcolor: "rgba(255, 255, 255, 0.1)",
              }}
            >
              <Typography variant="caption" sx={{ color: "#b0b0b0" }}>
                {t("correctAnswer")}
              </Typography>
              <Typography variant="body1" sx={{ color: "#ffffff" }}>
                {currentSentence.en}
              </Typography>
            </Box>
          )}

          {/* Build-the-sentence mode */}
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="subtitle1"
              sx={{ mb: 1, color: "#ffffff", fontWeight: 600 }}
            >
              {t("buildTitle")}
            </Typography>

            <Stack
              direction="row"
              spacing={0.75}
              sx={{
                flexWrap: "wrap",
                rowGap: 0.75,
                minHeight: 40,
                p: 0.75,
                borderRadius: 2,
                border: "1px dashed",
                borderColor: "rgba(255, 255, 255, 0.3)",
                mb: 1,
              }}
            >
              {buildAnswer.map((w, i) => (
                <Button
                  key={`a-${i}`}
                  size="small"
                  variant="contained"
                  onClick={() => moveWord(w, false)}
                  sx={{
                    borderRadius: 2,
                    px: 1.25,
                    backgroundColor: "#1976d2",
                    color: "#ffffff",
                    "&:hover": {
                      backgroundColor: "#1565c0",
                    },
                  }}
                >
                  {w}
                </Button>
              ))}
            </Stack>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ flexWrap: "wrap", rowGap: 0.75, mb: 2 }}
            >
              {buildPool.map((w, i) => (
                <Button
                  key={`p-${i}`}
                  size="small"
                  variant="outlined"
                  onClick={() => moveWord(w, true)}
                  sx={{
                    borderRadius: 2,
                    px: 1.25,
                    color: "#ffffff",
                    borderColor: "rgba(255, 255, 255, 0.3)",
                    "&:hover": {
                      borderColor: "#64b5f6",
                      color: "#64b5f6",
                      backgroundColor: "rgba(100, 181, 246, 0.1)",
                    },
                  }}
                >
                  {w}
                </Button>
              ))}
            </Stack>
          </Box>
        </>
      ) : (
        <Typography sx={{ color: "#b0b0b0" }}>No sentences</Typography>
      )}

      {/* Fixed Footer with Action Buttons */}
      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: "rgba(0, 0, 0, 0.9)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          p: 2,
          zIndex: 1000,
        }}
      >
        <Box sx={{ maxWidth: 600, mx: "auto" }}>
          {/* Action buttons row */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 2, justifyContent: "center" }}
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
                minWidth: 80,
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
                minWidth: 80,
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
                minWidth: 80,
              }}
            >
              {t("reveal")}
            </Button>
          </Stack>

          {/* Navigation buttons row */}
          <Stack direction="row" spacing={2} sx={{ justifyContent: "center" }}>
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
                minWidth: 100,
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
                minWidth: 100,
              }}
            >
              {t("next")}
            </Button>
          </Stack>
        </Box>
      </Box>

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
        <DialogTitle sx={{ color: "#ffffff" }}>Edit text</DialogTitle>
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
                setEditError("Please fill all fields correctly");
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
                setToast("Text updated");
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
              "Save"
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
