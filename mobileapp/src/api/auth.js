import api from './config';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getDeviceId } from '../utils/deviceId';

const saveTokens = async (result) => {
  const token = result?.access_token || result?.token;
  const refreshToken = result?.refresh_token;
  if (token) await SecureStore.setItemAsync('accessToken', token);
  if (refreshToken) await SecureStore.setItemAsync('refreshToken', refreshToken);
};

const getDeviceMeta = async () => ({
  client_device_id: await getDeviceId(),
  device_type: 'mobile',
  device_name: `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} App`,
  os_name: Platform.OS,
});

// ─── Login step 1 ─────────────────────────────────────────
export const login = async (email, password) => {
  const device = await getDeviceMeta();
  const { data } = await api.post('/auth/login', { email, password, ...device });
  const result = data?.data || data;
  await saveTokens(result);
  return result;
};

// ─── Login step 2 (OTP verify) ───────────────────────────
export const loginWithOtp = async (email, password, otpCode) => {
  const device = await getDeviceMeta();
  const { data } = await api.post('/auth/login', { email, password, otp_code: otpCode, ...device });
  const result = data?.data || data;
  await saveTokens(result);
  return result;
};

// ─── Biometric Login (skip OTP for trusted biometric device) ───
export const loginBiometric = async (email, password) => {
  const device = await getDeviceMeta();
  const { data } = await api.post('/auth/login', { email, password, ...device, biometric_verified: true });
  const result = data?.data || data;
  await saveTokens(result);
  return result;
};

// ─── Register ─────────────────────────────────────────────
export const register = async ({ companyName, ownerName, email, phone, password }) => {
  const { data } = await api.post('/auth/create-account', {
    company_name: companyName, owner_name: ownerName, email, phone, password,
  });
  return data?.data || data;
};

// ─── Verify registration OTP ──────────────────────────────
export const verifyOtp = async (email, otpCode) => {
  const { data } = await api.post('/auth/verify-otp', { email, otp_code: otpCode });
  const result = data?.data || data;
  await saveTokens(result);
  return result;
};

// ─── Resend registration OTP ──────────────────────────────
export const resendOtp = async (email) => {
  const { data } = await api.post('/auth/resend-otp', { email });
  return data?.data || data;
};

// ─── Forgot password ──────────────────────────────────────
export const forgotPassword = async (email) => {
  const { data } = await api.post('/users/forgot-password', { email });
  return data?.data || data;
};

export const forgotVerify = async (email, otpCode) => {
  const { data } = await api.post('/users/forgot-verify', { email, otp_code: otpCode });
  return data?.data || data;
};

export const resetPassword = async (resetToken, newPassword) => {
  const { data } = await api.post('/auth/reset-password', { reset_token: resetToken, new_password: newPassword });
  return data?.data || data;
};

// ─── Profile ──────────────────────────────────────────────
export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data?.data || data;
};

// ─── Change Password ──────────────────────────────────────
export const changePassword = async (oldPassword, newPassword, confirmPassword) => {
  const { data } = await api.post('/auth/change-password', {
    old_password: oldPassword, new_password: newPassword, confirm_password: confirmPassword,
  });
  return data?.data || data;
};

// ─── Trusted Devices ──────────────────────────────────────
export const getTrustedDevices = async () => {
  const { data } = await api.get('/auth/trusted-devices');
  return data?.data || data;
};

export const revokeDevice = async (deviceId) => {
  const { data } = await api.post(`/auth/trusted-devices/${deviceId}/revoke`);
  return data?.data || data;
};

// ─── Organization Details ─────────────────────────────────
export const getOrgDetails = async () => {
  const { data } = await api.get('/auth/organization-details');
  return data?.data || data;
};

// ─── Logout ───────────────────────────────────────────────
export const logoutAll = async () => {
  try { await api.post('/auth/logout-all'); } catch {}
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
};

export const logout = async () => {
  try { await api.post('/auth/logout'); } catch {}
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
};
