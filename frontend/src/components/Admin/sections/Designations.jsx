import { Chip, Stack, Typography } from "@mui/material";
import FormCard from "../forms/FormCard";

const defaultDesignations = [
  { id: 1, title: "Admin", scope: "Full access" },
  { id: 2, title: "Manager", scope: "Teams + Billing" },
  { id: 3, title: "Member", scope: "Standard" },
];

const Designations = ({ items = defaultDesignations }) => (
  <FormCard title="Designations">
    <Stack spacing={2}>
      {items.map((item) => (
        <Stack key={item.id} direction="row" alignItems="center" justifyContent="space-between">
          <Stack>
            <Typography fontWeight={600}>{item.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {item.scope}
            </Typography>
          </Stack>
          <Chip label="Active" size="small" color="success" variant="outlined" />
        </Stack>
      ))}
    </Stack>
  </FormCard>
);

export default Designations;
