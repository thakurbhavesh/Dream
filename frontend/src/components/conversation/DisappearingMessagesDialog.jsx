import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
} from "@mui/material";

const TIMER_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 86400, label: "24 hours" },
  { value: 604800, label: "7 days" },
  { value: 2592000, label: "30 days" },
];

const DisappearingMessagesDialog = ({ open, onClose, currentTimer = 0, onSave }) => {
  const [selected, setSelected] = useState(currentTimer || 0);

  const handleSave = () => {
    onSave?.(Number(selected));
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Disappearing Messages</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          When enabled, new messages will disappear after the selected time period.
        </Typography>
        <FormControl>
          <RadioGroup value={String(selected)} onChange={(e) => setSelected(e.target.value)}>
            {TIMER_OPTIONS.map((opt) => (
              <FormControlLabel
                key={opt.value}
                value={String(opt.value)}
                control={<Radio size="small" />}
                label={opt.label}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DisappearingMessagesDialog;
