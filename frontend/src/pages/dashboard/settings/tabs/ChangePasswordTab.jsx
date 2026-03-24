import PropTypes from "prop-types";
import { useState } from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

const ChangePasswordTab = ({ onSubmit, onPinSubmit, hasExistingPin }) => {
  const [submitting, setSubmitting] = useState(false);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      current: formData.get("currentPassword") ?? "",
      next: formData.get("newPassword") ?? "",
      confirm: formData.get("confirmPassword") ?? "",
    };

    setSubmitting(true);
    try {
      const result = await onSubmit(payload);
      if (result !== false) {
        event.currentTarget.reset();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePinSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      currentPin: formData.get("currentPin") ?? "",
      newPin: formData.get("newPin") ?? "",
      confirmPin: formData.get("confirmPin") ?? "",
    };

    setPinSubmitting(true);
    try {
      const result = await onPinSubmit(payload);
      if (result !== false) {
        event.currentTarget.reset();
      }
    } finally {
      setPinSubmitting(false);
    }
  };

  return (
    <Box maxWidth={520}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
        Change Password
      </Typography>

      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <TextField
          name="currentPassword"
          label="Old Password"
          type={showCurrentPassword ? "text" : "password"}
          fullWidth
          required
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  aria-label={showCurrentPassword ? "Hide old password" : "Show old password"}
                >
                  {showCurrentPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <TextField
          name="newPassword"
          label="New Password"
          type={showNewPassword ? "text" : "password"}
          fullWidth
          required
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                >
                  {showNewPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <TextField
          name="confirmPassword"
          label="Confirm Password"
          type={showConfirmPassword ? "text" : "password"}
          fullWidth
          required
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button
          type="submit"
          variant="contained"
          sx={{ alignSelf: "flex-start", px: 4 }}
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Save"}
        </Button>
      </Stack>

      <Divider sx={{ my: 5 }} />

      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
        Update Chat Lock PIN
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {hasExistingPin
          ? "Update the 4-digit PIN used to lock and unlock your chats."
          : "Set a new 4-digit PIN to lock and unlock your chats."}
      </Typography>

      <Stack component="form" spacing={2.5} onSubmit={handlePinSubmit}>
        {hasExistingPin && (
          <TextField
            name="currentPin"
            label="Current PIN"
            type="password"
            fullWidth
            required
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 4 }}
          />
        )}
        <TextField
          name="newPin"
          label="New PIN"
          type="password"
          fullWidth
          required
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 4 }}
        />
        <TextField
          name="confirmPin"
          label="Confirm PIN"
          type="password"
          fullWidth
          required
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 4 }}
        />

        <Button
          type="submit"
          variant="outlined"
          sx={{ alignSelf: "flex-start", px: 4 }}
          disabled={pinSubmitting}
        >
          {pinSubmitting
            ? "Saving..."
            : hasExistingPin
            ? "Update PIN"
            : "Set PIN"}
        </Button>
      </Stack>
    </Box>
  );
};

ChangePasswordTab.propTypes = {
  onSubmit: PropTypes.func,
  onPinSubmit: PropTypes.func,
  hasExistingPin: PropTypes.bool,
};

ChangePasswordTab.defaultProps = {
  onSubmit: () => {},
  onPinSubmit: () => {},
  hasExistingPin: false,
};

export default ChangePasswordTab;
