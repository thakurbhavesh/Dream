import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { PiQrCodeBold, PiCopyBold, PiDownloadBold, PiXBold } from "react-icons/pi";

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

// Build a vCard 3.0 string for the user's profile. QR scanners on phones
// recognise this and prompt to add a contact directly.
const buildVCard = (user) => {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  if (user?.name) lines.push(`FN:${user.name}`);
  if (user?.name) {
    const parts = user.name.split(/\s+/);
    const last = parts.length > 1 ? parts[parts.length - 1] : "";
    const first = parts[0] || "";
    lines.push(`N:${last};${first};;;`);
  }
  if (user?.designation) lines.push(`TITLE:${user.designation}`);
  if (user?.company) lines.push(`ORG:${user.company}`);
  if (user?.email) lines.push(`EMAIL;TYPE=INTERNET:${user.email}`);
  if (user?.mobile) lines.push(`TEL;TYPE=CELL:${user.mobile}`);
  if (user?.department) lines.push(`NOTE:Department: ${user.department}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
};

const ProfileTab = ({ user, onUpload, onRemove, lastLogin, avatarUploading, onTimezoneChange }) => {
  const [tzSaving, setTzSaving] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [toast, setToast] = useState("");

  const vCard = useMemo(() => buildVCard(user), [user]);
  // api.qrserver.com is already used elsewhere in the project (Login QR);
  // reusing it avoids adding a new client-side QR dependency to the bundle.
  const qrUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(
        vCard
      )}`,
    [vCard]
  );

  const handleCopyContact = async () => {
    try {
      await navigator.clipboard.writeText(vCard);
      setToast("Contact card copied");
    } catch {
      setToast("Could not copy");
    }
  };

  const handleDownloadVCard = () => {
    const blob = new Blob([vCard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(user?.name || "contact").replace(/\s+/g, "_")}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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

      <Button
        variant="text"
        size="small"
        startIcon={<PiQrCodeBold size={16} />}
        onClick={() => setQrOpen(true)}
        sx={{ textTransform: "none" }}
      >
        Share my profile
      </Button>
    </Stack>

    {/* QR profile share dialog */}
    <Dialog
      open={qrOpen}
      onClose={() => setQrOpen(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogContent sx={{ p: 3, position: "relative" }}>
        <IconButton
          aria-label="Close"
          onClick={() => setQrOpen(false)}
          sx={{ position: "absolute", top: 8, right: 8 }}
        >
          <PiXBold size={18} />
        </IconButton>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h6" fontWeight={700}>
            Share my profile
          </Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Scan this QR with any phone camera to add{" "}
            <Box component="span" sx={{ fontWeight: 700 }}>{user?.name || "this contact"}</Box>{" "}
            to contacts.
          </Typography>
          <Box
            sx={{
              p: 1.5,
              bgcolor: "#fff",
              borderRadius: 2,
              border: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            <Box
              component="img"
              src={qrUrl}
              alt="Profile QR code"
              loading="eager"
              sx={{ width: 240, height: 240, display: "block" }}
            />
          </Box>
          <Stack spacing={0.25} sx={{ width: "100%" }} alignItems="center">
            {user?.name && (
              <Typography variant="subtitle1" fontWeight={700}>
                {user.name}
              </Typography>
            )}
            {user?.designation && (
              <Typography variant="caption" color="text.secondary">
                {user.designation}{user.company ? ` · ${user.company}` : ""}
              </Typography>
            )}
            {user?.email && (
              <Typography variant="caption" color="text.secondary">
                {user.email}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PiCopyBold size={14} />}
              onClick={handleCopyContact}
              sx={{ textTransform: "none" }}
            >
              Copy contact
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<PiDownloadBold size={14} />}
              onClick={handleDownloadVCard}
              sx={{ textTransform: "none" }}
            >
              Download .vcf
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>

    <Snackbar
      open={Boolean(toast)}
      autoHideDuration={2000}
      onClose={() => setToast("")}
      message={toast}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    />
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
