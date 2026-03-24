import { Chip, Stack, Typography } from "@mui/material";
import FormCard from "../forms/FormCard";

const defaultDepartments = [
  { id: 1, name: "Engineering", head: "Anita", members: 24 },
  { id: 2, name: "Product", head: "Ravi", members: 15 },
  { id: 3, name: "Customer Success", head: "Nisha", members: 8 },
];

const Departments = ({ items = defaultDepartments }) => {
  return (
    <FormCard title="Departments">
      <Stack spacing={2}>
        {items.map((department) => (
          <Stack key={department.id} direction="row" alignItems="center" justifyContent="space-between">
            <Stack>
              <Typography fontWeight={600}>{department.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                Head: {department.head}
              </Typography>
            </Stack>
            <Chip label={`${department.members} members`} color="primary" size="small" />
          </Stack>
        ))}
      </Stack>
    </FormCard>
  );
};

export default Departments;
