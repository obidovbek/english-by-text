import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
  MenuItem,
  ListSubheader,
  useMediaQuery,
  Menu,
  Tooltip,
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
  MoreVert,
  Quiz as QuizIcon,
  ExpandLess,
  ExpandMore,
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

interface VocabPage {
  items: VocabItem[];
  nextCursor?: number;
  nextCursorId?: number;
}

export default function Vocabulary() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
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

  // Pagination state
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
  const [nextCursorId, setNextCursorId] = useState<number | undefined>(
    undefined
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Collapsed day groups
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

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

  // Day filter state
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    try {
      return localStorage.getItem("vocabulary.day") || "all";
    } catch {
      return "all";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("vocabulary.day", selectedDay);
    } catch {}
  }, [selectedDay]);

  function toLocalDay(iso?: string): string | undefined {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return undefined as any;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  const dayOptions = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) {
      const day = toLocalDay(it.createdAt);
      if (day) s.add(day);
    }
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [items]);

  const visibleItems = useMemo(() => {
    if (selectedDay === "all") return items;
    return items.filter((it) => toLocalDay(it.createdAt) === selectedDay);
  }, [items, selectedDay]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, VocabItem[]>();
    for (const it of items) {
      const day = toLocalDay(it.createdAt) || "unknown";
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(it);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => String(b.id).localeCompare(String(a.id)));
    }
    return map;
  }, [items]);

  const loadFirstPage = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const page = await getJSON<VocabPage>(`/api/vocabulary?limit=50`);
      setItems(page.items || []);
      setNextCursor(page.nextCursor);
      setNextCursorId(page.nextCursorId);
      setHasMore(!!page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failed"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore) return;
    if (!hasMore || nextCursor === undefined) return;
    try {
      setIsLoadingMore(true);
      const qs = new URLSearchParams();
      qs.set("limit", "50");
      qs.set("cursor", String(nextCursor));
      if (nextCursorId !== undefined) qs.set("cursorId", String(nextCursorId));
      const page = await getJSON<VocabPage>(`/api/vocabulary?${qs.toString()}`);
      setItems((prev) => [...prev, ...(page.items || [])]);
      setNextCursor(page.nextCursor);
      setNextCursorId(page.nextCursorId);
      setHasMore(!!page.nextCursor);
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("failed"));
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, nextCursor, nextCursorId]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  function toggleDayCollapse(day: string) {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

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

  const totalInSession = sessionOrderRef.current.length;
  const sessionProgress =
    totalInSession > 0
      ? Math.min(100, Math.round((sessionIndex / totalInSession) * 100))
      : 0;

  // Quiz state
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState<
    { id: string; prompt: string; correct: string; choices: string[] }[]
  >([]);
  const [quizLocked, setQuizLocked] = useState(false);

  // More menu (mobile)
  const [moreEl, setMoreEl] = useState<null | HTMLElement>(null);
  const openMore = Boolean(moreEl);
  const openMoreMenu = (e: React.MouseEvent<HTMLElement>) =>
    setMoreEl(e.currentTarget);
  const closeMoreMenu = () => setMoreEl(null);

  function shuffleArray<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildQuiz() {
    const source = shuffleArray(visibleItems).slice(
      0,
      Math.min(visibleItems.length, 12)
    );
    const qs: {
      id: string;
      prompt: string;
      correct: string;
      choices: string[];
    }[] = [];
    for (const base of source) {
      const askWordToTranslation = primaryField === "word";
      const prompt = askWordToTranslation ? base.word : base.translation;
      const correct = askWordToTranslation ? base.translation : base.word;
      const pool = visibleItems.filter((x) => x.id !== base.id);
      const distractors = shuffleArray(pool)
        .slice(0, 3)
        .map((d) => (askWordToTranslation ? d.translation : d.word));
      const choices = shuffleArray([correct, ...distractors]);
      qs.push({ id: String(base.id), prompt, correct, choices });
    }
    setQuizQuestions(qs);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizLocked(false);
  }

  function startQuiz() {
    if (visibleItems.length < 2) {
      setToast("Add more words to start a quiz");
      return;
    }
    buildQuiz();
    setQuizOpen(true);
  }

  function answer(choice: string) {
    if (quizLocked) return;
    setQuizLocked(true);
    const q = quizQuestions[quizIndex];
    const isCorrect = choice === q.correct;
    if (isCorrect) setQuizScore((s) => s + 1);
    setTimeout(() => {
      if (quizIndex + 1 < quizQuestions.length) {
        setQuizIndex((i) => i + 1);
        setQuizLocked(false);
      } else {
        setQuizOpen(false);
        setToast(
          `Score ${quizScore + (isCorrect ? 1 : 0)}/${quizQuestions.length}`
        );
      }
    }, 600);
  }

  // Very lightweight language guesser for TTS routing
  function detectTtsLanguage(
    text: string | undefined | null
  ): string | undefined {
    const s = (text || "").trim();
    if (!s) return undefined;
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(s)) return "ja";
    if (/[\uAC00-\uD7AF]/.test(s)) return "ko";
    if (/[\u4E00-\u9FFF]/.test(s)) return "zh";
    if (/[\u0400-\u04FF]/.test(s)) {
      if (/[ўқғҳЎҚҒҲ]/i.test(s)) return "uz";
      return "ru";
    }
    if (/[\u0600-\u06FF]/.test(s)) return "ar";
    if (/[ğışİıöüçĞİŞÖÜÇ]/.test(s)) return "tr";
    if (/[äöüßÄÖÜ]/.test(s)) return "de";
    if (/[áéíóúñÁÉÍÓÚÑ]/.test(s)) return "es";
    if (/[çéèêëàâîïôûùÇÉÈÊËÀÂÎÏÔÛÙ]/.test(s)) return "fr";
    if (/(o['’ʻʼ]u|g['’ʻʼ])/i.test(s)) return "uz";
    return "en";
  }

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
      const day = toLocalDay(created.createdAt);
      if (selectedDay !== "all" && day && day !== selectedDay) {
        setSelectedDay("all");
      }
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
    if (!visibleItems.length) return;
    setSessionActive(true);
    setSessionStatus("starting");
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        sessionOrderRef.current = visibleItems.map((it) => String(it.id));
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

  function renderListItem(item: VocabItem) {
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
                playTTS(item.translation, detectTtsLanguage(item.translation))
              }
              title="Play"
            >
              <PlayArrow />
            </IconButton>
            {recording && recordingId === key ? (
              <IconButton color="error" onClick={stopRecording} title="Stop">
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
  }

  const togglePrimary = () =>
    setPrimaryField((p) => (p === "word" ? "translation" : "word"));

  return (
    <Box sx={{ p: 2 }}>
      {isMobile ? (
        <>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <IconButton onClick={() => navigate(-1)}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h6">{t("vocabulary")}</Typography>
            <Box flexGrow={1} />
            <Tooltip title="More">
              <IconButton onClick={openMoreMenu}>
                <MoreVert />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={moreEl} open={openMore} onClose={closeMoreMenu}>
              <MenuItem
                onClick={() => {
                  togglePrimary();
                  closeMoreMenu();
                }}
              >
                <SwapHoriz style={{ marginRight: 8 }} /> Toggle
              </MenuItem>
              {sessionActive ? (
                <MenuItem
                  onClick={() => {
                    stopPractice();
                    closeMoreMenu();
                  }}
                >
                  <Stop style={{ marginRight: 8 }} /> Stop Practice
                </MenuItem>
              ) : (
                <MenuItem
                  onClick={() => {
                    startPractice();
                    closeMoreMenu();
                  }}
                >
                  <PlayArrow style={{ marginRight: 8 }} /> Practice
                </MenuItem>
              )}
              <MenuItem
                onClick={() => {
                  startQuiz();
                  closeMoreMenu();
                }}
              >
                <QuizIcon style={{ marginRight: 8 }} /> Quiz
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setDialogOpen(true);
                  closeMoreMenu();
                }}
              >
                <Add style={{ marginRight: 8 }} /> {t("add")}
              </MenuItem>
            </Menu>
          </Stack>

          <Stack spacing={1} sx={{ mb: 1 }}>
            <TextField
              select
              size="small"
              label="Day"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              fullWidth
            >
              <MenuItem value="all">All days</MenuItem>
              {dayOptions.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </TextField>
            {sessionActive && (
              <Stack spacing={0.5}>
                <Typography variant="body2">{sessionStatus}</Typography>
                <LinearProgress variant="determinate" value={sessionProgress} />
              </Stack>
            )}
          </Stack>
        </>
      ) : (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5">{t("vocabulary")}</Typography>
          <Box flexGrow={1} />
          <TextField
            select
            size="small"
            label="Day"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="all">All days</MenuItem>
            {dayOptions.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </TextField>
          <IconButton onClick={togglePrimary}>
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
          <Button variant="outlined" onClick={startQuiz}>
            Quiz
          </Button>
          {sessionActive && (
            <>
              <Typography variant="body2" sx={{ ml: 1 }}>
                {sessionStatus}
              </Typography>
              <Box sx={{ width: 120, ml: 1 }}>
                <LinearProgress variant="determinate" value={sessionProgress} />
              </Box>
            </>
          )}
          <Button
            startIcon={<Add />}
            variant="contained"
            onClick={() => setDialogOpen(true)}
          >
            {t("add")}
          </Button>
        </Stack>
      )}

      {isLoading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {selectedDay === "all" ? (
        <List>
          {dayOptions.map((day) => (
            <li key={day}>
              <ul>
                <ListSubheader
                  disableSticky
                  onClick={() => toggleDayCollapse(day)}
                  sx={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {collapsedDays.has(day) ? (
                    <ExpandMore fontSize="small" />
                  ) : (
                    <ExpandLess fontSize="small" />
                  )}
                  <Box component="span" sx={{ ml: 1 }}>
                    {day}
                  </Box>
                </ListSubheader>
                {!collapsedDays.has(day) &&
                  (groupedByDay.get(day) || []).map((it) => renderListItem(it))}
              </ul>
            </li>
          ))}
        </List>
      ) : (
        <List>{visibleItems.map((item) => renderListItem(item))}</List>
      )}

      <Box ref={sentinelRef} sx={{ height: 1 }} />
      {isLoadingMore && <LinearProgress />}

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
            {createError && <Alert severity="error">{createError}</Alert>}
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

      <Dialog open={quizOpen} onClose={() => setQuizOpen(false)} fullWidth>
        <DialogTitle>Quiz</DialogTitle>
        <DialogContent>
          {quizQuestions.length > 0 && quizIndex < quizQuestions.length && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body1">
                {quizIndex + 1}/{quizQuestions.length}:{" "}
                {quizQuestions[quizIndex].prompt}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {quizQuestions[quizIndex].choices.map((c) => (
                  <Button
                    key={c}
                    variant="outlined"
                    disabled={quizLocked}
                    onClick={() => answer(c)}
                    sx={{ mr: 1, mb: 1 }}
                  >
                    {c}
                  </Button>
                ))}
              </Stack>
              <Typography variant="body2">Score: {quizScore}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuizOpen(false)}>Close</Button>
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
