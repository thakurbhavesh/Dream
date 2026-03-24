import { Stack, Typography } from "@mui/material";
import FormCard from "../forms/FormCard";

const defaultLocations = [
  { id: 1, city: "Bengaluru", country: "India", floor: "10F" },
  { id: 2, city: "Pune", country: "India", floor: "5F" },
  { id: 3, city: "Austin", country: "USA", floor: "HQ" },
];

const Locations = ({ items = defaultLocations }) => (
  <FormCard title="Locations">
    <Stack spacing={2}>
      {items.map((loc) => (
        <Stack key={loc.id} spacing={0.25}>
          <Typography fontWeight={600}>{loc.city}</Typography>
          <Typography variant="caption" color="text.secondary">
            {loc.country} - {loc.floor}
          </Typography>
        </Stack>
      ))}
    </Stack>
  </FormCard>
);

export default Locations;
