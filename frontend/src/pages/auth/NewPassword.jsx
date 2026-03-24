// src/pages/auth/NewPassword.jsx
import React, { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Stack, Typography, Link, TextField, Button, IconButton, InputAdornment } from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import * as Yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { PiCaretLeft } from "react-icons/pi";
import AuthSplitLayout from "../../layouts/auth/AuthSplitLayout";

const NewPassword = () => {
  const [showPassword, setShowPassword] = useState(false);

  const Schema = useMemo(
    () =>
      Yup.object().shape({
        password: Yup.string()
          .min(6, "Password must be at least 6 characters")
          .required("Password is required"),
        passwordConfirm: Yup.string()
          .required("Confirm password is required")
          .oneOf([Yup.ref("password"), null], "Passwords must match"),
      }),
    []
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    mode: "onBlur",
    resolver: yupResolver(Schema),
    defaultValues: { password: "", passwordConfirm: "" },
  });

  const onSubmit = (data) => {
    // structure only — no API/Redux here
    console.log("new password payload:", data);
  };

  return (
    <AuthSplitLayout
      title="Reset password"
      subtitle="Please set your new password to finish the reset flow."
      footer={
        <Link
          component={RouterLink}
          to="/auth/login"
          color="inherit"
          variant="subtitle2"
          sx={{ alignItems: "center", display: "inline-flex" }}
        >
          <PiCaretLeft size={24} />
          Return to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={3}>
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Password"
                type={showPassword ? "text" : "password"}
                fullWidth
                error={!!errors.password}
                helperText={errors.password?.message}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((s) => !s)}
                        edge="end"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />

          <Controller
            name="passwordConfirm"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Confirm New Password"
                type={showPassword ? "text" : "password"}
                fullWidth
                error={!!errors.passwordConfirm}
                helperText={errors.passwordConfirm?.message}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((s) => !s)}
                        edge="end"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />

          <Button
            fullWidth
            size="large"
            type="submit"
            variant="contained"
            sx={{
              mt: 1,
              bgcolor: "text.primary",
              color: (t) => (t.palette.mode === "light" ? "common.white" : "grey.800"),
              "&:hover": {
                bgcolor: "text.primary",
                color: (t) => (t.palette.mode === "light" ? "common.white" : "grey.800"),
              },
            }}
          >
            Update Password
          </Button>
        </Stack>
      </form>
    </AuthSplitLayout>
  );
};

export default NewPassword;
