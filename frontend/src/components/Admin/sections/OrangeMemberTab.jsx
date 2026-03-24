import { Avatar, Chip, Stack, Typography } from "@mui/material";
import FormCard from "../forms/FormCard";

const defaultMembers = [
  { id: 1, name: "Orange Desk", email: "orange1@aabhyasa.com", status: "Invited" },
  { id: 2, name: "Field Ops", email: "orange2@aabhyasa.com", status: "Active" },
];

const OrangeMemberTab = ({ members = defaultMembers }) => (
  <FormCard title="Orange Members">
    <Stack spacing={2}>
      {members.map((member) => (
        <Stack key={member.id} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar>{member.name.slice(0, 1)}</Avatar>
            <Stack spacing={0.1}>
              <Typography fontWeight={600}>{member.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {member.email}
              </Typography>
            </Stack>
          </Stack>
          <Chip
            label={member.status}
            color={member.status === "Active" ? "success" : "warning"}
            variant="outlined"
            size="small"
          />
        </Stack>
      ))}
    </Stack>
  </FormCard>
);

export default OrangeMemberTab;
