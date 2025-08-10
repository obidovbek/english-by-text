import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getJSON, postJSON } from "../api/client";
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

interface FolderDTO {
  id: number | string;
  name: string;
  parentId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export default function Folders() {
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
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        {parentId && (
          <IconButton
            aria-label={t("back")}
            onClick={() => {
              params.delete("parentId");
              setParams(params, { replace: true });
            }}
            sx={{
              bgcolor: "action.hover",
              borderRadius: 2,
            }}
          >
            <ArrowBack />
          </IconButton>
        )}
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {t("yourFolders")}
        </Typography>
        <Button
          variant="contained"
          startIcon={<CreateNewFolder />}
          onClick={() => setDialogOpen(true)}
          disabled={!userId}
        >
          {t("newFolder")}
        </Button>
      </Stack>

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
            <ListItem key={f.id} disableGutters>
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
