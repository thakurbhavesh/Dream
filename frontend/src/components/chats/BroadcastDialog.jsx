import { useState, useMemo, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Checkbox,
  Typography,
  Box,
  Chip,
  Stack,
  CircularProgress,
  InputAdornment,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  LinearProgress,
} from "@mui/material";
import {
  PiMagnifyingGlassBold,
  PiUsersBold,
  PiUsersThreeBold,
  PiPaperclipBold,
  PiFileBold,
  PiImageBold,
  PiXBold,
  PiShareFatBold,
} from "react-icons/pi";
import { uploadChatFileWithProgress } from "../../services/chatApi.js";

const BroadcastDialog = ({ open, onClose, contacts = [], threads = [], onSend }) => {
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState(0); // 0 = contacts, 1 = groups
  const [attachedFiles, setAttachedFiles] = useState([]); // [{ file, preview, uploading, progress, uploaded, data }]
  const fileInputRef = useRef(null);

  // Filter groups from threads — only active membership (not left/removed)
  const groupList = useMemo(() => {
    if (!Array.isArray(threads)) return [];
    return threads.filter(
      (t) =>
        (t?.id?.startsWith?.("group-") ||
        t?.threadType === "group" ||
        t?.type === "group") &&
        !t?.hasLeft &&
        t?.status !== "removed" &&
        t?.status !== "left"
    ).map((t) => ({
      id: t.group_id || t.id?.replace?.("group-", "") || t.id,
      threadId: t.id,
      name: t.groupName || t.label || t.name || "Group",
      avatar: t.groupImage || t.avatar || t.image || "",
      memberCount: t.memberCount || t.members?.length || 0,
    }));
  }, [threads]);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.label || c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupList;
    const q = search.toLowerCase();
    return groupList.filter((g) => (g.name || "").toLowerCase().includes(q));
  }, [groupList, search]);

  const toggleContact = (id) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (id) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllContacts = () => {
    const allIds = filteredContacts.map((c) => c.id);
    setSelectedContactIds((prev) => {
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  };

  const selectAllGroups = () => {
    const allIds = filteredGroups.map((g) => g.id);
    setSelectedGroupIds((prev) => {
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  };

  // File handling
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newAttachments = files.map((file) => ({
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      uploading: false,
      progress: 0,
      uploaded: false,
      data: null,
    }));
    setAttachedFiles((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  };

  const removeFile = (id) => {
    setAttachedFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const uploadFile = async (attachment) => {
    setAttachedFiles((prev) =>
      prev.map((f) => (f.id === attachment.id ? { ...f, uploading: true, progress: 0 } : f))
    );
    try {
      const result = await uploadChatFileWithProgress(attachment.file, {
        onProgress: (pct) => {
          setAttachedFiles((prev) =>
            prev.map((f) => (f.id === attachment.id ? { ...f, progress: pct } : f))
          );
        },
      });
      setAttachedFiles((prev) =>
        prev.map((f) =>
          f.id === attachment.id ? { ...f, uploading: false, uploaded: true, progress: 100, data: result } : f
        )
      );
      return result;
    } catch (err) {
      console.error("Upload failed:", err);
      setAttachedFiles((prev) =>
        prev.map((f) => (f.id === attachment.id ? { ...f, uploading: false, progress: 0 } : f))
      );
      return null;
    }
  };

  const handleSend = async () => {
    const hasText = message.trim().length > 0;
    const hasFiles = attachedFiles.length > 0;
    if ((!hasText && !hasFiles) || (selectedContactIds.size === 0 && selectedGroupIds.size === 0)) return;

    setSending(true);
    setResult(null);

    try {
      // Upload any files that aren't uploaded yet
      for (const att of attachedFiles) {
        if (!att.uploaded && !att.uploading) {
          await uploadFile(att);
        }
      }

      // Get uploaded file data
      const uploadedFiles = attachedFiles
        .map((f) => f.data)
        .filter(Boolean);

      if (hasFiles && uploadedFiles.length === 0) {
        setResult({ error: "File upload failed" });
        setSending(false);
        return;
      }

      // Send text message broadcast
      if (hasText) {
        const textRes = await onSend?.({
          contactIds: Array.from(selectedContactIds),
          groupIds: Array.from(selectedGroupIds),
          message: message.trim(),
          messageType: "text",
        });
        if (textRes?.error) {
          setResult(textRes);
          setSending(false);
          return;
        }
      }

      // Send each file as separate broadcast message
      for (const fileData of uploadedFiles) {
        const isImage = fileData.file_type?.startsWith("image/");
        await onSend?.({
          contactIds: Array.from(selectedContactIds),
          groupIds: Array.from(selectedGroupIds),
          message: fileData.file_url || fileData.url,
          messageType: isImage ? "image" : "file",
          metadata: {
            file_key: fileData.file_key || fileData.key,
            file_url: fileData.file_url || fileData.url,
            file_name: fileData.file_name || fileData.name || fileData.file?.name,
            file_type: fileData.file_type || fileData.type,
            file_size: fileData.file_size || fileData.size,
          },
        });
      }

      const totalTargets = selectedContactIds.size + selectedGroupIds.size;
      setResult({ ok: true, sent: totalTargets, failed: 0 });
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;
    setMessage("");
    setSelectedContactIds(new Set());
    setSelectedGroupIds(new Set());
    setSearch("");
    setResult(null);
    setTab(0);
    // Clean up file previews
    attachedFiles.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setAttachedFiles([]);
    onClose?.();
  };

  const totalSelected = selectedContactIds.size + selectedGroupIds.size;
  const hasContent = message.trim().length > 0 || attachedFiles.length > 0;

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PiShareFatBold size={20} />
          <Typography variant="h6" fontWeight={600}>Broadcast Message</Typography>
        </Stack>
        <IconButton size="small" onClick={handleClose}>
          <PiXBold size={16} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {/* Selected chips */}
          {totalSelected > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {Array.from(selectedContactIds).map((id) => {
                const c = contacts.find((c) => c.id === id);
                return (
                  <Chip
                    key={`c-${id}`}
                    label={c?.label || c?.name || id}
                    size="small"
                    avatar={<Avatar src={c?.avatar || c?.profilePicture} sx={{ width: 20, height: 20 }}>{(c?.label || c?.name || "?")[0]}</Avatar>}
                    onDelete={() => toggleContact(id)}
                    color="primary"
                    variant="outlined"
                  />
                );
              })}
              {Array.from(selectedGroupIds).map((id) => {
                const g = groupList.find((g) => String(g.id) === String(id));
                return (
                  <Chip
                    key={`g-${id}`}
                    label={g?.name || id}
                    size="small"
                    icon={<PiUsersThreeBold size={14} />}
                    onDelete={() => toggleGroup(id)}
                    color="secondary"
                    variant="outlined"
                  />
                );
              })}
            </Box>
          )}

          {/* Tabs: Contacts / Groups */}
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36 }}>
            <Tab
              icon={<PiUsersBold size={14} />}
              iconPosition="start"
              label={`Contacts (${contacts.length})`}
              sx={{ minHeight: 36, textTransform: "none", fontSize: 13 }}
            />
            <Tab
              icon={<PiUsersThreeBold size={14} />}
              iconPosition="start"
              label={`Groups (${groupList.length})`}
              sx={{ minHeight: 36, textTransform: "none", fontSize: 13 }}
            />
          </Tabs>

          {/* Search */}
          <TextField
            size="small"
            fullWidth
            placeholder={tab === 0 ? "Search contacts..." : "Search groups..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PiMagnifyingGlassBold size={16} />
                </InputAdornment>
              ),
            }}
          />

          {/* Select All */}
          <Stack direction="row" justifyContent="flex-end">
            <Button
              size="small"
              onClick={tab === 0 ? selectAllContacts : selectAllGroups}
              sx={{ textTransform: "none", fontSize: 12 }}
            >
              {tab === 0
                ? (filteredContacts.every((c) => selectedContactIds.has(c.id)) && filteredContacts.length > 0 ? "Deselect All" : "Select All")
                : (filteredGroups.every((g) => selectedGroupIds.has(g.id)) && filteredGroups.length > 0 ? "Deselect All" : "Select All")
              }
            </Button>
          </Stack>

          {/* Contact/Group list */}
          <Box sx={{ maxHeight: 220, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
            {tab === 0 ? (
              <List dense disablePadding>
                {filteredContacts.map((c) => (
                  <ListItemButton key={c.id} onClick={() => toggleContact(c.id)}>
                    <Checkbox size="small" checked={selectedContactIds.has(c.id)} tabIndex={-1} sx={{ mr: 1 }} />
                    <ListItemAvatar sx={{ minWidth: 36 }}>
                      <Avatar sx={{ width: 28, height: 28 }} src={c.avatar || c.profilePicture}>
                        {(c.label || c.name || "?")[0]}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={c.label || c.name}
                      secondary={c.email || ""}
                      primaryTypographyProps={{ variant: "body2" }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItemButton>
                ))}
                {filteredContacts.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                    No contacts found
                  </Typography>
                )}
              </List>
            ) : (
              <List dense disablePadding>
                {filteredGroups.map((g) => (
                  <ListItemButton key={g.id} onClick={() => toggleGroup(g.id)}>
                    <Checkbox size="small" checked={selectedGroupIds.has(g.id)} tabIndex={-1} sx={{ mr: 1 }} />
                    <ListItemAvatar sx={{ minWidth: 36 }}>
                      <Avatar sx={{ width: 28, height: 28 }} src={g.avatar}>
                        <PiUsersThreeBold size={14} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={g.name}
                      primaryTypographyProps={{ variant: "body2" }}
                    />
                  </ListItemButton>
                ))}
                {filteredGroups.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                    No groups found
                  </Typography>
                )}
              </List>
            )}
          </Box>

          {/* Message input */}
          <TextField
            multiline
            rows={3}
            fullWidth
            placeholder="Type your broadcast message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          {/* File attachments */}
          {attachedFiles.length > 0 && (
            <Stack spacing={0.5}>
              {attachedFiles.map((att) => (
                <Stack
                  key={att.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ p: 1, bgcolor: "action.hover", borderRadius: 1 }}
                >
                  {att.preview ? (
                    <Box
                      component="img"
                      src={att.preview}
                      sx={{ width: 36, height: 36, borderRadius: 1, objectFit: "cover" }}
                    />
                  ) : (
                    <PiFileBold size={24} />
                  )}
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" noWrap>{att.file.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatSize(att.file.size)}
                      {att.uploaded && " — Uploaded"}
                    </Typography>
                    {att.uploading && <LinearProgress variant="determinate" value={att.progress} sx={{ mt: 0.5, height: 3, borderRadius: 2 }} />}
                  </Stack>
                  <IconButton size="small" onClick={() => removeFile(att.id)} disabled={att.uploading}>
                    <PiXBold size={14} />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}

          {/* Attach button */}
          <Stack direction="row" spacing={1}>
            <Tooltip title="Attach files">
              <Button
                size="small"
                variant="outlined"
                startIcon={<PiPaperclipBold size={16} />}
                onClick={() => fileInputRef.current?.click()}
                sx={{ textTransform: "none" }}
              >
                Attach File
              </Button>
            </Tooltip>
            <Tooltip title="Attach image">
              <Button
                size="small"
                variant="outlined"
                startIcon={<PiImageBold size={16} />}
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.click();
                    fileInputRef.current.accept = "";
                  }
                }}
                sx={{ textTransform: "none" }}
              >
                Image
              </Button>
            </Tooltip>
          </Stack>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={handleFileSelect}
          />

          {/* Result */}
          {result && (
            <Typography
              variant="body2"
              color={result.ok ? "success.main" : "error.main"}
              sx={{ textAlign: "center" }}
            >
              {result.ok
                ? `Sent to ${result.sent} target(s)!`
                : result.error || "Broadcast failed"}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={sending} color="inherit">Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={sending || !hasContent || totalSelected === 0}
          startIcon={sending ? <CircularProgress size={16} /> : <PiShareFatBold size={16} />}
        >
          {sending ? "Sending..." : `Send to ${totalSelected} target(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BroadcastDialog;
