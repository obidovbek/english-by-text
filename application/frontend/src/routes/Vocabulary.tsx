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
  Popover,
  CircularProgress,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Fab,
  Divider,
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
  Translate as TranslateIcon,
  TextFields as TextFieldsIcon,
  VolumeUp,
  EmojiEvents,
} from "@mui/icons-material";
import { SwapHoriz, HelpOutline as HelpOutlineIcon } from "@mui/icons-material";
import { t } from "../i18n";
import { useNavigate } from "react-router-dom";
import { ArrowBack, ArrowForward } from "@mui/icons-material";
import {
  getMicrophoneStream,
  hasMicrophonePermissionBeenRequested,
} from "../api/media";

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
  const isMobile = useMediaQuery("(max-width:768px)");
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
  const [hiddenNotes, setHiddenNotes] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("vocabulary.hiddenNotes");
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as string[];
      return new Set(arr);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        "vocabulary.hiddenNotes",
        JSON.stringify(Array.from(hiddenNotes))
      );
    } catch {}
  }, [hiddenNotes]);

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
      const day = toLocalDay(it.createdAt) || t("unknown");
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(it);
    }
    //k
    for (const [, arr] of map.entries()) {
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
  const isStartingRecordingRef = useRef(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Practice session state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionIndex, setSessionIndex] = useState(0);
  const sessionOrderRef = useRef<string[]>([]);
  const sessionActiveRef = useRef(false);
  const [sessionStatus, setSessionStatus] = useState<string>("");
  const [streakCount, setStreakCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastAttemptResult, setLastAttemptResult] = useState<
    "correct" | "incorrect" | null
  >(null);
  useEffect(() => {
    sessionActiveRef.current = sessionActive;
  }, [sessionActive]);

  const totalInSession = sessionOrderRef.current.length;
  const sessionProgress =
    totalInSession > 0
      ? Math.min(100, Math.round((sessionIndex / totalInSession) * 100))
      : 0;

  // Practice modal display state
  const [practicePrimary, setPracticePrimary] = useState<
    "word" | "translation"
  >("translation");
  const [practiceDay, setPracticeDay] = useState<string>("all");
  const practiceCardBg = useMemo(() => {
    const primaryLight = theme.palette.primary.light as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const secondaryLight = ((theme.palette as any).secondary?.light ||
      primaryLight) as string;

    if (lastAttemptResult === "correct") {
      return `linear-gradient(135deg, #4caf5022, #66bb6a11)`;
    } else if (lastAttemptResult === "incorrect") {
      return `linear-gradient(135deg, #ff943322, #ffab4011)`;
    }
    return `linear-gradient(135deg, ${primaryLight}22, ${secondaryLight}11)`;
  }, [theme, lastAttemptResult]);

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

  // Per-item overflow menu
  const [itemMenu, setItemMenu] = useState<{
    id: string;
    el: HTMLElement;
  } | null>(null);
  const activeItem = useMemo(
    () => items.find((x) => String(x.id) === (itemMenu?.id || "")),
    [items, itemMenu]
  );
  const closeItemMenu = () => setItemMenu(null);

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
      setToast(t("needMoreForQuiz"));
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
          `${t("scoreLabel")} ${quizScore + (isCorrect ? 1 : 0)}/${
            quizQuestions.length
          }`
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
      if (isStartingRecordingRef.current) return;
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        return;
      }
      isStartingRecordingRef.current = true;

      // Show helpful message on first microphone use
      if (!hasMicrophonePermissionBeenRequested()) {
        setToast(
          t("microphonePermissionInfo", {
            defaultValue: "Microphone access needed for speech practice",
          })
        );
      }

      const stream = await getMicrophoneStream();
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
        mediaRecorderRef.current = null;
        isStartingRecordingRef.current = false;
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
      isStartingRecordingRef.current = false;
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("failed"));
      isStartingRecordingRef.current = false;
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && recording) {
      try {
        mr.stop();
      } catch {}
    }
  }

  // Auto record for a fixed duration, then evaluate
  async function recordAndEvaluate(
    id: string,
    targetText: string,
    language: string = "en",
    durationMs: number = 2000
  ): Promise<{
    correct: boolean;
    similarity: number;
    transcript: string;
  } | null> {
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        return null;
      }
      const stream = await getMicrophoneStream();
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
          mediaRecorderRef.current = null;
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(`/api/stt`, {
              method: "POST",
              body: blob,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(await extractErrorText(res));
            const { text } = (await res.json()) as { text: string };
            const evController = new AbortController();
            const evTimeoutId = setTimeout(() => evController.abort(), 5000);
            const evRes = await fetch(`/api/evaluate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                target: targetText,
                hypothesis: text,
                language,
              }),
              signal: evController.signal,
            });
            clearTimeout(evTimeoutId);
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
            if (err instanceof Error && err.name === "AbortError") {
              setToast(t("failed") + " (timeout)");
            } else {
              setToast(err instanceof Error ? err.message : t("failed"));
            }
            resolve(null);
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
      setSessionStatus(
        `${i + 1}/${sessionOrderRef.current.length}: ${t("listenAction")}`
      );
      if (tr) {
        await playTTS(tr, detectTtsLanguage(tr));
      }
      if (!sessionActiveRef.current) break;
      setSessionStatus(
        `${i + 1}/${sessionOrderRef.current.length}: ${t("speakAction")}`
      );
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
    const initialSource =
      selectedDay === "all"
        ? items
        : items.filter((it) => toLocalDay(it.createdAt) === selectedDay);
    if (!initialSource.length) {
      setToast(t("noSentences"));
      return;
    }
    sessionOrderRef.current = initialSource.map((it) => String(it.id));
    setSessionIndex(0);
    setSessionActive(true);
    setSessionStatus("");
    setPracticePrimary("translation");
    setPracticeDay(selectedDay);
  }

  function stopPractice() {
    setSessionActive(false);
    stopRecording();
    setSessionStatus("");
    setStreakCount(0);
    setShowCelebration(false);
    setLastAttemptResult(null);
  }

  function toggleNoteVisibility(id: number | string) {
    const key = String(id);
    setHiddenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderListItem(item: VocabItem) {
    const key = String(item.id);
    const revealed = revealedIds.has(key);
    const noteHidden = hiddenNotes.has(key);
    const evalRes = evaluations[key];
    const desktopActions = (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Tooltip title={t("play")}>
          <IconButton
            size="small"
            onClick={() =>
              playTTS(item.translation, detectTtsLanguage(item.translation))
            }
          >
            <PlayArrow fontSize="small" />
          </IconButton>
        </Tooltip>
        {recording && recordingId === key ? (
          <Tooltip title={t("stop")}>
            <IconButton color="error" size="small" onClick={stopRecording}>
              <Stop fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title={t("speak")}>
            <IconButton
              size="small"
              onClick={() => startRecordingFor(key, item.word, "en")}
            >
              <Mic fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {evalRes &&
          (evalRes.correct ? (
            <CheckCircle color="success" fontSize="small" />
          ) : (
            <Cancel color="error" fontSize="small" />
          ))}
        <Tooltip title={noteHidden ? t("showNotes") : t("hideNotes")}>
          <IconButton
            size="small"
            onClick={() => toggleNoteVisibility(item.id)}
          >
            {noteHidden ? <Visibility /> : <VisibilityOff />}
          </IconButton>
        </Tooltip>
        <Tooltip title={t("edit")}>
          <IconButton size="small" onClick={() => openEditDialog(item)}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("delete")}>
          <IconButton size="small" onClick={() => removeItem(item.id)}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    );
    return (
      <ListItem
        key={key}
        dense
        alignItems="flex-start"
        secondaryAction={
          isMobile ? (
            <IconButton
              size="small"
              onClick={(e) => setItemMenu({ id: key, el: e.currentTarget })}
              aria-label="more"
            >
              <MoreVert />
            </IconButton>
          ) : (
            desktopActions
          )
        }
      >
        <ListItemText
          primary={primaryField === "word" ? item.word : item.translation}
          secondary={
            noteHidden
              ? undefined
              : item.note && item.note.trim().length > 0
              ? item.note
              : revealed
              ? primaryField === "word"
                ? item.translation
                : item.word
              : undefined
          }
          primaryTypographyProps={{ noWrap: true }}
          secondaryTypographyProps={{
            variant: "body2",
            color: "text.secondary",
            sx: { whiteSpace: "pre-wrap" },
          }}
        />
        {!isMobile && (
          <IconButton size="small" onClick={() => toggleReveal(item.id)}>
            {revealed ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        )}
        {isMobile && <></>}
      </ListItem>
    );
  }

  const togglePrimary = () =>
    setPrimaryField((p) => (p === "word" ? "translation" : "word"));

  // Refs for tour anchors
  const dayFilterRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const practiceRef = useRef<HTMLButtonElement | null>(null);
  const quizRef = useRef<HTMLButtonElement | null>(null);
  const addRef = useRef<HTMLButtonElement | null>(null);

  // Tour
  type Step = {
    key: string;
    title: string;
    body: string;
    anchor?: () => HTMLElement | null;
  };
  const steps: Step[] = [
    {
      key: "overview",
      title: t("tourVocabOverviewTitle"),
      body: t("tourVocabOverviewBody"),
    },
    {
      key: "day",
      title: t("tourDayFilterTitle"),
      body: t("tourDayFilterBody"),
      anchor: () => dayFilterRef.current,
    },
    {
      key: "toggle",
      title: t("tourToggleDisplayTitle"),
      body: t("tourToggleDisplayBody"),
      anchor: () => toggleRef.current,
    },
    {
      key: "practice",
      title: t("tourPracticeTitle"),
      body: t("tourPracticeBody"),
      anchor: () => practiceRef.current,
    },
    {
      key: "quiz",
      title: t("tourQuizButtonTitle"),
      body: t("tourQuizButtonBody"),
      anchor: () => quizRef.current,
    },
    {
      key: "add",
      title: t("tourAddButtonTitle"),
      body: t("tourAddButtonBody"),
      anchor: () => addRef.current,
    },
  ];
  const [openTour, setOpenTour] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  useEffect(() => {
    try {
      const key = "tour-vocab-v1-done";
      if (!localStorage.getItem(key)) {
        setOpenTour(true);
        setTourIndex(0);
      }
    } catch {}
  }, []);
  const currentStep = openTour ? steps[tourIndex] : undefined;
  function nextIndex(from: number): number {
    for (let i = from + 1; i < steps.length; i++) {
      const s = steps[i];
      if (!s.anchor || s.anchor()) return i;
    }
    return -1;
  }
  const hasNext = nextIndex(tourIndex) !== -1;
  function closeTour() {
    try {
      localStorage.setItem("tour-vocab-v1-done", "1");
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
      localStorage.removeItem("tour-vocab-v1-done");
    } catch {}
    setOpenTour(true);
    setTourIndex(0);
  }

  // Practice modal helpers
  const currentPracticeId = sessionOrderRef.current[sessionIndex];
  const currentPracticeItem = items.find(
    (x) => String(x.id) === String(currentPracticeId)
  );
  const canPrev = sessionIndex > 0;
  const canNext = sessionIndex + 1 < sessionOrderRef.current.length;
  const goPracticePrev = () => {
    if (canPrev) setSessionIndex((i) => i - 1);
  };
  const goPracticeNext = () => {
    if (canNext) setSessionIndex((i) => i + 1);
  };

  // Varied feedback messages
  const correctMessages = [
    "Excellent!",
    "Perfect!",
    "Well done!",
    "Fantastic!",
    "Great job!",
    "Outstanding!",
    "Brilliant!",
    "Superb!",
    "Amazing!",
    "You nailed it!",
  ];

  const encouragementMessages = [
    "Keep trying!",
    "Almost there!",
    "You can do it!",
    "Good effort!",
    "Try again!",
    "Getting closer!",
    "Don't give up!",
    "One more time!",
  ];

  const getRandomMessage = (messages: string[]) =>
    messages[Math.floor(Math.random() * messages.length)];

  const shouldConsiderCorrect = (
    similarity: number,
    transcript: string,
    target: string
  ) => {
    // More lenient evaluation for speech recognition
    if (similarity >= 0.7) return true;

    // Check for phonetic similarity or common mispronunciations
    const cleanTranscript = transcript
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();
    const cleanTarget = target
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

    // If words are very close in length and sound
    if (Math.abs(cleanTranscript.length - cleanTarget.length) <= 2) {
      const charMatches = cleanTranscript
        .split("")
        .filter((char, i) => cleanTarget[i] === char).length;
      const matchPercentage =
        charMatches / Math.max(cleanTranscript.length, cleanTarget.length);
      if (matchPercentage >= 0.75) return true;
    }

    // Check if key parts of the word are correct
    const targetWords = cleanTarget.split(" ");
    const transcriptWords = cleanTranscript.split(" ");
    if (targetWords.length === transcriptWords.length) {
      let correctWords = 0;
      for (let i = 0; i < targetWords.length; i++) {
        const tWord = targetWords[i];
        const trWord = transcriptWords[i];
        if (tWord === trWord || Math.abs(tWord.length - trWord.length) <= 1) {
          correctWords++;
        }
      }
      if (correctWords / targetWords.length >= 0.7) return true;
    }

    return false;
  };

  const triggerCelebration = () => {
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 2000);
  };

  const getPronunciationHint = (word: string) => {
    // Simple pronunciation hints for common difficult words
    const hints: Record<string, string> = {
      thought: "th-awt",
      through: "th-roo",
      enough: "i-nuhf",
      laugh: "laff",
      cough: "kawf",
      rough: "ruhf",
      tough: "tuhf",
      colonel: "ker-nal",
      psychology: "sy-kol-uh-jee",
      schedule: "sked-yool",
    };
    return hints[word.toLowerCase()];
  };

  const speakAndEvaluateCurrent = async () => {
    if (!currentPracticeItem || !currentPracticeId) return;
    try {
      setIsEvaluating(true);
      const res = await recordAndEvaluate(
        String(currentPracticeId),
        currentPracticeItem.word,
        "en",
        2000
      );
      if (res) {
        const isActuallyCorrect =
          res.correct ||
          shouldConsiderCorrect(
            res.similarity,
            res.transcript,
            currentPracticeItem.word
          );

        if (isActuallyCorrect) {
          const newStreak = streakCount + 1;
          setStreakCount(newStreak);
          setLastAttemptResult("correct");

          // Update evaluation to show as correct
          setEvaluations((prev) => ({
            ...prev,
            [currentPracticeId]: {
              ...res,
              correct: true,
              similarity: Math.max(res.similarity, 0.8), // Boost similarity display
            },
          }));

          let message = getRandomMessage(correctMessages);
          if (newStreak >= 5) {
            message = `${message} ${newStreak} in a row! 🔥`;
            triggerCelebration();
          } else if (newStreak >= 3) {
            message = `${message} Streak: ${newStreak}! 🌟`;
          }

          await playTTS(message, "en");
        } else {
          setStreakCount(0);
          setLastAttemptResult("incorrect");
          const message = getRandomMessage(encouragementMessages);

          // Add pronunciation hint after 2 failed attempts
          const hint = getPronunciationHint(currentPracticeItem.word);
          if (hint && res.similarity < 0.5) {
            setTimeout(async () => {
              await playTTS(`Try pronouncing it like: ${hint}`, "en");
            }, 2000);
          }

          await playTTS(message, "en");
        }
      }
    } finally {
      setIsEvaluating(false);
    }
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if (!sessionActive) return;
    setTouchStartX(e.changedTouches[0]?.clientX ?? null);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!sessionActive) return;
    if (touchStartX == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    const threshold = 60;
    if (dx > threshold) {
      goPracticePrev();
    } else if (dx < -threshold) {
      goPracticeNext();
    }
    setTouchStartX(null);
  };
  const playPrompt = async () => {
    if (!currentPracticeItem) return;
    const txt =
      practicePrimary === "translation"
        ? currentPracticeItem.translation
        : currentPracticeItem.word;
    if (!txt) return;
    await playTTS(txt, detectTtsLanguage(txt));
  };

  // Update practice session items when day inside modal changes
  useEffect(() => {
    if (!sessionActive) return;
    const source =
      practiceDay === "all"
        ? items
        : items.filter((it) => toLocalDay(it.createdAt) === practiceDay);
    const newIds = source.map((it) => String(it.id));
    const prevIds = sessionOrderRef.current;
    const currentId = prevIds[sessionIndex];
    const changed =
      newIds.length !== prevIds.length ||
      newIds.some((id, i) => prevIds[i] !== id);
    if (!changed) return;

    sessionOrderRef.current = newIds;
    if (currentId) {
      const idx = newIds.indexOf(currentId);
      setSessionIndex(idx >= 0 ? idx : 0);
    } else {
      setSessionIndex(0);
    }
  }, [practiceDay, items, sessionActive, sessionIndex]);

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
            <Tooltip title={t("more")}>
              <IconButton onClick={openMoreMenu}>
                <MoreVert />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("tourRestart")}>
              <IconButton onClick={restartTour}>
                <HelpOutlineIcon />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={moreEl} open={openMore} onClose={closeMoreMenu}>
              <MenuItem
                onClick={() => {
                  togglePrimary();
                  closeMoreMenu();
                }}
              >
                <SwapHoriz style={{ marginRight: 8 }} /> {t("toggle")}
              </MenuItem>
              {sessionActive ? (
                <MenuItem
                  onClick={() => {
                    stopPractice();
                    closeMoreMenu();
                  }}
                >
                  <Stop style={{ marginRight: 8 }} /> {t("stopPractice")}
                </MenuItem>
              ) : (
                <MenuItem
                  onClick={() => {
                    startPractice();
                    closeMoreMenu();
                  }}
                >
                  <PlayArrow style={{ marginRight: 8 }} /> {t("practice")}
                </MenuItem>
              )}
              <MenuItem
                onClick={() => {
                  startQuiz();
                  closeMoreMenu();
                }}
              >
                <QuizIcon style={{ marginRight: 8 }} /> {t("quiz")}
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
              label={t("day")}
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              fullWidth
              inputRef={dayFilterRef as any}
            >
              <MenuItem value="all">{t("allDays")}</MenuItem>
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
            label={t("day")}
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            sx={{ minWidth: 160 }}
            inputRef={dayFilterRef as any}
          >
            <MenuItem value="all">{t("allDays")}</MenuItem>
            {dayOptions.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </TextField>
          <IconButton onClick={togglePrimary} ref={toggleRef}>
            <SwapHoriz />
          </IconButton>
          {sessionActive ? (
            <Button
              startIcon={<Stop />}
              color="error"
              variant="outlined"
              onClick={stopPractice}
              ref={practiceRef}
            >
              {t("stop")}
            </Button>
          ) : (
            <Button
              startIcon={<PlayArrow />}
              variant="outlined"
              onClick={startPractice}
              ref={practiceRef}
            >
              {t("practice")}
            </Button>
          )}
          <Button variant="outlined" onClick={startQuiz} ref={quizRef}>
            {t("quiz")}
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
            ref={addRef}
          >
            {t("add")}
          </Button>
          <Tooltip title={t("tourRestart")}>
            <IconButton onClick={restartTour}>
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
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

      {/* Per-item overflow menu (mobile) */}
      <Menu
        anchorEl={itemMenu?.el || null}
        open={Boolean(itemMenu)}
        onClose={closeItemMenu}
      >
        <MenuItem
          onClick={() => {
            if (activeItem)
              playTTS(
                activeItem.translation,
                detectTtsLanguage(activeItem.translation)
              );
            closeItemMenu();
          }}
        >
          <PlayArrow style={{ marginRight: 8 }} /> {t("play")}
        </MenuItem>
        {itemMenu && recording && recordingId === itemMenu.id ? (
          <MenuItem
            onClick={() => {
              stopRecording();
              closeItemMenu();
            }}
          >
            <Stop style={{ marginRight: 8 }} /> {t("stop")}
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              if (itemMenu && activeItem)
                void startRecordingFor(itemMenu.id, activeItem.word, "en");
              closeItemMenu();
            }}
          >
            <Mic style={{ marginRight: 8 }} /> {t("speak")}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (activeItem) toggleNoteVisibility(activeItem.id);
            closeItemMenu();
          }}
        >
          {activeItem && hiddenNotes.has(String(activeItem.id)) ? (
            <Visibility style={{ marginRight: 8 }} />
          ) : (
            <VisibilityOff style={{ marginRight: 8 }} />
          )}
          {activeItem && hiddenNotes.has(String(activeItem.id))
            ? t("showNotes")
            : t("hideNotes")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (activeItem) toggleReveal(activeItem.id);
            closeItemMenu();
          }}
        >
          {revealedIds.has(itemMenu?.id || "") ? (
            <VisibilityOff style={{ marginRight: 8 }} />
          ) : (
            <Visibility style={{ marginRight: 8 }} />
          )}
          {revealedIds.has(itemMenu?.id || "") ? t("hide") : t("reveal")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (activeItem) openEditDialog(activeItem);
            closeItemMenu();
          }}
        >
          <Edit style={{ marginRight: 8 }} /> {t("edit")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (activeItem) void removeItem(activeItem.id);
            closeItemMenu();
          }}
        >
          <Delete style={{ marginRight: 8 }} /> {t("delete")}
        </MenuItem>
      </Menu>

      <Dialog open={quizOpen} onClose={() => setQuizOpen(false)} fullWidth>
        <DialogTitle>{t("quiz")}</DialogTitle>
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
              <Typography variant="body2">
                {t("scoreLabel")}: {quizScore}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuizOpen(false)}>{t("close")}</Button>
        </DialogActions>
      </Dialog>

      {/* Practice modal */}
      <Dialog
        open={sessionActive}
        onClose={stopPractice}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("practice")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} alignItems="center" sx={{ mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={sessionProgress}
              sx={{ width: "100%", borderRadius: 1 }}
            />
            <Paper
              elevation={3}
              sx={{
                width: "100%",
                p: { xs: 2, sm: 3 },
                borderRadius: 2,
                backgroundImage: practiceCardBg,
              }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <Stack spacing={1} alignItems="center">
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignSelf: "flex-end" }}
                >
                  <TextField
                    select
                    size="small"
                    label={t("day")}
                    value={practiceDay}
                    onChange={(e) => setPracticeDay(e.target.value)}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="all">{t("allDays")}</MenuItem>
                    {dayOptions.map((d) => (
                      <MenuItem key={d} value={d}>
                        {d}
                      </MenuItem>
                    ))}
                  </TextField>
                  <ToggleButtonGroup
                    size="small"
                    value={practicePrimary}
                    exclusive
                    onChange={(_, val: "word" | "translation" | null) =>
                      val && setPracticePrimary(val)
                    }
                  >
                    <ToggleButton value="translation">
                      <TranslateIcon fontSize="small" />
                    </ToggleButton>
                    <ToggleButton value="word">
                      <TextFieldsIcon fontSize="small" />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography
                    variant={isMobile ? "h5" : "h4"}
                    sx={{ wordBreak: "break-word", textAlign: "center" }}
                  >
                    {currentPracticeItem
                      ? practicePrimary === "translation"
                        ? currentPracticeItem.translation || ""
                        : currentPracticeItem.word || ""
                      : t("noSentences")}
                  </Typography>
                  <Tooltip title={t("play")}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={playPrompt}
                        disabled={!currentPracticeItem}
                      >
                        <VolumeUp />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                {currentPracticeItem?.note &&
                  (currentPracticeItem.note || "").trim().length > 0 && (
                    <Typography
                      variant="body1"
                      color="text.primary"
                      sx={{
                        mt: 0.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        textAlign: "center",
                      }}
                    >
                      {(currentPracticeItem.note || "").trim()}
                    </Typography>
                  )}
              </Stack>
            </Paper>
            <Divider flexItem />
            {currentPracticeId && evaluations[currentPracticeId] && (
              <Stack direction="row" spacing={1} alignItems="center">
                {evaluations[currentPracticeId].correct ? (
                  <>
                    <CheckCircle sx={{ color: "#4caf50", fontSize: 28 }} />
                    {showCelebration && (
                      <EmojiEvents
                        sx={{ color: "gold", animation: "pulse 1s infinite" }}
                      />
                    )}
                  </>
                ) : (
                  <Cancel sx={{ color: "#ff5722", fontSize: 28 }} />
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: evaluations[currentPracticeId].correct
                      ? "#4caf50"
                      : "#ff5722",
                    fontWeight: 500,
                  }}
                >
                  {evaluations[currentPracticeId].correct
                    ? streakCount >= 3
                      ? `Perfect! Streak: ${streakCount}`
                      : "Correct!"
                    : `Try again • ${Math.round(
                        evaluations[currentPracticeId].similarity * 100
                      )}%`}
                  {typeof evaluations[currentPracticeId].similarity ===
                    "number" &&
                    (evaluations[currentPracticeId].correct ? null : (
                      <span>
                        {" "}
                        <br />
                        💭 Heard: "{evaluations[currentPracticeId].transcript}"
                        {getPronunciationHint(
                          currentPracticeItem?.word || ""
                        ) && (
                          <>
                            <br />
                            🔊 Try:{" "}
                            {getPronunciationHint(
                              currentPracticeItem?.word || ""
                            )}
                          </>
                        )}
                      </span>
                    ))}
                </Typography>
              </Stack>
            )}
            {currentPracticeId && evaluations[currentPracticeId] && (
              <Box sx={{ width: "100%" }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.round(
                    Math.min(
                      100,
                      Math.max(
                        0,
                        (evaluations[currentPracticeId].similarity || 0) * 100
                      )
                    )
                  )}
                  color={
                    evaluations[currentPracticeId].correct ? "success" : "error"
                  }
                  sx={{ borderRadius: 1 }}
                />
              </Box>
            )}
            {isMobile ? (
              <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
                <Fab
                  variant="extended"
                  color="default"
                  onClick={goPracticePrev}
                  disabled={!canPrev}
                  sx={{ flex: 1 }}
                >
                  <ArrowBack sx={{ mr: 1 }} /> Prev
                </Fab>
                <Fab
                  color="primary"
                  onClick={speakAndEvaluateCurrent}
                  disabled={isEvaluating || recording || !currentPracticeItem}
                  sx={{ flexShrink: 0 }}
                >
                  {isEvaluating || recording ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    <Mic />
                  )}
                </Fab>
                <Fab
                  variant="extended"
                  color="default"
                  onClick={goPracticeNext}
                  disabled={!canNext}
                  sx={{ flex: 1 }}
                >
                  Next <ArrowForward sx={{ ml: 1 }} />
                </Fab>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  startIcon={<ArrowBack />}
                  onClick={goPracticePrev}
                  disabled={!canPrev}
                >
                  Prev
                </Button>
                <Button
                  startIcon={<Mic />}
                  variant="contained"
                  onClick={speakAndEvaluateCurrent}
                  disabled={isEvaluating || recording || !currentPracticeItem}
                >
                  {isEvaluating || recording ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} />
                      <span>{t("speak")}</span>
                    </Stack>
                  ) : (
                    t("speak")
                  )}
                </Button>
                <Button
                  endIcon={<ArrowForward />}
                  onClick={goPracticeNext}
                  disabled={!canNext}
                >
                  Next
                </Button>
              </Stack>
            )}
            <Typography variant="caption" color="text.secondary">
              {sessionIndex + 1}/{Math.max(1, sessionOrderRef.current.length)}
              {streakCount > 0 && ` • ${streakCount} streak! 🔥`}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={stopPractice}>{t("close")}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        onClose={() => setToast(null)}
        autoHideDuration={3000}
      >
        <Alert severity="info">{toast}</Alert>
      </Snackbar>

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
    </Box>
  );
}
