import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Slide,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { PiMagnifyingGlass, PiUsersThreeBold, PiXBold } from "react-icons/pi";
import CustomScrollbars from "../Scrollbar.jsx";
import { getInitials } from "../../utils/initials.js";

const DialogSlideUp = forwardRef(function DialogSlideUp(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const getMemberId = (member) =>
  member?.id ||
  member?.user_id ||
  member?.userId ||
  member?.email ||
  member?.username ||
  member?.name ||
  member?.label ||
  null;

const normalizeMemberEntry = (member) => {
  if (!member) return null;
  const id = getMemberId(member);
  if (!id) return null;
  return {
    id,
    name: member.name || member.label || member.username || "Member",
    label: member.label || member.name || member.username || "Member",
    email: member.email || "",
    avatar: member.avatar || member.profilePicture || member.photo || "",
    isSelf: Boolean(member.isSelf),
  };
};

const GroupMembersDialog = ({
  open,
  mode = "create",
  title,
  submitLabel,
  members = [],
  currentUser = null,
  initialSelected = [],
  initialName = "",
  initialDescription = "",
  initialAvatar = "",
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchValue, setSearchValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const avatarInputRef = useRef(null);

  const allMembers = useMemo(() => {
    const normalized = [];
    const seen = new Set();
    const add = (entry) => {
      const item = normalizeMemberEntry(entry);
      if (!item || seen.has(item.id)) return;
      seen.add(item.id);
      normalized.push(item);
    };
    if (currentUser && currentUser.id) {
      add({
        id: currentUser.id,
        name: currentUser.name || currentUser.label || "You",
        label: currentUser.label || currentUser.name || "You",
        email: currentUser.email || "",
        avatar: currentUser.avatar || "",
        isSelf: true,
      });
    }
    members.forEach(add);
    initialSelected.forEach(add);
    return normalized;
  }, [currentUser, initialSelected, members]);

  const selfMemberId = useMemo(
    () => (currentUser?.id ? currentUser.id : null),
    [currentUser?.id]
  );

  useEffect(() => {
    if (!open) return;
    setName(initialName || "");
    setDescription(initialDescription || "");
    setAvatarPreview(initialAvatar || "");
    const seededIds = new Set(
      (initialSelected || [])
        .map((member) => getMemberId(member))
        .filter(Boolean)
    );
    if (selfMemberId) {
      seededIds.add(selfMemberId);
    }
    setSelectedIds(seededIds);
    setSearchValue("");
    setErrorMessage("");
  }, [
    initialAvatar,
    initialDescription,
    initialName,
    initialSelected,
    open,
    selfMemberId,
  ]);

  const selectedMembers = useMemo(
    () => allMembers.filter((member) => selectedIds.has(member.id)),
    [allMembers, selectedIds]
  );

  const availableMembers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return allMembers.filter((member) => {
      if (selectedIds.has(member.id)) return false;
      if (!query) return true;
      const haystack = `${member.name} ${member.label} ${member.email}`
        .toLowerCase()
        .trim();
      return haystack.includes(query);
    });
  }, [allMembers, searchValue, selectedIds]);

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result || "");
    };
    reader.onerror = () => {
      setAvatarPreview("");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleAddMember = (memberId) => {
    setSelectedIds((prev) => new Set(prev).add(memberId));
  };

  const handleRemoveMember = (memberId) => {
    if (memberId === selfMemberId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage("Group name is required");
      return;
    }
    if (selectedIds.size === 0) {
      setErrorMessage("Select at least one member");
      return;
    }
    setErrorMessage("");
    const payload = {
      name: trimmed,
      description: description.trim(),
      avatar: avatarPreview,
      members: selectedMembers,
    };
    const result = await onSubmit?.(payload);
    if (result === false) {
      setErrorMessage(
        mode === "edit" ? "Unable to update group" : "Unable to create group"
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      TransitionComponent={DialogSlideUp}
      PaperProps={{
        sx: {
          width: "100%",
          maxWidth: "1200px",
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title || (mode === "edit" ? "Edit Group" : "Create Group")}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose}>
          <PiXBold size={16} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box sx={{ position: "relative", mt: 0.5 }}>
              <Avatar
                src={avatarPreview || undefined}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: avatarPreview ? "transparent" : "transparent",
                  color: "text.secondary",
                  cursor: "pointer",
                  border: "1px dashed",
                  borderColor: "divider",
                }}
                onClick={handleAvatarClick}
              >
                {avatarPreview ? null : <PiUsersThreeBold size={22} />}
              </Avatar>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: "none" }}
              />
            </Box>
            <Stack spacing={1.5} sx={{ flex: 1 }}>
              <TextField
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Group Name"
                variant="standard"
                fullWidth
                InputProps={{ disableUnderline: false }}
              />
              <TextField
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Purpose / Description"
                variant="standard"
                fullWidth
                multiline
                minRows={2}
                inputProps={{ maxLength: 100 }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ alignSelf: "flex-end" }}
              >
                Characters Left {Math.max(0, 100 - description.length)}
              </Typography>
            </Stack>
          </Stack>
          {errorMessage ? (
            <Alert severity="error">{errorMessage}</Alert>
          ) : null}
          <Divider />
          <Stack direction="row" spacing={2} sx={{ minHeight: 360 }}>
            <Stack sx={{ flex: 1, minWidth: 0 }} spacing={1}>
              <TextField
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Add Members"
                variant="standard"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PiMagnifyingGlass size={16} />
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <CustomScrollbars autoHide={false}>
                  <List
                    dense
                    sx={{
                      bgcolor: "background.paper",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    {availableMembers.length ? (
                      availableMembers.map((member) => (
                        <ListItem
                          key={`available-${member.id}`}
                          onClick={() => handleAddMember(member.id)}
                          sx={{
                            cursor: "pointer",
                            "&:hover": {
                              bgcolor: "action.hover",
                            },
                          }}
                        >
                          <ListItemAvatar>
                            <Box sx={{ position: "relative" }}>
                              <Avatar src={member.avatar || undefined}>
                                {!member.avatar
                                  ? getInitials(member.name)
                                  : null}
                              </Avatar>
                              {(member.isGlobalMember || member.isGlobal || member.is_global || member.is_global_member) && (
                                <Box sx={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", bgcolor: "#FFB020", border: "2px solid #fff" }} />
                              )}
                            </Box>
                          </ListItemAvatar>
                          <ListItemText
                            primary={member.label || member.name}
                            secondary={member.email || ""}
                          />
                        </ListItem>
                      ))
                    ) : (
                      <ListItem>
                        <ListItemText
                          primary="No members found"
                          primaryTypographyProps={{
                            variant: "body2",
                            color: "text.secondary",
                          }}
                        />
                      </ListItem>
                    )}
                  </List>
                </CustomScrollbars>
              </Box>
            </Stack>
            <Stack sx={{ flex: 1, minWidth: 0 }} spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Selected Members ({selectedMembers.length})
              </Typography>
              <Box sx={{ flex: 1, minHeight: 0,height: "100%" }}>
                <CustomScrollbars>
                  <List
                    dense
                    sx={{
                      bgcolor: "background.paper",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    {selectedMembers.map((member) => (
                      <ListItem
                        key={`selected-${member.id}`}
                        onClick={() => handleRemoveMember(member.id)}
                        sx={{
                          cursor: member.id === selfMemberId ? "default" : "pointer",
                          "&:hover": {
                            bgcolor:
                              member.id === selfMemberId
                                ? "transparent"
                                : "action.hover",
                          },
                        }}
                      >
                        <ListItemAvatar>
                          <Box sx={{ position: "relative" }}>
                            <Avatar src={member.avatar || undefined}>
                              {!member.avatar
                                ? getInitials(member.name)
                                : null}
                            </Avatar>
                            {(member.isGlobalMember || member.isGlobal || member.is_global || member.is_global_member) && (
                              <Box sx={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", bgcolor: "#FFB020", border: "2px solid #fff" }} />
                            )}
                          </Box>
                        </ListItemAvatar>
                        <ListItemText
                          primary={member.label || member.name}
                          secondary={member.email || ""}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CustomScrollbars>
              </Box>
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>
          {submitLabel || (mode === "edit" ? "Submit" : "Create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GroupMembersDialog;
