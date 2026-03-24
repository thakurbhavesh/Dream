import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import FormCard from "./FormCard";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../utils/authApi";
import { isBusinessEmail, isValidEmail } from "../../../utils/businessEmail";

const initialState = {
  name: "",
  email: "",
  department_id: "",
  designation_id: "",
  location_id: "",
  mobile: "",
  is_global_member: false,
  is_platform_admin: false,
};

const normalizeDomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/^@/, "");

const getEmailDomain = (email) => normalizeDomain(String(email || "").split("@")[1] || "");

const AddUserForm = ({
  title = "Add Users",
  departments = [],
  designations = [],
  locations = [],
  organizationCustomDomain = "",
  maxUsers = 0,
  activeUsers = 0,
  onSuccess,
}) => {
  const [values, setValues] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [credentialDialog, setCredentialDialog] = useState({
    open: false,
    email: "",
    temporaryPassword: "",
    mailSent: false,
    mailError: "",
  });

  const normalizedOrgDomain = useMemo(
    () => normalizeDomain(organizationCustomDomain),
    [organizationCustomDomain],
  );
  const emailDomain = getEmailDomain(values.email);
  const isCrossDomainEmail =
    Boolean(normalizedOrgDomain) &&
    Boolean(emailDomain) &&
    emailDomain !== normalizedOrgDomain;

  const handleChange = (field) => (event) => {
    const { value, checked, type } = event.target;
    if (field === "email") {
      const email = String(value || "").trim().toLowerCase();
      if (!email) {
        setEmailError("");
      } else if (!isValidEmail(email)) {
        setEmailError("Valid email is required");
      } else if (!isBusinessEmail(email)) {
        setEmailError("Only business email is allowed");
      } else {
        setEmailError("");
      }
    }
    setValues((prev) => ({
      ...prev,
      [field]: type === "checkbox" ? checked : value,
    }));
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const hasSeatLimit = Number(maxUsers) > 0;
  const seatsRemaining = hasSeatLimit
    ? Math.max(Number(maxUsers) - Number(activeUsers || 0), 0)
    : null;
  const licenseFull = hasSeatLimit && seatsRemaining <= 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = String(values.name || "").trim();
    const email = String(values.email || "").trim().toLowerCase();
    if (!name || !email) return;
    if (!isValidEmail(email)) {
      setEmailError("Valid email is required");
      return;
    }
    if (!isBusinessEmail(email)) {
      setEmailError("Only business email is allowed");
      return;
    }
    if (licenseFull) {
      showSnackbar(
        `License limit reached (${activeUsers}/${maxUsers}). Upgrade licenses to add more users.`,
        "error",
      );
      return;
    }

    const payload = {
      name,
      email,
      mobile: String(values.mobile || "").trim() || undefined,
      role_id: values.is_platform_admin ? 2 : 4,
      department_id: values.department_id ? Number(values.department_id) : undefined,
      designation_id: values.designation_id
        ? Number(values.designation_id)
        : undefined,
      location_id: values.location_id ? Number(values.location_id) : undefined,
      is_platform_admin: Boolean(values.is_platform_admin),
      is_global_member: Boolean(values.is_global_member || isCrossDomainEmail),
    };

    setSaving(true);
    try {
      const { response, payload: result } = await fetchWithAuth(
        `${API_BASE_URL}/users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok || result?.status === "error") {
        throw new Error(result?.message || "Failed to create user");
      }

      setValues(initialState);
      setEmailError("");
      const createdUser = result?.data || {};
      const tempPassword = String(createdUser?.credentials?.temporary_password || "").trim();
      const createdEmail = String(
        createdUser?.credentials?.email || createdUser?.email || payload.email || "",
      ).trim();
      if (tempPassword && createdEmail) {
        setCredentialDialog({
          open: true,
          email: createdEmail,
          temporaryPassword: tempPassword,
          mailSent: Boolean(createdUser?.credential_sent),
          mailError: String(createdUser?.mail_error || "").trim(),
        });
      }

      const mailStatus = createdUser?.credential_sent;
      showSnackbar(
        mailStatus === true
          ? "User created and invite email sent."
          : mailStatus === false
            ? "User created. Please share credentials manually."
            : "User created. Credential email is being sent in background.",
        mailStatus === false ? "warning" : "success",
      );
      if (typeof onSuccess === "function") {
        await onSuccess(result?.data || payload);
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to create user", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDepartmentChange = (event) => {
    const { value } = event.target;
    setValues((prev) => ({
      ...prev,
      department_id: value,
      designation_id: "",
    }));
  };

  const normalizedDepartments = useMemo(
    () =>
      departments.map((department, index) =>
        ({
          id: Number(department?.department_id ?? department?.id ?? index + 1),
          name: department?.name ?? "",
        }),
      ),
    [departments],
  );

  const departmentOptions = useMemo(
    () =>
      normalizedDepartments.map(({ id, name }) => ({
        label: name,
        value: id,
      })),
    [normalizedDepartments]
  );

  const normalizedDesignations = useMemo(
    () =>
      designations.map((designation, index) => ({
        id: Number(designation?.designation_id ?? designation?.id ?? index + 1),
        title: designation?.name ?? designation?.title ?? "",
        departmentId: Number(
          designation?.department_id ?? designation?.departmentId ?? 0,
        ),
      })),
    [designations],
  );

  const designationOptions = useMemo(() => {
    if (!values.department_id) return [];
    return normalizedDesignations
      .filter(
        (designation) =>
          !designation.departmentId ||
          designation.departmentId === Number(values.department_id)
      )
      .map(({ id, title }) => ({ label: title, value: id }));
  }, [normalizedDesignations, values.department_id]);

  const locationOptions = useMemo(
    () =>
      locations.map((location, index) => ({
        label: location?.label || "",
        value: Number(location?.location_id ?? location?.id ?? index + 1),
      })),
    [locations],
  );

  return (
    <FormCard title={title}>
      <Stack component="form" onSubmit={handleSubmit} spacing={2}>
        {hasSeatLimit ? (
          <Alert
            severity={licenseFull ? "warning" : "info"}
            sx={{ borderRadius: 1 }}
          >
            Licenses used: {activeUsers}/{maxUsers}
            {!licenseFull ? ` | Seats left: ${seatsRemaining}` : ""}
          </Alert>
        ) : null}
        <Grid container gap={2}>
          <Grid item md={6} flex={1}>
            <TextField
              label="Name"
              required
              fullWidth
              value={values.name}
              onChange={handleChange("name")}
            />
          </Grid>
          <Grid item md={6} flex={1}>
            <TextField
              label="Email"
              required
              fullWidth
              value={values.email}
              onChange={handleChange("email")}
              error={Boolean(emailError)}
              helperText={
                emailError ||
                (isCrossDomainEmail
                  ? "Domain differs from organization custom domain. Enable Global Member only if required."
                  : "Use work email only (public email blocked).")
              }
            />
          </Grid>
        </Grid>
        <Grid container gap={2}>
          <Grid item md={6} flex={1}>
            <FormControl fullWidth>
              <Select
                value={values.department_id}
                onChange={handleDepartmentChange}
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
          </Grid>
          <Grid item md={6} flex={1}>
            <FormControl fullWidth>
              <Select
                value={values.designation_id}
                onChange={handleChange("designation_id")}
                displayEmpty
                disabled={!values.department_id}
              >
                <MenuItem value="" disabled>
                  {values.department_id
                    ? "Select designation"
                    : "Select department first"}
                </MenuItem>
                {designationOptions.map(({ label, value }) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        <Grid container gap={2}>
          <Grid item md={6} flex={1}>
            <TextField
              label="Mobile"
              fullWidth
              value={values.mobile}
              onChange={handleChange("mobile")}
            />
          </Grid>
          <Grid item md={6} flex={1}>
            <FormControl fullWidth>
              <Select
                value={values.location_id}
                onChange={handleChange("location_id")}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Select location
                </MenuItem>
                {locationOptions.map(({ label, value }) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
          sx={{ mt: 1 }}
        >
          <Stack
            direction="row"
            spacing={3}
            alignItems="center"
            sx={{ flexWrap: "wrap" }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.is_global_member}
                  onChange={handleChange("is_global_member")}
                />
              }
              label="Global Member"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.is_platform_admin}
                  onChange={handleChange("is_platform_admin")}
                />
              }
              label="Platform Admin"
            />
            <Typography variant="caption" color="text.secondary">
              Role: {values.is_platform_admin ? "Admin" : "Users"}
            </Typography>
          </Stack>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || licenseFull}
            sx={{
              px: 3,
              borderRadius: 1,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            {saving ? "Adding..." : licenseFull ? "Limit Reached" : "Add"}
          </Button>
        </Stack>
      </Stack>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      <Dialog
        open={credentialDialog.open}
        onClose={() =>
          setCredentialDialog((prev) => ({
            ...prev,
            open: false,
          }))
        }
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Login Credentials</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            {!credentialDialog.mailSent ? (
              <Alert severity="warning">
                Email send failed
                {credentialDialog.mailError ? `: ${credentialDialog.mailError}` : ""}. Share
                these credentials manually.
              </Alert>
            ) : (
              <Alert severity="success">
                Invite email sent successfully. Credentials are shown for backup.
              </Alert>
            )}
            <TextField
              label="Email"
              size="small"
              value={credentialDialog.email}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Temporary Password"
              size="small"
              value={credentialDialog.temporaryPassword}
              InputProps={{ readOnly: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setCredentialDialog((prev) => ({
                ...prev,
                open: false,
              }))
            }
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </FormCard>
  );
};

export default AddUserForm;
