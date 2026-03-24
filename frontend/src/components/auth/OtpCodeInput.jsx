import React, { useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { Box, Stack, TextField, Typography } from "@mui/material";

const normalizeDigits = (value = "", length = 6) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, length);

const OtpCodeInput = ({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  error = false,
  helperText = "",
  autoFocus = false,
}) => {
  const refs = useRef([]);
  const digits = useMemo(() => {
    const normalized = normalizeDigits(value, length);
    return Array.from({ length }, (_, idx) => normalized[idx] || "");
  }, [length, value]);

  const emitValue = (nextRaw) => {
    const nextValue = normalizeDigits(nextRaw, length);
    onChange?.(nextValue);
    if (nextValue.length === length) {
      onComplete?.(nextValue);
    }
  };

  const handleChangeAt = (index, inputValue) => {
    if (disabled) return;
    const clean = normalizeDigits(inputValue, length);
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      emitValue(next.join(""));
      return;
    }

    const next = [...digits];
    for (let i = 0; i < clean.length && index + i < length; i += 1) {
      next[index + i] = clean[i];
    }
    emitValue(next.join(""));

    const focusIndex = Math.min(index + clean.length, length - 1);
    refs.current[focusIndex]?.focus();
  };

  const handlePaste = (event) => {
    if (disabled) return;
    event.preventDefault();
    const pasted = event.clipboardData?.getData("text") || "";
    const clean = normalizeDigits(pasted, length);
    if (!clean) return;
    emitValue(clean);
    const focusIndex = Math.min(clean.length, length) - 1;
    if (focusIndex >= 0) {
      refs.current[focusIndex]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (disabled) return;
    const key = event.key;
    if (key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
    }
    if (key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} justifyContent="space-between">
        {digits.map((digit, index) => (
          <TextField
            key={`otp-${index}`}
            inputRef={(node) => {
              refs.current[index] = node;
            }}
            value={digit}
            onChange={(event) => handleChangeAt(index, event.target.value)}
            onPaste={handlePaste}
            onKeyDown={(event) => handleKeyDown(index, event)}
            type="tel"
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            error={error}
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9]*",
              maxLength: 1,
              style: { textAlign: "center", fontSize: 20, fontWeight: 700 },
            }}
            sx={{
              flex: 1,
              "& .MuiInputBase-root": { borderRadius: 1.5 },
            }}
          />
        ))}
      </Stack>
      {helperText ? (
        <Typography
          variant="caption"
          color={error ? "error.main" : "text.secondary"}
          sx={{ mt: 0.75, display: "block" }}
        >
          {helperText}
        </Typography>
      ) : null}
    </Box>
  );
};

OtpCodeInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onComplete: PropTypes.func,
  length: PropTypes.number,
  disabled: PropTypes.bool,
  error: PropTypes.bool,
  helperText: PropTypes.string,
  autoFocus: PropTypes.bool,
};

OtpCodeInput.defaultProps = {
  value: "",
  onChange: () => {},
  onComplete: () => {},
  length: 6,
  disabled: false,
  error: false,
  helperText: "",
  autoFocus: false,
};

export default OtpCodeInput;
