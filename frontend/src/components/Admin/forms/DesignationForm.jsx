import { useMemo, useState } from "react";
import {
  Button,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import FormCard from "./FormCard";

const DesignationForm = ({
  title = "Designation",
  departments = [],
  onSubmit,
}) => {
  const [values, setValues] = useState({ designation: "", department: "" });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!values.designation.trim() || !values.department) return;
    onSubmit?.(values.designation.trim(), Number(values.department));
    setValues({ designation: "", department: "" });
  };

  const departmentOptions = useMemo(
    () =>
      departments.map((department, index) => {
        const label = department?.name ?? department?.label ?? `Department ${index + 1}`;
        const value = Number(department?.department_id ?? department?.id ?? index + 1);
        return {
          label,
          value,
        };
      }),
    [departments]
  );

  return (
    <FormCard title={title}>
      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <TextField
          label="Designation Title"
          value={values.designation}
          onChange={(event) => setValues((prev) => ({ ...prev, designation: event.target.value }))}
          required
          fullWidth
        />
        <FormControl fullWidth>
          <Select
            value={values.department}
            onChange={(event) => setValues((prev) => ({ ...prev, department: event.target.value }))}
            displayEmpty
          >
            <MenuItem value="" disabled>
              Select department
            </MenuItem>
            {departmentOptions.map(({ label, value }) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          type="submit"
          variant="contained"
          sx={{
            alignSelf: { xs: "stretch", sm: "flex-end" },
            px: 4,
            borderRadius: 1,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Add
        </Button>
      </Stack>
    </FormCard>
  );
};

export default DesignationForm;
