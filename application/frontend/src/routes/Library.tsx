import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getJSON, postJSON } from "../api/client";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Button,
  Stack,
  Breadcrumbs,
  Link as MuiLink,
  Snackbar,
  Skeleton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme,
  InputAdornment,
} from "@mui/material";
import { ArrowBack, Download, Search } from "@mui/icons-material";
import { t } from "../i18n";

interface FolderDTO {
  id: number | string;
  name: string;
  parentId?: number | null;
}

interface TextListItem {
  id: number | string;
  title: string;
  createdAt?: string;
}

export default function Library() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const parentIdParam = params.get("parentId");
  const parentId = parentIdParam ? Number(parentIdParam) : null;

  const [folders, setFolders] = useState<FolderDTO[]>([]);
  const [texts, setTexts] = useState<TextListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<FolderDTO | null>(null);
  const [namePrefix, setNamePrefix] = useState("");

  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const queryStr = parentId ? `?parentId=${parentId}` : "";
      const foldersData = await getJSON<FolderDTO[]>(
        `/api/folders-global${queryStr}`
      );
      setFolders(foldersData);
      if (parentId) {
        const textData = await getJSON<TextListItem[]>(
          `/api/folders-global/${parentId}/texts`
        );
        setTexts(textData);
      } else {
        setTexts([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failed"));
    } finally {
      setIsLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const crumbs = useMemo(() => {
    const items: Array<{ label: string; id: number | null }> = [];
    items.push({ label: t("library"), id: null });
    if (parentId) items.push({ label: "..", id: null });
    return items;
  }, [parentId]);

  async function doSearch() {
    const q = query.trim();
    if (!q) return;
    try {
      setIsSearching(true);
      const results = await getJSON<FolderDTO[]>(
        `/api/folders-global/search?q=${encodeURIComponent(q)}`
      );
      setFolders(results);
      setTexts([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failed"));
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <Box sx={{ p: 2, bgcolor: "background.default", minHeight: "100vh" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton
          aria-label={t("back")}
          onClick={() => navigate("/")}
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
          <ArrowBack />
        </IconButton>
        <Typography
          variant="h6"
          sx={{ flexGrow: 1, color: "text.primary", fontWeight: 700 }}
        >
          {t("library")}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField
          fullWidth
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void doSearch();
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant="outlined"
          onClick={() => void doSearch()}
          disabled={isSearching}
        >
          {t("search")}
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
            sx={{ color: "text.primary" }}
          >
            {c.label}
          </MuiLink>
        ))}
      </Breadcrumbs>

      {isLoading ? (
        <Stack spacing={1}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" height={56} />
          ))}
        </Stack>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          {parentId && texts.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="subtitle1"
                sx={{ mb: 1, color: "text.primary", fontWeight: 600 }}
              >
                {t("texts")}
              </Typography>
              <List>
                {texts.map((tx) => (
                  <ListItem key={String(tx.id)}>
                    <ListItemText primary={tx.title} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          <Typography
            variant="subtitle1"
            sx={{ mb: 1, color: "text.primary", fontWeight: 600 }}
          >
            {t("folders")}
          </Typography>
          <List>
            {folders.map((f) => (
              <ListItem
                key={String(f.id)}
                disableGutters
                secondaryAction={
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={() => {
                      setImportTarget(f);
                      setNamePrefix("");
                      setImportOpen(true);
                    }}
                  >
                    {t("import")}
                  </Button>
                }
              >
                <ListItemButton
                  onClick={() => {
                    params.set("parentId", String(f.id));
                    setParams(params, { replace: false });
                  }}
                >
                  <ListItemText primary={f.name} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t("importFolder")}</DialogTitle>
        <DialogContent>
          <TextField
            label={t("namePrefix")}
            value={namePrefix}
            onChange={(e) => setNamePrefix(e.target.value)}
            fullWidth
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>{t("cancel")}</Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                await postJSON(
                  `/api/folders-global/${importTarget!.id}/import`,
                  {
                    parentId: null,
                    namePrefix: namePrefix.trim() || undefined,
                  }
                );
                setToast(t("imported"));
                setImportOpen(false);
              } catch (e) {
                alert(e instanceof Error ? e.message : t("failed"));
              }
            }}
          >
            {t("import")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={1800}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </Box>
  );
}
