import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { PiPlusBold, PiTrashSimpleBold } from "react-icons/pi";

const END_PRESETS = [
  { id: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { id: "12h", label: "12 hours", ms: 12 * 60 * 60 * 1000 },
  { id: "1d", label: "1 day", ms: 24 * 60 * 60 * 1000 },
];

const createOption = (index) => ({
  id: `opt-${Date.now()}-${index}`,
  label: "",
});

const PollComposerDialog = ({
  open,
  onClose,
  onSubmit,
  currentUser,
  initialPoll = null,
  title = "Create poll",
  submitLabel = "Create poll",
}) => {
  const [question, setQuestion] = useState("");
  const [pollType, setPollType] = useState("single");
  const [options, setOptions] = useState([createOption(0), createOption(1)]);
  const [endMode, setEndMode] = useState("never");
  const [endPreset, setEndPreset] = useState("1h");
  const [customEndAt, setCustomEndAt] = useState("");
  const [showResultsBeforeVote, setShowResultsBeforeVote] = useState(false);
  const [endAccess, setEndAccess] = useState("creator-or-admin");

  useEffect(() => {
    if (!open) return;
    if (initialPoll) {
      const pollTypeValue =
        initialPoll.type === "multiple" ? "multiple" : "single";
      const nextOptions = Array.isArray(initialPoll.options)
        ? initialPoll.options.map((option, index) => ({
            id: option.id || `opt-${index + 1}`,
            label: option.label || "",
          }))
        : [];
      setQuestion(initialPoll.question || "");
      setPollType(pollTypeValue);
      setOptions(nextOptions.length ? nextOptions : [createOption(0), createOption(1)]);
      if (initialPoll.endAt) {
        setEndMode("custom");
        const endDate = new Date(initialPoll.endAt);
        const isoValue = Number.isNaN(endDate.getTime())
          ? ""
          : endDate.toISOString().slice(0, 16);
        setCustomEndAt(isoValue);
      } else {
        setEndMode("never");
        setCustomEndAt("");
      }
      setEndPreset("1h");
      setShowResultsBeforeVote(Boolean(initialPoll.showResultsBeforeVote));
      setEndAccess(initialPoll.endAccess || "creator-or-admin");
      return;
    }
    setQuestion("");
    setPollType("single");
    setOptions([createOption(0), createOption(1)]);
    setEndMode("never");
    setEndPreset("1h");
    setCustomEndAt("");
    setShowResultsBeforeVote(false);
    setEndAccess("creator-or-admin");
  }, [open, initialPoll]);

  const canSubmit = useMemo(() => {
    if (!question.trim()) return false;
    const filled = options.filter((option) => option.label.trim());
    return filled.length >= 2;
  }, [options, question]);

  const handleOptionChange = (id, value) => {
    setOptions((prev) =>
      prev.map((option) =>
        option.id === id ? { ...option, label: value } : option
      )
    );
  };

  const handleOptionRemove = (id) => {
    setOptions((prev) => prev.filter((option) => option.id !== id));
  };

  const handleAddOption = () => {
    setOptions((prev) => [...prev, createOption(prev.length)]);
  };

  const resolveEndAt = () => {
    if (endMode === "never") return null;
    if (endMode === "preset") {
      const preset = END_PRESETS.find((item) => item.id === endPreset);
      if (!preset) return null;
      return new Date(Date.now() + preset.ms).toISOString();
    }
    if (!customEndAt) return null;
    const parsed = new Date(customEndAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const cleanedOptions = options
      .map((option) => ({
        ...option,
        label: option.label.trim(),
      }))
      .filter((option) => option.label);
    const pollPayload = {
      question: question.trim(),
      type: pollType,
      options: cleanedOptions,
      allowMultiple: pollType === "multiple",
      endAt: resolveEndAt(),
      createdBy: initialPoll?.createdBy ?? currentUser ?? null,
      endAccess,
      editAccess: initialPoll?.editAccess || endAccess,
      showResultsBeforeVote,
      totalVotes: 0,
    };
    onSubmit?.(pollPayload);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            fullWidth
            inputProps={{ maxLength: 140 }}
          />
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Options
            </Typography>
            {options.map((option, index) => (
              <Stack
                key={option.id}
                direction="row"
                spacing={1}
                alignItems="center"
              >
                <TextField
                  value={option.label}
                  onChange={(event) =>
                    handleOptionChange(option.id, event.target.value)
                  }
                  size="small"
                  placeholder={`Option ${index + 1}`}
                  fullWidth
                />
                <IconButton
                  size="small"
                  onClick={() => handleOptionRemove(option.id)}
                  disabled={options.length <= 2}
                >
                  <PiTrashSimpleBold size={16} />
                </IconButton>
              </Stack>
            ))}
            <Button
              variant="outlined"
              size="small"
              startIcon={<PiPlusBold />}
              onClick={handleAddOption}
              sx={{ alignSelf: "flex-start" }}
            >
              Add option
            </Button>
          </Stack>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Poll type
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
              <Typography
                variant="body2"
                color={pollType === "single" ? "text.primary" : "text.secondary"}
              >
                Single
              </Typography>
              <Switch
                checked={pollType === "multiple"}
                onChange={(event) =>
                  setPollType(event.target.checked ? "multiple" : "single")
                }
              />
              <Typography
                variant="body2"
                color={pollType === "multiple" ? "text.primary" : "text.secondary"}
              >
                Multiple
              </Typography>
            </Stack>
          </Box>

          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Stack spacing={0.75} sx={{ flex: 1 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="caption" color="text.secondary">
                  Vote ends
                </Typography>
                <Select
                  size="small"
                  value={endMode}
                  onChange={(event) => setEndMode(event.target.value)}
                  sx={{ minWidth: 120, borderRadius: 2 }}
                >
                  <MenuItem value="never">Never</MenuItem>
                  <MenuItem value="preset">Preset</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </Stack>
              {endMode === "preset" ? (
                <Select
                  size="small"
                  value={endPreset}
                  onChange={(event) => setEndPreset(event.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  {END_PRESETS.map((preset) => (
                    <MenuItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </MenuItem>
                  ))}
                </Select>
              ) : null}
              {endMode === "custom" ? (
                <TextField
                  type="datetime-local"
                  size="small"
                  value={customEndAt}
                  onChange={(event) => setCustomEndAt(event.target.value)}
                  sx={{ borderRadius: 2 }}
                />
              ) : null}
            </Stack>
            <Stack spacing={0.75} sx={{ flex: 1 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="caption" color="text.secondary">
                  Who can end
                </Typography>
                <Select
                  size="small"
                  value={endAccess}
                  onChange={(event) => setEndAccess(event.target.value)}
                  sx={{ minWidth: 150, borderRadius: 2 }}
                >
                  <MenuItem value="creator">Creator only</MenuItem>
                  <MenuItem value="creator-or-admin">Creator + Admin</MenuItem>
                </Select>
              </Stack>
            </Stack>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch
              checked={showResultsBeforeVote}
              onChange={(event) => setShowResultsBeforeVote(event.target.checked)}
            />
            <Typography variant="body2">
              Show results before voting
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PollComposerDialog;
