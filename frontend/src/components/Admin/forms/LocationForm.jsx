import { useState } from "react";
import { Button, Stack, TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import FormCard from "./FormCard";

const initialValues = {
  label: "",
  country: "India",
};

const LocationForm = ({ title = "Location", onSubmit }) => {
  const [values, setValues] = useState(initialValues);

  const handleChange = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!values.label.trim() || !values.country.trim()) return;
    onSubmit?.({
      label: values.label.trim(),
      country: values.country.trim(),
    });
    setValues(initialValues);
  };

  return (
    <FormCard title={title}>
      <Stack component="form" spacing={2} onSubmit={handleSubmit}>
        <Grid container spacing={2} direction="column">
          <Grid item xs={12}>
            <TextField
              label="Label"
              value={values.label}
              onChange={handleChange("label")}
              required
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Country"
              value={values.country}
              onChange={handleChange("country")}
              required
              fullWidth
            />
          </Grid>
        </Grid>
        <Button
          type="submit"
          variant="contained"
          sx={{
            alignSelf: { xs: "stretch", sm: "flex-end" },
            px: 4,
            borderRadius: 0.5,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Save
        </Button>
      </Stack>
    </FormCard>
  );
};

export default LocationForm;
