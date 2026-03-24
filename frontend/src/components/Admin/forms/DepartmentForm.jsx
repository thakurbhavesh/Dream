import { Button, Stack, TextField } from "@mui/material";
import { useState } from "react";
import FormCard from "./FormCard";

const DepartmentForm = ({ title = "Department", onSubmit }) => {
  const [departmentName, setDepartmentName] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!departmentName.trim()) return;
    onSubmit?.(departmentName.trim());
    setDepartmentName("");
  };

  return (
    <FormCard title={title}>
      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <TextField
          label="Department Name"
          value={departmentName}
          onChange={(event) => setDepartmentName(event.target.value)}
          required
          fullWidth
        />
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

export default DepartmentForm;
