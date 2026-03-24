import { FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import FormCard from "../forms/FormCard";

const defaultSettings = [
  { id: 1, label: "Require device PIN", description: "Adds an app-level PIN prompt", enabled: true },
  { id: 2, label: "Block rooted devices", description: "Stops logins from compromised phones", enabled: true },
  { id: 3, label: "Auto-lock on idle", description: "Lock conversations after 10 mins", enabled: false },
];

const Settings = ({ items = defaultSettings, onToggle }) => (
  <FormCard title="Security Settings">
    <Stack spacing={1.5}>
      {items.map((setting) => (
        <Stack key={setting.id} spacing={0.3}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography fontWeight={600}>{setting.label}</Typography>
            <FormControlLabel
              control={<Switch checked={setting.enabled} onChange={(event) => onToggle?.(setting.id, event.target.checked)} />}
              label=""
              sx={{ m: 0 }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {setting.description}
          </Typography>
        </Stack>
      ))}
    </Stack>
  </FormCard>
);

export default Settings;
