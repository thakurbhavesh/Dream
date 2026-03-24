import { MenuItem, Stack, TextField } from "@mui/material";

export const TimeWindowInputs = ({ value, onChange, includeDays = false }) => (
  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
    <TextField
      select
      label="hrs"
      size="small"
      value={value.hours}
      onChange={(event) => onChange({ ...value, hours: Number(event.target.value) })}
      sx={{ width: 120 }}
    >
      {Array.from({ length: 13 }).map((_, idx) => (
        <MenuItem key={idx} value={idx}>
          {idx}
        </MenuItem>
      ))}
    </TextField>
    <TextField
      select
      label="mins"
      size="small"
      value={value.minutes}
      onChange={(event) => onChange({ ...value, minutes: Number(event.target.value) })}
      sx={{ width: 120 }}
    >
      {[0, 5, 10, 15, 30, 60].map((minute) => (
        <MenuItem key={minute} value={minute}>
          {minute}
        </MenuItem>
      ))}
    </TextField>
    {includeDays && (
      <TextField
        select
        label="days"
        size="small"
        value={value.days}
        onChange={(event) => onChange({ ...value, days: Number(event.target.value) })}
        sx={{ width: 120 }}
      >
        {[1, 2, 3, 7].map((day) => (
          <MenuItem key={day} value={day}>
            {day}
          </MenuItem>
        ))}
      </TextField>
    )}
  </Stack>
);
