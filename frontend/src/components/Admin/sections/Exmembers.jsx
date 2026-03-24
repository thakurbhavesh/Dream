import { Avatar, Button, Stack, Typography } from "@mui/material";
import FormCard from "../forms/FormCard";

const defaultMembers = [
  { id: 1, name: "Sonal Jain", reason: "Left company" },
  { id: 2, name: "Rahul T", reason: "Moved to partner org" },
];

const Exmembers = ({ members = defaultMembers }) => (
  <FormCard title="Ex Members">
    <Stack spacing={2}>
      {members.map((member) => (
        <Stack key={member.id} direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar>{member.name.slice(0, 1)}</Avatar>
            <Stack spacing={0.25}>
              <Typography fontWeight={600}>{member.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {member.reason}
              </Typography>
            </Stack>
          </Stack>
          <Button size="small" variant="outlined">
            Restore
          </Button>
        </Stack>
      ))}
    </Stack>
  </FormCard>
);

export default Exmembers;
