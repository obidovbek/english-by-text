import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getJSON, postJSON, deleteJSON } from "../api/client";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Breadcrumbs,
  Link as MuiLink,
  IconButton,
  Snackbar,
} from "@mui/material";
import { ArrowBack, CreateNewFolder } from "@mui/icons-material";
import { t } from "../i18n";
import { getJSON as apiGet, postJSON as apiPost } from "../api/client";
import { useNavigate } from "react-router-dom";
import FolderTree from "../components/FolderTree";

interface FolderDTO {
  id: number | string;
  name: string;
  parentId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

interface TextListItem {
  id: number | string;
  title: string;
  createdAt?: string;
}

export default function Folders() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const parentIdParam = params.get("parentId");
  const parentId = parentIdParam ? Number(parentIdParam) : null;

  const [folders, setFolders] = useState<FolderDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Text dialog state
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [uzRaw, setUzRaw] = useState("");
  const [enRaw, setEnRaw] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const [isCreatingText, setIsCreatingText] = useState(false);

  const [texts, setTexts] = useState<TextListItem[]>([]);

  const [userId, setUserId] = useState<string | null>(() =>
    localStorage.getItem("userId")
  );

  useEffect(() => {
    const handler = () => setUserId(localStorage.getItem("userId"));
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  async function loadFolders() {
    try {
      setIsLoading(true);
      setError(null);
      const query = parentId ? `?parentId=${parentId}` : "";
      const data = await getJSON<FolderDTO[]>(`/api/folders${query}`);
      setFolders(data);
      // Also load texts if in a specific folder
      if (parentId) {
        const tlist = await apiGet<TextListItem[]>(
          `/api/folders/${parentId}/texts`
        );
        setTexts(tlist);
      } else {
        setTexts([]);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t("errorLoadFolders");
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      setError(t("unauthorized"));
      return;
    }
    void loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, parentId]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      setCreateError(t("nameHelper"));
      return;
    }
    try {
      setIsCreating(true);
      setCreateError(null);
      await postJSON<{ name: string; parentId: number | null }, FolderDTO>(
        "/api/folders",
        { name: trimmed, parentId: parentId ?? null }
      );
      setDialogOpen(false);
      setName("");
      setToast(t("folderCreated"));
      await loadFolders();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("errorCreateFolder");
      if (/already exists/i.test(message)) {
        setCreateError(t("nameExists"));
      } else {
        setCreateError(message);
      }
    } finally {
      setIsCreating(false);
    }
  }

  const crumbs = useMemo(() => {
    const items: Array<{ label: string; id: number | null }> = [];
    items.push({ label: t("root"), id: null });
    if (parentId) items.push({ label: "..", id: null });
    return items;
  }, [parentId]);

  return (
    <Box sx={{ p: 2 }}>
      {/* Notion-like tree at top */}
      <Box sx={{ mb: 2 }}>
        <FolderTree />
      </Box>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        {parentId && (
          <IconButton
            aria-label={t("back")}
            onClick={() => {
              params.delete("parentId");
              setParams(params, { replace: true });
            }}
            sx={{ bgcolor: "action.hover", borderRadius: 2 }}
          >
            <ArrowBack />
          </IconButton>
        )}
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {t("yourFolders")}
        </Typography>
        {parentId && (
          <Button
            variant="outlined"
            onClick={() => setTextDialogOpen(true)}
            disabled={!userId}
            sx={{ mr: 1 }}
          >
            {t("addText")}
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={<CreateNewFolder />}
          onClick={() => setDialogOpen(true)}
          disabled={!userId}
        >
          {t("newFolder")}
        </Button>
      </Stack>

      {/* Text list for current folder */}
      {parentId && texts.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {t("addText")}
          </Typography>
          <List>
            {texts.map((tx) => (
              <ListItem
                key={tx.id}
                disableGutters
                secondaryAction={
                  <Button
                    color="error"
                    onClick={async () => {
                      if (!confirm("Delete this text?")) return;
                      try {
                        await deleteJSON(`/api/texts/${tx.id}`);
                        setTexts((prev) => prev.filter((x) => x.id !== tx.id));
                      } catch (e) {
                        alert(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Delete
                  </Button>
                }
              >
                <ListItemButton
                  onClick={() => navigate(`/texts/${tx.id}`)}
                  sx={{
                    borderRadius: 1,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <ListItemText
                    primary={tx.title}
                    secondary={
                      tx.createdAt
                        ? new Date(tx.createdAt).toLocaleString()
                        : undefined
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      <Breadcrumbs sx={{ mb: 2 }}>
        {crumbs.map((c, idx) => (
          <MuiLink
            key={idx}
            component="button"
            type="button"
            onClick={() => {
              if (c.id === null) {
                params.delete("parentId");
                setParams(params, { replace: true });
              } else {
                params.set("parentId", String(c.id));
                setParams(params, { replace: true });
              }
            }}
          >
            {c.label}
          </MuiLink>
        ))}
      </Breadcrumbs>

      {isLoading ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} />
          <Typography>{t("loadingFolders")}</Typography>
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <List>
          {folders.map((f) => (
            <ListItem
              key={f.id}
              disableGutters
              secondaryAction={
                <Button
                  color="error"
                  onClick={async () => {
                    if (!confirm("Delete this folder and its contents?"))
                      return;
                    try {
                      await deleteJSON(`/api/folders/${f.id}`);
                      setFolders((prev) => prev.filter((x) => x.id !== f.id));
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  Delete
                </Button>
              }
            >
              <ListItemButton
                onClick={() => {
                  params.set("parentId", String(f.id));
                  setParams(params, { replace: false });
                }}
                sx={{
                  borderRadius: 1,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <ListItemText primary={f.name} />
              </ListItemButton>
            </ListItem>
          ))}
          {folders.length === 0 && (
            <ListItem disableGutters>
              <ListItemText primary={t("noFoldersYet")} />
            </ListItem>
          )}
        </List>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t("newFolder")}</DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {t("createIn", { place: parentId ? t("yourFolders") : t("root") })}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label={t("nameLabel")}
            placeholder={t("newFolderPlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
            inputProps={{ maxLength: 100 }}
            helperText={createError ?? t("nameHelper")}
            error={Boolean(createError)}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={isCreating}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() => void handleCreate()}
            variant="contained"
            disabled={isCreating || !userId}
          >
            {t("create")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Text Dialog */}
      <Dialog
        open={textDialogOpen}
        onClose={() => setTextDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("addText")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("titleLabel")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              inputProps={{ maxLength: 200 }}
              fullWidth
            />
            <TextField
              label={t("uzRawLabel")}
              value={uzRaw}
              onChange={(e) => setUzRaw(e.target.value)}
              fullWidth
              multiline
              minRows={6}
            />
            <TextField
              label={t("enRawLabel")}
              value={enRaw}
              onChange={(e) => setEnRaw(e.target.value)}
              fullWidth
              multiline
              minRows={6}
            />
            {textError && <Alert severity="error">{textError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setTextDialogOpen(false)}
            disabled={isCreatingText}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={async () => {
              const titleTrim = title.trim();
              if (
                titleTrim.length < 1 ||
                titleTrim.length > 200 ||
                !uzRaw.trim() ||
                !enRaw.trim()
              ) {
                setTextError(t("errorCreateFolder"));
                return;
              }
              try {
                setIsCreatingText(true);
                setTextError(null);
                const created = await apiPost<
                  { title: string; uzRaw: string; enRaw: string },
                  { id: number; title: string }
                >(`/api/folders/${parentId}/texts`, {
                  title: titleTrim,
                  uzRaw,
                  enRaw,
                });
                setTextDialogOpen(false);
                setTitle("");
                setUzRaw("");
                setEnRaw("");
                setToast(t("textCreated"));
                navigate(`/texts/${created.id}`);
              } catch (e) {
                const msg =
                  e instanceof Error ? e.message : t("errorCreateFolder");
                setTextError(msg);
              } finally {
                setIsCreatingText(false);
              }
            }}
            variant="contained"
            disabled={isCreatingText || !userId}
          >
            {t("createText")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
