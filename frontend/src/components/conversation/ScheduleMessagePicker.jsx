import { useState } from "react";
import {
  Popover,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  TextField,
  Button,
  Stack,
  Typography,
} from "@mui/material";
import {
  PiClockBold,
  PiMoonBold,
  PiSunBold,
  PiCalendarBold,
} from "react-icons/pi";

const getQuickOptions = () => {
  const now = new Date();

  const in1h = new Date(now.getTime() + 3600000);

  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  if (tonight <= now) tonight.setDate(tonight.getDate() + 1);

  const tomorrow9am = new Date(now);
  tomorrow9am.setDate(tomorrow9am.getDate() + 1);
  tomorrow9am.setHours(9, 0, 0, 0);

  return [
    { label: "In 1 hour", icon: PiClockBold, date: in1h },
    { label: "Tonight 8:00 PM", icon: PiMoonBold, date: tonight },
    { label: "Tomorrow 9:00 AM", icon: PiSunBold, date: tomorrow9am },
  ];
};

const formatDate = (d) =>
  d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
  " " +
  d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const ScheduleMessagePicker = ({ anchorEl, open, onClose, onSchedule }) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const quickOptions = getQuickOptions();

  const handleQuickSelect = (date) => {
    onSchedule?.(date.toISOString());
    onClose?.();
  };

  const handleCustomSchedule = () => {
    if (!customDate || !customTime) return;
    const dt = new Date(`${customDate}T${customTime}`);
    if (dt <= new Date()) return;
    onSchedule?.(dt.toISOString());
    onClose?.();
    setShowCustom(false);
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={() => { onClose?.(); setShowCustom(false); }}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 260 } } }}
    >
      <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 0.5, fontWeight: 600 }}>
        Schedule Message
      </Typography>
      {!showCustom ? (
        <>
          <List dense disablePadding>
            {quickOptions.map((opt) => (
              <ListItemButton key={opt.label} onClick={() => handleQuickSelect(opt.date)}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <opt.icon size={18} />
                </ListItemIcon>
                <ListItemText
                  primary={opt.label}
                  secondary={formatDate(opt.date)}
                />
              </ListItemButton>
            ))}
          </List>
          <Divider />
          <ListItemButton onClick={() => setShowCustom(true)}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <PiCalendarBold size={18} />
            </ListItemIcon>
            <ListItemText primary="Custom date & time" />
          </ListItemButton>
        </>
      ) : (
        <Stack spacing={1.5} sx={{ p: 2 }}>
          <TextField
            type="date"
            size="small"
            label="Date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().split("T")[0] }}
          />
          <TextField
            type="time"
            size="small"
            label="Time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={() => setShowCustom(false)}>Back</Button>
            <Button
              size="small"
              variant="contained"
              disabled={!customDate || !customTime}
              onClick={handleCustomSchedule}
            >
              Schedule
            </Button>
          </Stack>
        </Stack>
      )}
    </Popover>
  );
};

export default ScheduleMessagePicker;
