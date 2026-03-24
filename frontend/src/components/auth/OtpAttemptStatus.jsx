import React from "react";
import { Box, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { getOtpAttemptText } from "../../utils/otpAttempt";

const OtpAttemptStatus = ({ meta }) => {
  if (!meta) return null;

  const attemptsLeft = meta?.attemptsLeft;
  const attemptNumber = meta?.attemptNumber;
  const maxAttempts = meta?.maxAttempts;

  const hasAttemptMeta =
    attemptNumber !== null || maxAttempts !== null || attemptsLeft !== null;
  if (!hasAttemptMeta) return null;

  const attemptProgress =
    Number.isFinite(attemptNumber) && Number.isFinite(maxAttempts) && maxAttempts > 0
      ? Math.min((attemptNumber / maxAttempts) * 100, 100)
      : 0;

  const attemptTone =
    Number.isFinite(attemptsLeft) && attemptsLeft <= 1
      ? "error"
      : Number.isFinite(attemptsLeft) && attemptsLeft <= 2
      ? "warning"
      : "info";

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
        px: 1.5,
        py: 1.25,
        bgcolor: (t) => t.palette.background.paper,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.75}>
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
          OTP ATTEMPTS
        </Typography>
        {Number.isFinite(attemptsLeft) ? (
          <Chip
            size="small"
            color={attemptTone}
            label={`Attempts left: ${attemptsLeft}`}
            sx={{ fontWeight: 700 }}
          />
        ) : null}
      </Stack>

      {Number.isFinite(maxAttempts) ? (
        <LinearProgress
          variant="determinate"
          value={attemptProgress}
          color={attemptTone}
          sx={{ height: 7, borderRadius: 999 }}
        />
      ) : null}

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
        {getOtpAttemptText(meta)}
      </Typography>
    </Box>
  );
};

export default OtpAttemptStatus;
