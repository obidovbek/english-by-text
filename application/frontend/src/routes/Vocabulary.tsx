import { useEffect, useState, useMemo, useRef } from "react";
import { getJSON, postJSON, deleteJSON, patchJSON } from "../api/client";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Snackbar,
  Alert,
  useTheme,
  LinearProgress,
} from "@mui/material";
import {
  Delete,
  Add,
  Visibility,
  VisibilityOff,
  Edit,
  PlayArrow,
  Mic,
  Stop,
  CheckCircle,
  Cancel,
} from "@mui/icons-material";
import { SwapHoriz } from "@mui/icons-material";
import { t } from "../i18n";
import { useNavigate } from "react-router-dom";
import { ArrowBack } from "@mui/icons-material";

interface VocabItem {
  id: number | string;
  word: string;
  translation: string;
  note?: string | null;
  createdAt?: string;
}

export default function Vocabulary() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [items, setItems] = useState<VocabItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [note, setNote] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Primary display mode: 'word' or 'translation'
  const [primaryField, setPrimaryField] = useState<"word" | "translation">(
    () => {
      try {
        const saved = localStorage.getItem("vocabulary.primary");
        return saved === "translation" ? "translation" : "word";
      } catch {
        return "word";
      }
    }
  );
  useEffect(() => {
    try {
      localStorage.setItem("vocabulary.primary", primaryField);
    } catch {}
  }, [primaryField]);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | string | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [editNote, setEditNote] = useState("");

  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Recording state
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [evaluations, setEvaluations] = useState<
    Record<string, { correct: boolean; similarity: number; transcript: string }>
  >({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Practice session state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionIndex, setSessionIndex] = useState(0);
  const sessionOrderRef = useRef<string[]>([]);
  const sessionActiveRef = useRef(false);
  const [sessionStatus, setSessionStatus] = useState<string>("");
  useEffect(() => {
    sessionActiveRef.current = sessionActive;
  }, [sessionActive]);

  // Very lightweight language guesser for TTS routing
  function detectTtsLanguage(
    text: string | undefined | null
  ): string | undefined {
    const s = (text || "").trim();
    if (!s) return undefined;
    // Scripts
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(s)) return "ja"; // Hiragana/Katakana
    if (/[\uAC00-\uD7AF]/.test(s)) return "ko"; // Hangul
    if (/[\u4E00-\u9FFF]/.test(s)) return "zh"; // CJK Unified Ideographs
    if (/[\u0400-\u04FF]/.test(s)) {
      // Cyrillic: try Uzbek-specific letters else fallback ru
      if (/[ўқғҳЎҚҒҲ]/i.test(s)) return "uz";
      return "ru";
    }
    if (/[\u0600-\u06FF]/.test(s)) return "ar"; // Arabic script (ar/fa/ur) → ar

    // Latin diacritics heuristics
    if (/[ğışİıöüçĞİŞÖÜÇ]/.test(s)) return "tr";
    if (/[äöüßÄÖÜ]/.test(s)) return "de";
    if (/[áéíóúñÁÉÍÓÚÑ]/.test(s)) return "es";
    if (/[çéèêëàâîïôûùÇÉÈÊËÀÂÎÏÔÛÙ]/.test(s)) return "fr";
    // Uzbek Latin apostrophe variants for oʻ, gʻ
    if (/(o['’ʻʼ]u|g['’ʻʼ])/i.test(s)) return "uz";
    // Default to English
    return "en";
  }

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getJSON<VocabItem[]>("/api/vocabulary");
        setItems(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("failed"));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function addItem() {
    const w = word.trim();
    const tr = translation.trim();
    if (!w || !tr) {
      setCreateError(t("pleaseFillAllFieldsCorrectly"));
      return;
    }
    try {
      setIsCreating(true);
      const created = await postJSON<
        { word: string; translation: string; note?: string },
        VocabItem
      >("/api/vocabulary", {
        word: w,
        translation: tr,
        note: note.trim() || undefined,
      });
      setItems((prev) => [created, ...prev]);
      setToast(t("saved"));
      setDialogOpen(false);
      setWord("");
      setTranslation("");
      setNote("");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("failed"));
    } finally {
      setIsCreating(false);
    }
  }

  async function removeItem(id: number | string) {
    try {
      await deleteJSON(`/api/vocabulary/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
      setRevealedIds((prev) => {
        const next = new Set(prev);
        next.delete(String(id));
        return next;
      });
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("failed"));
    }
  }

  function toggleReveal(id: number | string) {
    const key = String(id);
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openEditDialog(item: VocabItem) {
    setEditId(item.id);
    setEditWord(item.word);
    setEditTranslation(item.translation);
    setEditNote(item.note || "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editId) return;
    try {
      setIsSavingEdit(true);
      const updated = await patchJSON<Partial<VocabItem>, VocabItem>(
        `/api/vocabulary/${editId}`,
        {
          word: editWord,
          translation: editTranslation,
          note: editNote,
        }
      );
      setItems((prev) =>
        prev.map((x) => (x.id === editId ? { ...x, ...updated } : x))
      );
      setEditOpen(false);
      setToast(t("saved"));
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("failed"));
    } finally {
      setIsSavingEdit(false);
    }
  }

  const extractErrorText = async (res: Response) => {
    const text = await res.text();
    try {
      const j = text ? JSON.parse(text) : null;
      const msg = j && (j.error || j.message);
      return msg || text || t("failed");
    } catch {
      return text || t("failed");
    }
  };

  async function playTTS(text: string, language?: string) {
    try {
      const res = await fetch(`/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      if (!res.ok) throw new Error(await extractErrorText(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        let resolved = false;
        const cleanup = () => {
          if (resolved) return;
          resolved = true;
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onended = cleanup;
        audio.onerror = cleanup;
        const metaGuard = setTimeout(() => {
          // If metadata never arrives, give a generous timeout to avoid hanging
          setTimeout(cleanup, 15000);
        }, 3000);
        audio.onloadedmetadata = () => {
          clearTimeout(metaGuard);
          const durMs =
            isFinite(audio.duration) && audio.duration > 0
              ? Math.ceil(audio.duration * 1000) + 300
              : 12000;
          setTimeout(cleanup, durMs);
        };
        const p = audio.play();
        if (p && typeof (p as any).then === "function") {
          (p as Promise<void>).catch(() => cleanup());
        }
      });
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("failed"));
    }
  }

  async function startRecordingFor(
    id: string,
    targetText: string,
    language?: string
  ) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      setRecordingId(id);
      setRecording(true);
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        setRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        try {
          const res = await fetch(`/api/stt`, { method: "POST", body: blob });
          if (!res.ok) throw new Error(await extractErrorText(res));
          const { text } = (await res.json()) as { text: string };
          const evRes = await fetch(`/api/evaluate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target: targetText,
              hypothesis: text,
              language,
            }),
          });
          const ev = await evRes.json();
          setEvaluations((prev) => ({
            ...prev,
            [id]: {
              correct: !!ev.correct,
              similarity: ev.similarity ?? 0,
              transcript: text,
            },
          }));
        } catch (e) {
          setToast(e instanceof Error ? e.message : t("failed"));
        }
      };
      mr.start();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("failed"));
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && recording) mr.stop();
  }

  // Auto record for a fixed duration, then evaluate
  async function recordAndEvaluate(
    id: string,
    targetText: string,
    language: string = "en",
    durationMs: number = 3000
  ): Promise<{
    correct: boolean;
    similarity: number;
    transcript: string;
  } | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      setRecordingId(id);
      setRecording(true);
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      const done = new Promise<{
        correct: boolean;
        similarity: number;
        transcript: string;
      } | null>((resolve) => {
        mr.onstop = async () => {
          setRecording(false);
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          try {
            const res = await fetch(`/api/stt`, { method: "POST", body: blob });
            if (!res.ok) throw new Error(await extractErrorText(res));
            const { text } = (await res.json()) as { text: string };
            const evRes = await fetch(`/api/evaluate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                target: targetText,
                hypothesis: text,
                language,
              }),
            });
            const ev = await evRes.json();
            const result = {
              correct: !!ev.correct,
              similarity: ev.similarity ?? 0,
              transcript: text,
            };
            setEvaluations((prev) => ({
              ...prev,
              [id]: result,
            }));
            resolve(result);
          } catch (err) {
            setToast(err instanceof Error ? err.message : t("failed"));
            resolve(null);
          } finally {
            // Stop all tracks from this capture
            stream.getTracks().forEach((trk) => trk.stop());
          }
        };
      });

      mr.start();
      setTimeout(() => {
        if (mediaRecorderRef.current === mr && mr.state !== "inactive")
          mr.stop();
      }, durationMs);
      const res = await done;
      return res;
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("failed"));
      return null;
    }
  }

  async function runSessionFrom(startIdx: number) {
    for (let i = startIdx; i < sessionOrderRef.current.length; i += 1) {
      if (!sessionActiveRef.current) break;
      const id = sessionOrderRef.current[i];
      const item = items.find((x) => String(x.id) === id);
      if (!item) continue;
      const tr = (item.translation || "").trim();
      setSessionStatus(`${i + 1}/${sessionOrderRef.current.length}: listen`);
      if (tr) {
        await playTTS(tr, detectTtsLanguage(tr));
      }
      if (!sessionActiveRef.current) break;
      setSessionStatus(`${i + 1}/${sessionOrderRef.current.length}: speak`);
      const result = await recordAndEvaluate(id, item.word, "en");
      if (!sessionActiveRef.current) break;
      if (result && result.correct) {
        await playTTS(
          result.transcript || item.word,
          detectTtsLanguage(result?.transcript || item.word)
        );
      } else {
        await playTTS(item.word, detectTtsLanguage(item.word));
      }
      if (!sessionActiveRef.current) break;
      setSessionIndex(i + 1);
    }
    setSessionActive(false);
    setSessionStatus("");
  }

  function startPractice() {
    if (!items.length) return;
    // Update UI immediately
    setSessionActive(true);
    setSessionStatus("starting");
    // Preflight mic permission
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        sessionOrderRef.current = items.map((it) => String(it.id));
        setSessionIndex(0);
        void runSessionFrom(0);
      })
      .catch((err) => {
        setToast(err instanceof Error ? err.message : t("failed"));
        setSessionActive(false);
        setSessionStatus("");
      });
  }

  function stopPractice() {
    setSessionActive(false);
    stopRecording();
    setSessionStatus("");
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton onClick={() => navigate(-1)}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h5">{t("vocabulary")}</Typography>
        <Box flexGrow={1} />
        <IconButton
          onClick={() =>
            setPrimaryField((p) => (p === "word" ? "translation" : "word"))
          }
        >
          <SwapHoriz />
        </IconButton>
        {sessionActive ? (
          <Button
            startIcon={<Stop />}
            color="error"
            variant="outlined"
            onClick={stopPractice}
          >
            Stop
          </Button>
        ) : (
          <Button
            startIcon={<PlayArrow />}
            variant="outlined"
            onClick={startPractice}
          >
            Practice
          </Button>
        )}
        {sessionActive && (
          <Typography variant="body2" sx={{ ml: 1 }}>
            {sessionStatus}
          </Typography>
        )}
        <Button
          startIcon={<Add />}
          variant="contained"
          onClick={() => setDialogOpen(true)}
        >
          {t("add")}
        </Button>
      </Stack>

      {isLoading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      <List>
        {items.map((item) => {
          const key = String(item.id);
          const revealed = revealedIds.has(key);
          const evalRes = evaluations[key];
          return (
            <ListItem
              key={key}
              secondaryAction={
                <Stack direction="row" spacing={1} alignItems="center">
                  <IconButton
                    onClick={() =>
                      playTTS(
                        item.translation,
                        detectTtsLanguage(item.translation)
                      )
                    }
                    title="Play"
                  >
                    <PlayArrow />
                  </IconButton>
                  {recording && recordingId === key ? (
                    <IconButton
                      color="error"
                      onClick={stopRecording}
                      title="Stop"
                    >
                      <Stop />
                    </IconButton>
                  ) : (
                    <IconButton
                      onClick={() => startRecordingFor(key, item.word, "en")}
                      title="Speak"
                    >
                      <Mic />
                    </IconButton>
                  )}
                  {evalRes &&
                    (evalRes.correct ? (
                      <CheckCircle color="success" />
                    ) : (
                      <Cancel color="error" />
                    ))}
                  <IconButton onClick={() => openEditDialog(item)}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => removeItem(item.id)}>
                    <Delete />
                  </IconButton>
                </Stack>
              }
            >
              <ListItemText
                primary={primaryField === "word" ? item.word : item.translation}
                secondary={
                  revealed
                    ? primaryField === "word"
                      ? item.translation
                      : item.word
                    : undefined
                }
              />
              <IconButton onClick={() => toggleReveal(item.id)}>
                {revealed ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </ListItem>
          );
        })}
      </List>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth>
        <DialogTitle>{t("add")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("word")}
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
            <TextField
              label={t("translation")}
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
            />
            <TextField
              label={t("note")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
          <Button onClick={addItem} disabled={isCreating} variant="contained">
            {t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth>
        <DialogTitle>{t("edit")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("word")}
              value={editWord}
              onChange={(e) => setEditWord(e.target.value)}
            />
            <TextField
              label={t("translation")}
              value={editTranslation}
              onChange={(e) => setEditTranslation(e.target.value)}
            />
            <TextField
              label={t("note")}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
          <Button
            onClick={saveEdit}
            disabled={isSavingEdit}
            variant="contained"
          >
            {t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        onClose={() => setToast(null)}
        autoHideDuration={3000}
      >
        <Alert severity="info">{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
