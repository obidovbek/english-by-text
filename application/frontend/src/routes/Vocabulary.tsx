import { useEffect, useState } from "react";
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
} from "@mui/material";
import {
  Delete,
  Add,
  Visibility,
  VisibilityOff,
  Edit,
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
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
    setEditError(null);
    setEditOpen(true);
  }

  async function saveEdit() {
    const id = editId!;
    const w = editWord.trim();
    const tr = editTranslation.trim();
    if (!w || !tr) {
      setEditError(t("pleaseFillAllFieldsCorrectly"));
      return;
    }
    try {
      setIsSavingEdit(true);
      const updated = await patchJSON<
        { word: string; translation: string; note?: string | null },
        VocabItem
      >(`/api/vocabulary/${id}`, {
        word: w,
        translation: tr,
        note: editNote.trim() || null,
      });
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, ...updated } : x))
      );
      setToast(t("saved"));
      setEditOpen(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : t("failed"));
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <Box sx={{ p: 2, bgcolor: "background.default", minHeight: "100vh" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton
          aria-label="back"
          onClick={() => navigate(-1)}
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
          variant="h6"
          sx={{ color: "text.primary", fontWeight: 700, flexGrow: 1 }}
        >
          {t("vocabulary")}
        </Typography>
        <Button
          variant="text"
          startIcon={<SwapHoriz />}
          onClick={() =>
            setPrimaryField((p) => (p === "word" ? "translation" : "word"))
          }
          sx={{
            color: "text.secondary",
            "&:hover": {
              color: "primary.main",
              backgroundColor: "action.hover",
            },
            mr: 1,
          }}
        >
          {primaryField === "word" ? t("translationFirst") : t("wordFirst")}
        </Button>
        <Button
          variant="contained"
          startIcon={<Add sx={{ color: "primary.contrastText" }} />}
          onClick={() => setDialogOpen(true)}
          sx={{
            backgroundColor: "primary.main",
            color: "primary.contrastText",
          }}
        >
          {t("create")}
        </Button>
      </Stack>

      {isLoading ? (
        <Typography sx={{ color: "text.secondary" }}>{t("loading")}</Typography>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : items.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>
          {t("noSentences")}
        </Typography>
      ) : (
        <List>
          {items.map((it) => {
            const isRevealed = revealedIds.has(String(it.id));
            const primaryText =
              primaryField === "word" ? it.word : it.translation;
            const otherText =
              primaryField === "word" ? it.translation : it.word;
            return (
              <ListItem
                key={String(it.id)}
                secondaryAction={
                  <Box>
                    <IconButton
                      edge="end"
                      aria-label="reveal"
                      onClick={() => toggleReveal(it.id)}
                      sx={{ mr: 0.5, color: "text.primary" }}
                    >
                      {isRevealed ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="edit"
                      onClick={() => openEditDialog(it)}
                      sx={{ mr: 0.5, color: "text.primary" }}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => removeItem(it.id)}
                      sx={{ color: theme.palette.error.main }}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemText
                  primary={primaryText}
                  secondary={
                    isRevealed
                      ? [otherText, it.note].filter(Boolean).join(" — ")
                      : undefined
                  }
                  primaryTypographyProps={{
                    sx: { color: "text.primary", fontWeight: 600 },
                  }}
                  secondaryTypographyProps={{ sx: { color: "text.secondary" } }}
                />
              </ListItem>
            );
          })}
        </List>
      )}

      {/* Create dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
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
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
            <TextField
              label={t("translationLabel")}
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
            />
            <TextField
              label={t("noteLabel")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              minRows={3}
            />
            {createError && <Alert severity="error">{createError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
          <Button
            onClick={() => void addItem()}
            variant="contained"
            disabled={isCreating}
          >
            {isCreating ? t("loading") : t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ color: "text.primary" }}>{t("edit")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("wordLabel")}
              value={editWord}
              onChange={(e) => setEditWord(e.target.value)}
            />
            <TextField
              label={t("translationLabel")}
              value={editTranslation}
              onChange={(e) => setEditTranslation(e.target.value)}
            />
            <TextField
              label={t("noteLabel")}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              multiline
              minRows={3}
            />
            {editError && <Alert severity="error">{editError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={isSavingEdit}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() => void saveEdit()}
            variant="contained"
            disabled={isSavingEdit}
          >
            {isSavingEdit ? t("loading") : t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={1500}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </Box>
  );
}
