import api from './config';

// ─── Mobile Meeting API ────────────────────────────────────────────────
// Wraps the same /meetings endpoints used by the web frontend.

const cleanOrgId = (payload) => {
  const out = { ...payload };
  const n = Number(out.organization_id);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) delete out.organization_id;
  return out;
};

const unwrap = (response) => {
  const body = response?.data;
  return body?.data ?? body;
};

export const createMeeting = async (payload) => {
  const res = await api.post('/meetings', cleanOrgId(payload));
  return unwrap(res);
};

export const getUpcomingMeetings = async (orgId) => {
  const res = await api.get('/meetings/upcoming', { params: { organization_id: orgId } });
  return unwrap(res);
};

export const getPastMeetings = async (orgId, { limit = 50, offset = 0 } = {}) => {
  const res = await api.get('/meetings/past', { params: { organization_id: orgId, limit, offset } });
  return unwrap(res);
};

export const getMeetingById = async (id) => {
  const res = await api.get(`/meetings/${id}`);
  return unwrap(res);
};

export const joinByCode = async (meetingCode) => {
  const res = await api.get(`/meetings/join/${meetingCode}`);
  return unwrap(res);
};

export const updateMeeting = async (id, payload) => {
  const res = await api.patch(`/meetings/${id}`, payload);
  return unwrap(res);
};

export const changeMeetingStatus = async (id, status) => {
  const res = await api.patch(`/meetings/${id}/status`, { status });
  return unwrap(res);
};

export const deleteMeeting = async (id) => {
  const res = await api.delete(`/meetings/${id}`);
  return unwrap(res);
};

export const rsvpMeeting = async (id, rsvp) => {
  const res = await api.post(`/meetings/${id}/rsvp`, { rsvp });
  return unwrap(res);
};

export const addParticipant = async (id, participant) => {
  const res = await api.post(`/meetings/${id}/participants`, participant);
  return unwrap(res);
};

export const setCoHost = async (id, user_id, co_host = true) => {
  const res = await api.patch(`/meetings/${id}/co-host`, { user_id, co_host });
  return unwrap(res);
};

export const getMeetingAttendance = async (id) => {
  const res = await api.get(`/meetings/${id}/attendance`);
  return unwrap(res);
};
