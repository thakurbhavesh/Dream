import { Chip, LinearProgress, Stack, Typography } from "@mui/material";
import FormCard from "../forms/FormCard";

const defaultTrack = [
  { id: 1, label: "API Calls", value: 72 },
  { id: 2, label: "Automation Rules", value: 48 },
  { id: 3, label: "Device Trust", value: 35 },
];

const Track = ({ metrics = defaultTrack }) => (
  <FormCard title="Automation Trackers">
    <Stack spacing={2}>
      {metrics.map((metric) => (
        <Stack key={metric.id} spacing={0.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={600}>{metric.label}</Typography>
            <Chip label={`${metric.value}%`} size="small" color="primary" variant="outlined" />
          </Stack>
          <LinearProgress variant="determinate" value={metric.value} sx={{ height: 6, borderRadius: 10 }} />
        </Stack>
      ))}
    </Stack>
  </FormCard>
);

export default Track;
