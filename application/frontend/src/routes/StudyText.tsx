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
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
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
  const [intervalMs, setIntervalMs] = useState(3000);
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
    <Box sx={{ p: 2, maxWidth: 600, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton
          onClick={() => navigate(-1)}
          aria-label="back"
          sx={{ bgcolor: "action.hover", borderRadius: 2 }}
        >
          <ArrowBack />
        </IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {text?.title ?? "..."}
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="outlined"
            onClick={async () => {
              try {
                const full = await getJSON<any>(`/api/texts/${id}`);
                setEditTitle(full.title || "");
                setEditUzRaw(full.uzRaw || "");
                setEditEnRaw(full.enRaw || "");
                setEditError(null);
                setEditOpen(true);
              } catch (e) {
                setToast(
                  e instanceof Error ? e.message : "Failed to open editor"
                );
              }
            }}
          >
            Edit
          </Button>
          <FormControlLabel
            control={
              <Switch
                checked={autoPlay}
                onChange={(e) => setAutoPlay(e.target.checked)}
              />
            }
            label="Auto"
          />
          <Select
            size="small"
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
          >
            <MenuItem value={2000}>2s</MenuItem>
            <MenuItem value={3000}>3s</MenuItem>
            <MenuItem value={5000}>5s</MenuItem>
          </Select>
          <Typography variant="body2">
            {total ? `${idx + 1} / ${total}` : ""}
          </Typography>
        </Stack>
      </Stack>

      {isLoading ? (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={20} />
          <Typography>Loading…</Typography>
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
                  bgcolor: "action.hover",
                  minWidth: 56,
                }}
              >
                <Typography
                  variant="body2"
                  align="center"
                  sx={{ fontWeight: 700 }}
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
                />
              </Box>
            ))}
          </Stack>

          {/* Show correct sentence when needed */}
          {showCorrect && (
            <Box sx={{ mb: 2, p: 1, borderRadius: 2, bgcolor: "action.hover" }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {t("correctAnswer")}
              </Typography>
              <Typography variant="body1">{currentSentence.en}</Typography>
            </Box>
          )}

          {/* Build-the-sentence mode */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {t("buildTitle")}
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ flexWrap: "wrap", rowGap: 0.75, mb: 1 }}
            >
              {buildPool.map((w, i) => (
                <Button
                  key={`p-${i}`}
                  size="small"
                  variant="outlined"
                  onClick={() => moveWord(w, true)}
                  sx={{ borderRadius: 2, px: 1.25 }}
                >
                  {w}
                </Button>
              ))}
            </Stack>
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
                borderColor: "divider",
                mb: 1,
              }}
            >
              {buildAnswer.map((w, i) => (
                <Button
                  key={`a-${i}`}
                  size="small"
                  variant="contained"
                  onClick={() => moveWord(w, false)}
                  sx={{ borderRadius: 2, px: 1.25 }}
                >
                  {w}
                </Button>
              ))}
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={checkBuilt}>
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
              >
                {t("reset")}
              </Button>
              <Button variant="text" onClick={revealBuilt}>
                {t("reveal")}
              </Button>
            </Stack>
          </Box>

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              disabled={!canPrev}
              onClick={() => setIdx((i) => i - 1)}
            >
              {t("prev")}
            </Button>
            <Button
              variant="contained"
              disabled={!canNext}
              onClick={() => setIdx((i) => i + 1)}
            >
              {t("next")}
            </Button>
          </Stack>
        </>
      ) : (
        <Typography>No sentences</Typography>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit text</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("titleLabel")}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              inputProps={{ maxLength: 200 }}
              fullWidth
            />
            <TextField
              label={t("uzRawLabel")}
              value={editUzRaw}
              onChange={(e) => setEditUzRaw(e.target.value)}
              fullWidth
              multiline
              minRows={6}
            />
            <TextField
              label={t("enRawLabel")}
              value={editEnRaw}
              onChange={(e) => setEditEnRaw(e.target.value)}
              fullWidth
              multiline
              minRows={6}
            />
            {editError && <Alert severity="error">{editError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={isSavingEdit}>
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
                const updated = await patchJSON(`/api/texts/${id}`, {
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
          >
            Save
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
