import { Divider, Stack, Typography } from "@mui/material";
import FormCard from "../forms/FormCard";

const defaultActivity = [
  { id: 1, title: "Ravi invited 3 users", time: "2 hrs ago" },
  { id: 2, title: "Orange Desk joined", time: "5 hrs ago" },
  { id: 3, title: "Billing plan upgraded", time: "Yesterday" },
];

const UserActivity = ({ events = defaultActivity }) => (
  <FormCard title="User Activity">
    <Stack divider={<Divider flexItem />} spacing={1.5}>
      {events.map((event) => (
        <Stack key={event.id} spacing={0.25}>
          <Typography fontWeight={600}>{event.title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {event.time}
          </Typography>
        </Stack>
      ))}
    </Stack>
  </FormCard>
);

export default UserActivity;
