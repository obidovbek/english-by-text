import { useEffect, useState } from "react";
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
}
interface TextDTO {
  id: number;
  title: string;
  createdAt?: string;
}

function FolderItem({ folder, level }: { folder: FolderDTO; level: number }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<FolderDTO[]>([]);
  const [texts, setTexts] = useState<TextDTO[]>([]);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  async function loadChildren() {
    setLoading(true);
    try {
      const subs = await getJSON<FolderDTO[]>(
        `/api/folders?parentId=${folder.id}`
      );
      const txs = await getJSON<TextDTO[]>(`/api/folders/${folder.id}/texts`);
      setChildren(subs as FolderDTO[]);
      setTexts(txs as TextDTO[]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ pl: level * 2, py: 0.5 }}
      >
        <IconButton
          size="small"
          onClick={async () => {
            const to = !expanded;
            setExpanded(to);
            if (to && children.length === 0 && texts.length === 0) {
              await loadChildren();
            }
          }}
        >
          {expanded ? (
            <ExpandMore fontSize="small" />
          ) : (
            <ChevronRight fontSize="small" />
          )}
        </IconButton>
        <FolderIcon fontSize="small" />
        <Typography
          variant="body1"
          sx={{ cursor: "pointer" }}
          onClick={() => {
            params.set("parentId", String(folder.id));
            setParams(params, { replace: false });
          }}
        >
          {folder.name}
        </Typography>
      </Stack>

      {expanded && (
        <Box>
          <List dense disablePadding>
            {texts.map((t) => (
              <ListItem
                key={`t-${t.id}`}
                disableGutters
                sx={{ pl: (level + 1) * 2 }}
              >
                <DescriptionIcon sx={{ mr: 1 }} fontSize="small" />
                <ListItemText
                  primary={t.title}
                  onClick={() => navigate(`/texts/${t.id}`)}
                  sx={{ cursor: "pointer" }}
                />
              </ListItem>
            ))}
          </List>
          {children.map((child) => (
            <FolderItem key={child.id} folder={child} level={level + 1} />
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function FolderTree() {
  const [roots, setRoots] = useState<FolderDTO[]>([]);

  useEffect(() => {
    (async () => {
      const fs = await getJSON<FolderDTO[]>("/api/folders");
      setRoots(fs as FolderDTO[]);
    })();
  }, []);

  return (
    <Box>
      {roots.map((f) => (
        <FolderItem key={f.id} folder={f} level={0} />
      ))}
    </Box>
  );
}
