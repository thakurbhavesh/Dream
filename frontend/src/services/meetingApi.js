import { API_BASE_URL } from "../config/apiBaseUrl.js";
import { fetchWithAuth } from "../utils/authApi.js";

const BASE = `${API_BASE_URL}/meetings`;

export const createMeeting = async (payload) => {
  // Clean organization_id — only send if valid numeric
  const cleanPayload = { ...payload };
  const orgNum = Number(cleanPayload.organization_id);
  if (!Number.isFinite(orgNum) || orgNum <= 0 || !Number.isInteger(orgNum)) {
    delete cleanPayload.organization_id;
  }
  const { response, payload: data } = await fetchWithAuth(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cleanPayload),
  });
  if (!response.ok) throw new Error(data?.message || "Failed to create meeting");
  return data?.data;
};

export const getMeetings = async (orgId, { status, limit, offset } = {}) => {
  const params = new URLSearchParams({ organization_id: orgId });
  if (status) params.set("status", status);
  if (limit) params.set("limit", limit);
  if (offset) params.set("offset", offset);
  const { response, payload } = await fetchWithAuth(`${BASE}?${params}`);
  if (!response.ok) throw new Error(payload?.message || "Failed to fetch meetings");
  return payload?.data;
};

export const getUpcomingMeetings = async (orgId) => {
  const { response, payload } = await fetchWithAuth(`${BASE}/upcoming?organization_id=${orgId}`);
  if (!response.ok) throw new Error(payload?.message || "Failed to fetch upcoming");
  return payload?.data;
};

export const getPastMeetings = async (orgId, { limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams({ organization_id: orgId, limit, offset });
  const { response, payload } = await fetchWithAuth(`${BASE}/past?${params}`);
  if (!response.ok) throw new Error(payload?.message || "Failed to fetch past meetings");
  return payload?.data;
};

export const getMeetingById = async (id) => {
  const { response, payload } = await fetchWithAuth(`${BASE}/${id}`);
  if (!response.ok) throw new Error(payload?.message || "Meeting not found");
  return payload?.data;
};

export const joinByCode = async (meetingId) => {
  const { response, payload } = await fetchWithAuth(`${BASE}/join/${meetingId}`);
  if (!response.ok) throw new Error(payload?.message || "Meeting not found");
  return payload?.data;
};

export const updateMeeting = async (id, payload) => {
  const { response, payload: data } = await fetchWithAuth(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(data?.message || "Failed to update");
  return data?.data;
};

export const changeMeetingStatus = async (id, status) => {
  const { response, payload } = await fetchWithAuth(`${BASE}/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error(payload?.message || "Failed to change status");
  return payload?.data;
};

export const deleteMeeting = async (id) => {
  const { response, payload } = await fetchWithAuth(`${BASE}/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(payload?.message || "Failed to delete");
  return payload?.data;
};

export const rsvpMeeting = async (id, rsvp) => {
  const { response, payload } = await fetchWithAuth(`${BASE}/${id}/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rsvp }),
  });
  if (!response.ok) throw new Error(payload?.message || "Failed to RSVP");
  return payload?.data;
};

export const addParticipant = async (id, participant) => {
  const { response, payload } = await fetchWithAuth(`${BASE}/${id}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(participant),
  });
  if (!response.ok) throw new Error(payload?.message || "Failed to add participant");
  return payload?.data;
};

export const getMeetingMessages = async (id) => {
  const { response, payload } = await fetchWithAuth(`${BASE}/${id}/messages`);
  if (!response.ok) throw new Error(payload?.message || "Failed to get messages");
  return payload?.data;
};

export const setCoHost = async (id, user_id, co_host = true) => {
  const { response, payload } = await fetchWithAuth(`${BASE}/${id}/co-host`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, co_host }),
  });
  if (!response.ok) throw new Error(payload?.message || "Failed to update co-host");
  return payload?.data;
};

export const getMeetingAttendance = async (id) => {
  const { response, payload } = await fetchWithAuth(`${BASE}/${id}/attendance`);
  if (!response.ok) throw new Error(payload?.message || "Failed to load attendance");
  return payload?.data;
};
