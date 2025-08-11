import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getJSON } from "../api/client";
import {
  Box,
  IconButton,
  Typography,
  Stack,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from "@mui/material";
import {
  ExpandMore,
  ChevronRight,
  Folder as FolderIcon,
  Description as DescriptionIcon,
} from "@mui/icons-material";

interface FolderDTO {
  id: number;
  name: string;
  parentId?: number | null;
}

interface TextDTO {
  id: number;
  title: string;
  createdAt?: string;
}

interface CacheEntry {
  folders: FolderDTO[];
  texts: TextDTO[];
  timestamp: number;
}

// Global cache for folder data
const folderCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(parentId: number | null): string {
  return parentId === null ? "root" : `folder-${parentId}`;
}

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

const FolderItem = memo(
  ({ folder, level }: { folder: FolderDTO; level: number }) => {
    const [expanded, setExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [children, setChildren] = useState<FolderDTO[]>([]);
    const [texts, setTexts] = useState<TextDTO[]>([]);
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();

    const loadChildren = useCallback(async () => {
      const cacheKey = getCacheKey(folder.id);
      const cached = folderCache.get(cacheKey);

      if (cached && isCacheValid(cached)) {
        setChildren(cached.folders);
        setTexts(cached.texts);
        return;
      }

      setIsLoading(true);
      try {
        // Load folders and texts in parallel
        const [foldersRes, textsRes] = await Promise.all([
          getJSON<FolderDTO[]>(`/api/folders?parentId=${folder.id}`),
          getJSON<TextDTO[]>(`/api/folders/${folder.id}/texts`),
        ]);

        const folders = foldersRes as FolderDTO[];
        const texts = textsRes as TextDTO[];

        // Cache the results
        folderCache.set(cacheKey, {
          folders,
          texts,
          timestamp: Date.now(),
        });

        setChildren(folders);
        setTexts(texts);
      } catch (error) {
        console.error("Failed to load folder children:", error);
        setChildren([]);
        setTexts([]);
      } finally {
        setIsLoading(false);
      }
    }, [folder.id]);

    const handleToggle = useCallback(async () => {
      const newExpanded = !expanded;
      setExpanded(newExpanded);

      if (
        newExpanded &&
        children.length === 0 &&
        texts.length === 0 &&
        !isLoading
      ) {
        await loadChildren();
      }
    }, [expanded, children.length, texts.length, isLoading, loadChildren]);

    const handleFolderClick = useCallback(() => {
      params.set("parentId", String(folder.id));
      setParams(params, { replace: false });
    }, [params, setParams, folder.id]);

    const handleTextClick = useCallback(
      (textId: number) => {
        navigate(`/texts/${textId}`);
      },
      [navigate]
    );

    const indentLevel = level * 2;

    return (
      <Box>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            pl: indentLevel,
            py: 0.5,
            "&:hover": { bgcolor: "rgba(255, 255, 255, 0.05)" },
            borderRadius: 1,
            cursor: "pointer",
          }}
        >
          <IconButton
            size="small"
            onClick={handleToggle}
            disabled={isLoading}
            sx={{
              minWidth: 24,
              minHeight: 24,
              color: "#ffffff",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                color: "#64b5f6",
              },
            }}
          >
            {isLoading ? (
              <CircularProgress size={16} sx={{ color: "#b0b0b0" }} />
            ) : expanded ? (
              <ExpandMore fontSize="small" />
            ) : (
              <ChevronRight fontSize="small" />
            )}
          </IconButton>
          <FolderIcon fontSize="small" sx={{ color: "#64b5f6" }} />
          <Typography
            variant="body2"
            onClick={handleFolderClick}
            sx={{
              cursor: "pointer",
              fontWeight: 500,
              flex: 1,
              color: "#ffffff",
              "&:hover": { color: "#64b5f6" },
            }}
          >
            {folder.name}
          </Typography>
        </Stack>

        {expanded && (
          <Box sx={{ ml: 1 }}>
            {texts.length > 0 && (
              <List dense disablePadding>
                {texts.map((text) => (
                  <ListItem
                    key={`t-${text.id}`}
                    disableGutters
                    sx={{
                      pl: indentLevel + 1,
                      py: 0.25,
                      cursor: "pointer",
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 0.05)" },
                      borderRadius: 1,
                    }}
                    onClick={() => handleTextClick(text.id)}
                  >
                    <DescriptionIcon
                      sx={{ mr: 1, color: "#b0b0b0" }}
                      fontSize="small"
                    />
                    <ListItemText
                      primary={text.title}
                      primaryTypographyProps={{
                        variant: "body2",
                        sx: { color: "#b0b0b0" },
                        noWrap: true,
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
            {children.map((child) => (
              <FolderItem key={child.id} folder={child} level={level + 1} />
            ))}
          </Box>
        )}
      </Box>
    );
  }
);

FolderItem.displayName = "FolderItem";

export default function FolderTree() {
  const [roots, setRoots] = useState<FolderDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRoots = useCallback(async () => {
    const cacheKey = getCacheKey(null);
    const cached = folderCache.get(cacheKey);

    if (cached && isCacheValid(cached)) {
      setRoots(cached.folders);
      setIsLoading(false);
      return;
    }

    try {
      const folders = await getJSON<FolderDTO[]>("/api/folders");

      // Cache root folders
      folderCache.set(cacheKey, {
        folders: folders as FolderDTO[],
        texts: [], // Root has no texts
        timestamp: Date.now(),
      });

      setRoots(folders as FolderDTO[]);
    } catch (error) {
      console.error("Failed to load root folders:", error);
      setRoots([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoots();
  }, [loadRoots]);

  const memoizedRoots = useMemo(
    () =>
      roots.map((folder) => (
        <FolderItem key={folder.id} folder={folder} level={0} />
      )),
    [roots]
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
        <CircularProgress size={16} sx={{ color: "#b0b0b0" }} />
        <Typography variant="body2" sx={{ color: "#b0b0b0" }}>
          Loading folders...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxHeight: 400, overflow: "auto" }}>
      {memoizedRoots}
      {roots.length === 0 && (
        <Typography variant="body2" sx={{ color: "#b0b0b0", p: 1 }}>
          No folders yet
        </Typography>
      )}
    </Box>
  );
}

// Export function to clear cache when needed
export function clearFolderCache() {
  folderCache.clear();
}
