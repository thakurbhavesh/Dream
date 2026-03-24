import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  AvatarGroup,
  Box,
  Button,
  ButtonBase,
  Divider,
  IconButton,
  Popover,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { FaSquarePollVertical } from "react-icons/fa6";
import { PiCheckBold, PiEyeBold, PiStopCircleFill } from "react-icons/pi";
import { DEFAULT_PROFILE } from "../../../data/userProfile.js";
import useCurrentUser from "../../../hooks/useCurrentUser.js";

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatRemaining = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}d ${hours || 0}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes || 0}m`;
  }
  return `${minutes}m`;
};

const normalizeVoteState = (poll, currentUserId) => {
  // Explicit viewerVotes takes priority
  const viewerVotes = Array.isArray(poll?.viewerVotes) ? poll.viewerVotes.filter(Boolean) : [];
  if (viewerVotes.length > 0) return { optionIds: viewerVotes };
  // Derive from options.voters — find which options the current user voted on
  if (!currentUserId || !Array.isArray(poll?.options)) return { optionIds: [] };
  const votedIds = poll.options
    .filter(opt => Array.isArray(opt.voters) && opt.voters.some(v => String(v.id) === String(currentUserId)))
    .map(opt => opt.id);
  return { optionIds: votedIds };
};

const POLL_AVATAR_MAX = 4;
const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const PollMsg = ({ message, onAction, currentUserId }) => {
  const theme = useTheme();
  const currentUser = useCurrentUser();
  const POLL_PROGRESS_COLOR =
    theme.palette.mode === "light" ? "#c5ffcb" : "#6f7f8f ";
  const poll = message?.content ?? {};
  const pollTypeRaw = poll.type?.toLowerCase?.() || "single";
  const pollType = pollTypeRaw === "multiple" ? "multiple" : "single";
  const options = Array.isArray(poll.options) ? poll.options : [];
  const createdById = poll.createdBy?.id ?? message?.author?.id ?? null;
  const endAccess = poll.endAccess || "creator-or-admin";
  const viewerIsAdmin =
    message?.metadata?.viewerRole === "admin" ||
    message?.metadata?.viewerIsAdmin === true;
  const isCreator = Boolean(currentUserId && String(currentUserId) === String(createdById));
  const [voteState, setVoteState] = useState(() => normalizeVoteState(poll, currentUserId));
  const [localEndedAt, setLocalEndedAt] = useState(null);
  const endAt = toDate(poll.endAt);
  const endedAt = toDate(poll.endedAt) ?? localEndedAt;
  const [now, setNow] = useState(() => Date.now());
  const [localOptions, setLocalOptions] = useState(() => options);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

  useEffect(() => {
    setVoteState(normalizeVoteState(poll, currentUserId));
    setLocalOptions(options);
  }, [message?.id, poll, currentUserId]);

  useEffect(() => {
    if (!endAt || endedAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [endAt, endedAt]);
  const isEnded = Boolean(endedAt) || (endAt ? endAt.getTime() <= now : false);
  const canEndPoll =
    !isEnded &&
    (endAccess === "creator" ? isCreator : isCreator || viewerIsAdmin);
  const canShowResults = true;
  const totalVotes = useMemo(
    () => localOptions.reduce((sum, option) => sum + (option.votes || 0), 0),
    [localOptions]
  );
  const voterAvatars = Array.isArray(poll.voterAvatars)
    ? poll.voterAvatars.filter(Boolean)
    : [];
  const derivedVoters = useMemo(() => {
    if (voterAvatars.length) {
      return voterAvatars.map((avatar, index) => ({
        id: `avatar-${index}`,
        avatar,
      }));
    }
    const seen = new Set();
    const list = [];
    localOptions.forEach((option) => {
      const voters = Array.isArray(option.voters) ? option.voters : [];
      voters.forEach((voter) => {
        const key = voter?.id || voter?.name || voter?.avatar;
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push({
          id: key,
          avatar: voter?.avatar || "",
          name: voter?.name || "Voter",
        });
      });
    });
    return list;
  }, [localOptions, voterAvatars]);
  const visibleVoters = derivedVoters.slice(0, POLL_AVATAR_MAX);
  const remainingVoters = Math.max(0, totalVotes - visibleVoters.length);

  const canVoteReason = useMemo(() => {
    if (isEnded) return "Voting ended for this poll.";
    const access = poll.voteAccess || "any";
    if (access === "creator" && !isCreator) {
      return "Only the poll creator can vote.";
    }
    if (access === "admin" && !viewerIsAdmin) {
      return "Only admins can vote on this poll.";
    }
    return "";
  }, [isCreator, isEnded, poll.voteAccess, viewerIsAdmin]);

  const showSnackbar = useCallback((message) => {
    setSnackbar({ open: true, message });
  }, []);

  const closeSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleOptionToggle = useCallback(
    (optionId) => {
      if (canVoteReason) {
        showSnackbar(canVoteReason);
        return;
      }
      setVoteState((prev) => {
        if (pollType === "multiple") {
          const next = prev.optionIds.includes(optionId)
            ? prev.optionIds.filter((id) => id !== optionId)
            : [...prev.optionIds, optionId];
          return { ...prev, optionIds: next };
        }
        return { ...prev, optionIds: [optionId] };
      });
      setLocalOptions((prev) => {
      const viewer = currentUserId
        ? {
            id: currentUserId,
            name:
              currentUser?.displayName ||
              currentUser?.name ||
              DEFAULT_PROFILE.displayName ||
              "Myself",
            avatar: currentUser?.image || DEFAULT_PROFILE.avatar || "",
            initials: DEFAULT_PROFILE.initials || "MY",
          }
        : null;
        return prev.map((option) => {
          if (option.id !== optionId) {
            if (pollType === "single") {
              const wasSelected = voteState.optionIds.includes(option.id);
              if (wasSelected) {
                const nextVoters = Array.isArray(option.voters)
                  ? option.voters.filter((voter) => String(voter?.id) !== String(currentUserId))
                  : [];
                return {
                  ...option,
                  votes: Math.max(0, (option.votes || 0) - 1),
                  voters: nextVoters,
                };
              }
            }
            return option;
          }
          const alreadySelected = voteState.optionIds.includes(optionId);
          if (pollType === "multiple") {
            if (alreadySelected) {
              const nextVoters = Array.isArray(option.voters)
                ? option.voters.filter((voter) => String(voter?.id) !== String(currentUserId))
                : [];
              return {
                ...option,
                votes: Math.max(0, (option.votes || 0) - 1),
                voters: nextVoters,
              };
            }
            const nextVoters = Array.isArray(option.voters)
              ? [...option.voters, viewer].filter(Boolean)
              : viewer
                ? [viewer]
                : [];
            return {
              ...option,
              votes: (option.votes || 0) + 1,
              voters: nextVoters,
            };
          }
          if (alreadySelected) {
            return option;
          }
          const nextVoters = Array.isArray(option.voters)
            ? [...option.voters, viewer].filter(Boolean)
            : viewer
              ? [viewer]
              : [];
          return {
            ...option,
            votes: (option.votes || 0) + 1,
            voters: nextVoters,
          };
        });
      });
      onAction?.("poll-vote", { optionId, pollType });
    },
    [
      canVoteReason,
      currentUserId,
      message,
      onAction,
      pollType,
      showSnackbar,
      voteState.optionIds,
    ]
  );

  const handleEndPoll = useCallback(() => {
    if (!canEndPoll) return;
    setEndConfirmOpen(true);
  }, [canEndPoll]);

  const handleEndPollConfirm = () => {
    const endedAtValue = new Date();
    setLocalEndedAt(endedAtValue);
    onAction?.("poll-end", { endedAt: endedAtValue.toISOString() });
    setEndConfirmOpen(false);
  };

  const handleEndPollCancel = () => {
    setEndConfirmOpen(false);
  };

  const remainingLabel = useMemo(() => {
    if (!endAt || isEnded) return "";
    return `Vote ends in ${formatRemaining(endAt.getTime() - now)}`;
  }, [endAt, isEnded, now]);

  const [votesAnchorEl, setVotesAnchorEl] = useState(null);
  const votesOpen = Boolean(votesAnchorEl);
  const openVotes = (event) => setVotesAnchorEl(event.currentTarget);
  const closeVotes = () => setVotesAnchorEl(null);

  const renderOptionVoters = (voters) => {
    if (!Array.isArray(voters) || voters.length === 0) return null;
    return (
       <AvatarGroup
        max={3}
        sx={{ "& .MuiAvatar-root": { width: 22, height: 22 } }}
      >
        {voters.slice(0, 3).map((voter, index) => (
          <Avatar
            key={`${voter?.id || voter?.name || index}`}
            src={voter?.avatar ?? undefined}
            alt={voter?.name ?? "Voter"}
            sx={{
              width: 22,
              height: 22,
              border: "1px solid #fff",
              marginLeft: index === 0 ? 0 : -8,
              zIndex: index + 1,
              fontSize: 9,
            }}
          >
            {voter?.initials || getInitials(voter?.name || "")}
          </Avatar>
        ))}
      </AvatarGroup>
    );
  };

  return (
    <Stack spacing={1.5} minWidth={350}>
      <Stack spacing={0.5}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="start"
          spacing={1}
        >
          <Typography
            variant="subtitle2"
            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          >
            <FaSquarePollVertical
              size={16}
              stroke={2}
              color={theme.palette.primary.main}
            />
            <span style={{ fontWeight: 700 }}>Poll -</span>
          </Typography>
          <Typography variant="subtitle2">{poll.question || "Poll"}</Typography>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
        >
          <Typography variant="caption" color="text.secondary">
            {isEnded ? "Poll ended" : remainingLabel || "No end time"}
          </Typography>
          {canEndPoll && !isEnded ? (
            <Tooltip title="End poll" placement="top">
              <Typography variant="caption" color="text.warning">
                Stop
              </Typography>
              <IconButton size="small" color="error" onClick={handleEndPoll}>
                <PiStopCircleFill size={16} />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </Stack>

      <Stack spacing={1}>
        {localOptions.map((option, index) => {
          const selected = voteState.optionIds.includes(option.id);
          const optionVotes = Number(option.votes ?? 0);
          const percent =
            totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const optionVoters = Array.isArray(option.voters)
            ? option.voters
            : [];
          return (
            <Stack key={option.id} spacing={0.5}>
              <ButtonBase
                onClick={() => handleOptionToggle(option.id)}
                sx={{
                  width: "100%",
                  borderRadius: 9,
                  border: `1px solid ${
                    selected && canShowResults && totalVotes > 0
                      ? theme.palette.mode === "light"
                        ? theme.palette.success.dark
                        : POLL_PROGRESS_COLOR
                      : theme.palette.divider
                  }`,
                  px: 1,
                  py: 0.75,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  background:
                    canShowResults && totalVotes > 0
                      ? `linear-gradient(90deg, ${POLL_PROGRESS_COLOR} ${percent}%, ${
                          theme.palette.background.default
                        } ${percent}%)`
                      : theme.palette.background.default,
                  minHeight: "40px",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ minWidth: 0, flex: 1 }}
                >
                  {!isEnded ? (
                    pollType === "multiple" ? (
                      <Box
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: !selected
                            ? `1px solid ${theme.palette.divider}`
                            : "none",
                          backgroundColor: selected
                            ? POLL_PROGRESS_COLOR
                            : "transparent",
                          color: selected
                            ? theme.palette.text.primary
                            : theme.palette.text.secondary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                        }}
                      >
                        {selected ? (
                          <PiCheckBold
                            size={24}
                            color={
                              theme.palette.mode === "light"
                                ? theme.palette.success.dark
                                : null
                            }
                          />
                        ) : null}
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: !selected
                            ? `1px solid ${theme.palette.divider}`
                            : "none",
                          backgroundColor: selected
                            ? POLL_PROGRESS_COLOR
                            : "transparent",
                          color: selected
                            ? theme.palette.text.primary
                            : theme.palette.text.secondary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                        }}
                      >
                        {selected ? (
                          <PiCheckBold
                            size={24}
                            color={
                              theme.palette.mode === "light"
                                ? theme.palette.success.dark
                                : null
                            }
                          />
                        ) : null}
                      </Box>
                    )
                  ) : null}
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      minWidth: 0,
                      textAlign: "start"
                    }}
                  >
                    {option.label}
                  </Typography>
                </Stack>
                {canShowResults ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    {renderOptionVoters(optionVoters)}

                    <Typography variant="caption" color="text.secondary">
                      {percent}%
                    </Typography>
                  </Stack>
                ) : null}
              </ButtonBase>
            </Stack>
          );
        })}
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          width="100%"
        >
          {derivedVoters.length ? (
            <ButtonBase
              onClick={openVotes}
              sx={{ borderRadius: 999, px: 0.25 }}
            >
              <AvatarGroup
                max={POLL_AVATAR_MAX + 1}
                sx={{ "& .MuiAvatar-root": { width: 24, height: 24 } }}
              >
                {visibleVoters.map((voter, index) => (
                  <Avatar
                    key={`${voter.id}-${index}`}
                    src={voter.avatar || undefined}
                    alt={voter.name || "Voter"}
                    sx={{ fontSize: 9 }}
                  >
                    {voter.initials || getInitials(voter.name || "")}
                  </Avatar>
                ))}
                {remainingVoters > 0 ? (
                  <Avatar
                    sx={{
                      width: 24,
                      height: 24,
                      fontSize: 9,
                      bgcolor: "primary.main",
                      color: "#fff",
                      zIndex: 6,
                    }}
                  >
                    +{remainingVoters}
                  </Avatar>
                ) : null}
              </AvatarGroup>
            </ButtonBase>
          ) : null}
          <Typography variant="caption" color="text.secondary">
            {totalVotes} votes
          </Typography>
          {totalVotes > 0 && !derivedVoters.length ? (
            <Button
              size="small"
              onClick={openVotes}
              startIcon={<PiEyeBold size={14} />}
            >
              Open voting
            </Button>
          ) : null}
        </Stack>
      </Stack>
      <Popover
        open={votesOpen}
        anchorEl={votesAnchorEl}
        onClose={closeVotes}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: { p: 1.5, borderRadius: 1.5, minWidth: 260 },
        }}
      >
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Votes
          </Typography>
          <Divider />
          {localOptions
            .filter((option) => (option.votes || 0) > 0)
            .map((option) => {
              const optionVoters = Array.isArray(option.voters)
                ? option.voters
                : [];
              return (
                <Stack key={`votes-${option.id}`} spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {option.label}
                  </Typography>
                  {optionVoters.length ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {optionVoters.map((voter, index) => (
                        <Stack
                          key={`${option.id}-${voter?.id || index}`}
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                        >
                          <Avatar
                            src={voter?.avatar ?? undefined}
                            alt={voter?.name ?? "Voter"}
                            sx={{ width: 22, height: 22, fontSize: 9 }}
                          >
                            {voter?.initials || getInitials(voter?.name || "")}
                          </Avatar>
                          <Typography variant="caption">
                            {voter?.name ?? "Member"}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              );
            })}
        </Stack>
      </Popover>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={2600}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          severity="warning"
          onClose={closeSnackbar}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      <Snackbar
        open={endConfirmOpen}
        onClose={handleEndPollCancel}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          severity="warning"
          onClose={handleEndPollCancel}
          sx={{ width: "100%" }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleEndPollConfirm}
              sx={{ fontWeight: 600 }}
            >
              End poll
            </Button>
          }
        >
          End this poll?
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default PollMsg;

