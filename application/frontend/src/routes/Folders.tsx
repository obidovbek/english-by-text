import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getJSON, postJSON, deleteJSON, patchJSON } from "../api/client";
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
  Skeleton,
  Menu,
  MenuItem,
} from "@mui/material";
import { ArrowBack, CreateNewFolder, MoreVert } from "@mui/icons-material";
import { t } from "../i18n";
import { getJSON as apiGet, postJSON as apiPost } from "../api/client";
import { useNavigate } from "react-router-dom";
import { clearFolderCache } from "../components/FolderTree";

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

interface CacheEntry {
  folders: FolderDTO[];
  texts: TextListItem[];
  timestamp: number;
}

// Cache for main folder view data
const mainFolderCache = new Map<string, CacheEntry>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

function getMainCacheKey(parentId: number | null): string {
  return parentId === null ? "main-root" : `main-folder-${parentId}`;
}

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

export default function Folders() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const parentIdParam = params.get("parentId");
  const parentId = parentIdParam ? Number(parentIdParam) : null;

  const [folders, setFolders] = useState<FolderDTO[]>([]);
  const [texts, setTexts] = useState<TextListItem[]>([]);
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

  const [userId, setUserId] = useState<string | null>(() =>
    localStorage.getItem("userId")
  );

  // Rename folder dialog state
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FolderDTO | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  // Edit text dialog state
  const [editTextOpen, setEditTextOpen] = useState(false);
  const [editTextId, setEditTextId] = useState<number | string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUzRaw, setEditUzRaw] = useState("");
  const [editEnRaw, setEditEnRaw] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Menu state for actions
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<FolderDTO | TextListItem | null>(
    null
  );
  const [menuType, setMenuType] = useState<"folder" | "text" | null>(null);

  useEffect(() => {
    const handler = () => setUserId(localStorage.getItem("userId"));
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const loadFolders = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      setError(t("unauthorized"));
      return;
    }

    const cacheKey = getMainCacheKey(parentId);
    const cached = mainFolderCache.get(cacheKey);

    if (cached && isCacheValid(cached)) {
      setFolders(cached.folders);
      setTexts(cached.texts);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const query = parentId ? `?parentId=${parentId}` : "";

      // Load folders and texts in parallel
      const promises: [Promise<FolderDTO[]>, Promise<TextListItem[]>?] = [
        getJSON<FolderDTO[]>(`/api/folders${query}`),
      ];

      if (parentId) {
        promises.push(apiGet<TextListItem[]>(`/api/folders/${parentId}/texts`));
      }

      const results = await Promise.all(promises);
      const foldersData = results[0];
      const textsData = results[1] || [];

      // Cache the results
      mainFolderCache.set(cacheKey, {
        folders: foldersData,
        texts: textsData,
        timestamp: Date.now(),
      });

      setFolders(foldersData);
      setTexts(textsData);
    } catch (e) {
      const message = e instanceof Error ? e.message : t("errorLoadFolders");
      setError(message);
      setFolders([]);
      setTexts([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, parentId]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  const handleCreate = useCallback(async () => {
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

      // Clear relevant caches
      mainFolderCache.delete(getMainCacheKey(parentId));
      clearFolderCache();

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
  }, [name, parentId, loadFolders]);

  const handleRename = useCallback(
    async (folderId: number | string, newName: string) => {
      try {
        setIsRenaming(true);
        await patchJSON(`/api/folders/${folderId}`, { name: newName });

        // Clear all caches since folder name changed
        mainFolderCache.clear();
        clearFolderCache();

        setToast("Folder renamed");
        await loadFolders();
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        if (/already exists/i.test(msg)) {
          setRenameError(t("nameExists"));
        } else {
          setRenameError(msg);
        }
        return false;
      } finally {
        setIsRenaming(false);
      }
    },
    [loadFolders]
  );

  const handleDeleteFolder = useCallback(async (folderId: number | string) => {
    if (!confirm("Delete this folder and its contents?")) return;

    try {
      await deleteJSON(`/api/folders/${folderId}`);

      // Clear caches
      mainFolderCache.clear();
      clearFolderCache();

      setFolders((prev) => prev.filter((x) => x.id !== folderId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }, []);

  const handleDeleteText = useCallback(async (textId: number | string) => {
    if (!confirm("Delete this text?")) return;

    try {
      await deleteJSON(`/api/texts/${textId}`);
      setTexts((prev) => prev.filter((x) => x.id !== textId));

      // Clear folder cache since text count changed
      clearFolderCache();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }, []);

  const handleMenuClick = (
    event: React.MouseEvent<HTMLElement>,
    item: FolderDTO | TextListItem,
    type: "folder" | "text"
  ) => {
    setMenuAnchor(event.currentTarget);
    setMenuTarget(item);
    setMenuType(type);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuTarget(null);
    setMenuType(null);
  };

  const crumbs = useMemo(() => {
    const items: Array<{ label: string; id: number | null }> = [];
    items.push({ label: t("root"), id: null });
    if (parentId) items.push({ label: "..", id: null });
    return items;
  }, [parentId]);

  const memoizedFolders = useMemo(
    () =>
      folders.map((f) => (
        <ListItem
          key={f.id}
          disableGutters
          secondaryAction={
            <IconButton
              size="small"
              onClick={(e) => handleMenuClick(e, f, "folder")}
              sx={{
                color: "#ffffff",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "#64b5f6",
                },
              }}
            >
              <MoreVert />
            </IconButton>
          }
        >
          <ListItemButton
            onClick={() => {
              params.set("parentId", String(f.id));
              setParams(params, { replace: false });
            }}
            sx={{
              borderRadius: 1,
              "&:hover": { bgcolor: "rgba(255, 255, 255, 0.05)" },
            }}
          >
            <ListItemText
              primary={f.name}
              primaryTypographyProps={{
                sx: { color: "#ffffff", fontWeight: 500 },
              }}
            />
          </ListItemButton>
        </ListItem>
      )),
    [folders, params, setParams]
  );

  const memoizedTexts = useMemo(
    () =>
      texts.map((tx) => (
        <ListItem
          key={tx.id}
          disableGutters
          secondaryAction={
            <IconButton
              size="small"
              onClick={(e) => handleMenuClick(e, tx, "text")}
              sx={{
                color: "#ffffff",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "#64b5f6",
                },
              }}
            >
              <MoreVert />
            </IconButton>
          }
        >
          <ListItemButton
            onClick={() => navigate(`/texts/${tx.id}`)}
            sx={{
              borderRadius: 1,
              "&:hover": { bgcolor: "rgba(255, 255, 255, 0.05)" },
            }}
          >
            <ListItemText
              primary={tx.title}
              secondary={
                tx.createdAt
                  ? new Date(tx.createdAt).toLocaleString()
                  : undefined
              }
              primaryTypographyProps={{
                sx: { color: "#ffffff", fontWeight: 500 },
              }}
              secondaryTypographyProps={{
                sx: { color: "#b0b0b0" },
              }}
            />
          </ListItemButton>
        </ListItem>
      )),
    [texts, navigate]
  );

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
        )}
        <Typography
          variant="h5"
          sx={{ flexGrow: 1, color: "#ffffff", fontWeight: 600 }}
        >
          {/* {t("yourFolders")} */}
        </Typography>
        {parentId && (
          <Button
            variant="outlined"
            onClick={() => setTextDialogOpen(true)}
            disabled={!userId}
            sx={{
              mr: 1,
              color: "#ffffff",
              borderColor: "rgba(255, 255, 255, 0.3)",
              "&:hover": {
                borderColor: "#64b5f6",
                color: "#64b5f6",
                backgroundColor: "rgba(100, 181, 246, 0.1)",
              },
            }}
          >
            {t("addText")}
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={<CreateNewFolder sx={{ color: "#ffffff" }} />}
          onClick={() => setDialogOpen(true)}
          disabled={!userId}
          sx={{
            backgroundColor: "#1976d2",
            color: "#ffffff",
            "&:hover": {
              backgroundColor: "#1565c0",
            },
            "& .MuiButton-startIcon": {
              color: "#ffffff",
            },
          }}
        ></Button>
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
            sx={{
              color: "#ffffff",
              textDecoration: "none",
              "&:hover": {
                color: "#64b5f6",
                textDecoration: "underline",
              },
            }}
          >
            {c.label}
          </MuiLink>
        ))}
      </Breadcrumbs>

      {/* Text list for current folder */}
      {parentId && (
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="subtitle1"
            sx={{ mb: 1, color: "#ffffff", fontWeight: 600 }}
          >
            Texts
          </Typography>
          {isLoading ? (
            <Stack spacing={1}>
              {[1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  variant="rectangular"
                  height={48}
                  sx={{ bgcolor: "rgba(255, 255, 255, 0.1)" }}
                />
              ))}
            </Stack>
          ) : texts.length > 0 ? (
            <List>{memoizedTexts}</List>
          ) : (
            <Typography variant="body2" sx={{ color: "#b0b0b0" }}>
              No texts in this folder yet
            </Typography>
          )}
        </Box>
      )}

      {/* Folders list */}
      <Typography
        variant="subtitle1"
        sx={{ mb: 1, color: "#ffffff", fontWeight: 600 }}
      >
        Folders
      </Typography>
      {isLoading ? (
        <Stack spacing={1}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={56}
              sx={{ bgcolor: "rgba(255, 255, 255, 0.1)" }}
            />
          ))}
        </Stack>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <List>
          {memoizedFolders}
          {folders.length === 0 && (
            <ListItem disableGutters>
              <ListItemText
                primary={t("noFoldersYet")}
                primaryTypographyProps={{ sx: { color: "#b0b0b0" } }}
              />
            </ListItem>
          )}
        </List>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          sx: {
            bgcolor: "#424242",
            color: "#ffffff",
            "& .MuiMenuItem-root": {
              color: "#ffffff",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.1)",
              },
            },
          },
        }}
      >
        {menuType === "folder" && [
          <MenuItem
            key="rename"
            onClick={() => {
              const folder = menuTarget as FolderDTO;
              setRenameTarget(folder);
              setRenameName(folder.name);
              setRenameError(null);
              setRenameOpen(true);
              handleMenuClose();
            }}
          >
            Rename
          </MenuItem>,
          <MenuItem
            key="delete"
            onClick={() => {
              handleDeleteFolder(menuTarget!.id);
              handleMenuClose();
            }}
            sx={{
              color: "#f44336",
              "&:hover": {
                backgroundColor: "rgba(244, 67, 54, 0.1)",
              },
            }}
          >
            Delete
          </MenuItem>,
        ]}
        {menuType === "text" && [
          <MenuItem
            key="edit"
            onClick={async () => {
              try {
                const full = await apiGet<any>(`/api/texts/${menuTarget!.id}`);
                setEditTextId(menuTarget!.id);
                setEditTitle(full.title || "");
                setEditUzRaw(full.uzRaw || "");
                setEditEnRaw(full.enRaw || "");
                setEditError(null);
                setEditTextOpen(true);
                handleMenuClose();
              } catch (e) {
                alert(e instanceof Error ? e.message : "Failed to open editor");
                handleMenuClose();
              }
            }}
          >
            Edit
          </MenuItem>,
          <MenuItem
            key="delete"
            onClick={() => {
              handleDeleteText(menuTarget!.id);
              handleMenuClose();
            }}
            sx={{
              color: "#f44336",
              "&:hover": {
                backgroundColor: "rgba(244, 67, 54, 0.1)",
              },
            }}
          >
            Delete
          </MenuItem>,
        ]}
      </Menu>

      {/* Create Folder Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            bgcolor: "#424242",
            color: "#ffffff",
          },
        }}
      >
        <DialogTitle sx={{ color: "#ffffff" }}>{t("newFolder")}</DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ color: "#b0b0b0" }}>
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
            sx={{
              "& .MuiInputLabel-root": { color: "#b0b0b0" },
              "& .MuiInputBase-input": { color: "#ffffff" },
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.5)" },
                "&.Mui-focused fieldset": { borderColor: "#64b5f6" },
              },
              "& .MuiFormHelperText-root": { color: "#b0b0b0" },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={isCreating}
            sx={{ color: "#b0b0b0" }}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={() => void handleCreate()}
            variant="contained"
            disabled={isCreating || !userId}
            sx={{
              backgroundColor: "#1976d2",
              color: "#ffffff",
              "&:hover": {
                backgroundColor: "#1565c0",
              },
            }}
          >
            {isCreating ? (
              <CircularProgress size={20} sx={{ color: "#ffffff" }} />
            ) : (
              t("create")
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Text Dialog */}
      <Dialog
        open={textDialogOpen}
        onClose={() => setTextDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: "#424242",
            color: "#ffffff",
          },
        }}
      >
        <DialogTitle sx={{ color: "#ffffff" }}>{t("addText")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("titleLabel")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              value={uzRaw}
              onChange={(e) => setUzRaw(e.target.value)}
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
              value={enRaw}
              onChange={(e) => setEnRaw(e.target.value)}
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
            {textError && <Alert severity="error">{textError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setTextDialogOpen(false)}
            disabled={isCreatingText}
            sx={{ color: "#b0b0b0" }}
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

                // Clear cache and navigate
                clearFolderCache();
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
            sx={{
              backgroundColor: "#1976d2",
              color: "#ffffff",
              "&:hover": {
                backgroundColor: "#1565c0",
              },
            }}
          >
            {isCreatingText ? (
              <CircularProgress size={20} sx={{ color: "#ffffff" }} />
            ) : (
              t("createText")
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            bgcolor: "#424242",
            color: "#ffffff",
          },
        }}
      >
        <DialogTitle sx={{ color: "#ffffff" }}>Rename folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t("nameLabel")}
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            inputProps={{ maxLength: 100 }}
            helperText={renameError ?? t("nameHelper")}
            error={Boolean(renameError)}
            margin="dense"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (async () => {
                  const nm = renameName.trim();
                  if (nm.length < 1 || nm.length > 100) {
                    setRenameError(t("nameHelper"));
                    return;
                  }
                  const success = await handleRename(renameTarget?.id!, nm);
                  if (success) {
                    setRenameOpen(false);
                  }
                })();
              }
            }}
            sx={{
              "& .MuiInputLabel-root": { color: "#b0b0b0" },
              "& .MuiInputBase-input": { color: "#ffffff" },
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.5)" },
                "&.Mui-focused fieldset": { borderColor: "#64b5f6" },
              },
              "& .MuiFormHelperText-root": { color: "#b0b0b0" },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRenameOpen(false)}
            disabled={isRenaming}
            sx={{ color: "#b0b0b0" }}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={async () => {
              const nm = renameName.trim();
              if (nm.length < 1 || nm.length > 100) {
                setRenameError(t("nameHelper"));
                return;
              }
              const success = await handleRename(renameTarget?.id!, nm);
              if (success) {
                setRenameOpen(false);
              }
            }}
            variant="contained"
            disabled={isRenaming}
            sx={{
              backgroundColor: "#1976d2",
              color: "#ffffff",
              "&:hover": {
                backgroundColor: "#1565c0",
              },
            }}
          >
            {isRenaming ? (
              <CircularProgress size={20} sx={{ color: "#ffffff" }} />
            ) : (
              "Save"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Text Dialog */}
      <Dialog
        open={editTextOpen}
        onClose={() => setEditTextOpen(false)}
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
            onClick={() => setEditTextOpen(false)}
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
                await patchJSON(`/api/texts/${editTextId}` as string, {
                  title: titleTrim,
                  uzRaw: editUzRaw,
                  enRaw: editEnRaw,
                });
                setEditTextOpen(false);
                setToast("Text updated");

                // Update title in list and clear caches
                setTexts((prev) =>
                  prev.map((x) =>
                    x.id === editTextId ? { ...x, title: titleTrim } : x
                  )
                );
                clearFolderCache();
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
        autoHideDuration={2000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
