import PropTypes from "prop-types";
import { useState } from "react";
import { Autocomplete, Avatar, Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";

const ProfileField = ({ label, value }) => (
  <Stack spacing={0.5}>
    <Typography variant="caption" sx={{ textTransform: "uppercase", color: "text.secondary" }}>
      {label}
    </Typography>
    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
      {value || "-----"}
    </Typography>
  </Stack>
);

ProfileField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};

const formatDateTime = (value) => {
  if (!value) return "-----";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

// Common timezone list
const TIMEZONE_OPTIONS = Intl.supportedValuesOf
  ? Intl.supportedValuesOf("timeZone")
  : [
      "UTC", "Asia/Kolkata", "Asia/Tokyo", "Asia/Shanghai", "Asia/Dubai",
      "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
      "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
      "America/Sao_Paulo", "Australia/Sydney", "Pacific/Auckland",
    ];

const ProfileTab = ({ user, onUpload, onRemove, lastLogin, avatarUploading, onTimezoneChange }) => {
  const [tzSaving, setTzSaving] = useState(false);

  const handleTimezoneChange = async (_, newValue) => {
    if (!newValue || newValue === user.timezone) return;
    setTzSaving(true);
    try {
      await onTimezoneChange?.(newValue);
    } finally {
      setTzSaving(false);
    }
  };

  const currentTzOffset = (() => {
    try {
      const now = new Date();
      const formatted = now.toLocaleString("en-US", { timeZone: user.timezone || "UTC", timeZoneName: "shortOffset" });
      const match = formatted.match(/GMT[+-]?\d*/);
      return match ? match[0] : "";
    } catch { return ""; }
  })();

  return (
  <Stack direction="row" spacing={4} alignItems="flex-start">

      <Stack spacing={3} flex={1}>
        <ProfileField label="Department" value={user.department} />
        <ProfileField label="Designation" value={user.designation} />
        <ProfileField label="Email" value={user.email} />
        <ProfileField label="Mobile" value={user.mobile} />
        <ProfileField label="Company" value={user.company} />
        <ProfileField label="Location" value={user.location} />
        <ProfileField label="Last login" value={formatDateTime(lastLogin)} />

        {/* Timezone Selector */}
        <Stack spacing={0.5}>
          <Typography variant="caption" sx={{ textTransform: "uppercase", color: "text.secondary" }}>
            Timezone {currentTzOffset ? `(${currentTzOffset})` : ""}
          </Typography>
          <Autocomplete
            value={user.timezone || "UTC"}
            onChange={handleTimezoneChange}
            options={TIMEZONE_OPTIONS}
            size="small"
            disableClearable
            loading={tzSaving}
            sx={{ maxWidth: 350 }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select timezone"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {tzSaving ? <CircularProgress size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Stack>
      </Stack>

    <Stack spacing={2} alignItems="center">
      <Box sx={{ position: "relative", width: 168, height: 168 }}>
        <Avatar
          src={user.avatar}
          alt={user.name}
          sx={{ width: 168, height: 168, border: (t) => `6px solid ${t.palette.background.paper}` }}
        />
        {avatarUploading && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              bgcolor: "rgba(0, 0, 0, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress size={40} sx={{ color: "#fff" }} />
          </Box>
        )}
      </Box>

      <Stack direction="row" spacing={1.5}>
        <Button variant="outlined" color="primary" onClick={onUpload} disabled={avatarUploading}>
          Upload an image
        </Button>
        <Button variant="outlined" color="error" onClick={onRemove} disabled={avatarUploading}>
          Remove picture
        </Button>
      </Stack>
    </Stack>
  </Stack>
  );
};

ProfileTab.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string,
    avatar: PropTypes.string,
    department: PropTypes.string,
    designation: PropTypes.string,
    email: PropTypes.string,
    mobile: PropTypes.string,
    company: PropTypes.string,
    location: PropTypes.string,
  }).isRequired,
  onUpload: PropTypes.func,
  onRemove: PropTypes.func,
  lastLogin: PropTypes.string,
  avatarUploading: PropTypes.bool,
};

ProfileTab.defaultProps = {
  onUpload: () => {},
  onRemove: () => {},
  lastLogin: "",
  avatarUploading: false,
};

export default ProfileTab;
