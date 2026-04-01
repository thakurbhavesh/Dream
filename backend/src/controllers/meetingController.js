const meetingModel = require('../models/meetingModel');
const { success, failure } = require('../utils/response');

const resolveUser = (req) => {
  const userId = Number(req.user?.sub);
  if (!Number.isFinite(userId) || userId <= 0) {
    const err = new Error('Valid user context required');
    err.status = 401;
    throw err;
  }
  // Try multiple sources, but only accept valid positive integers
  const candidates = [req.body?.organization_id, req.query?.organization_id, req.user?.org];
  let orgId = null;
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0 && Number.isInteger(n)) { orgId = n; break; }
  }
  if (!orgId) {
    const err = new Error('organization_id required');
    err.status = 400;
    throw err;
  }
  return { userId, orgId };
};

// POST /meetings — create meeting
const createMeeting = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const { title, description, meeting_type, scheduled_at, settings, participants } = req.body;

    const meeting = await meetingModel.create({
      organization_id: orgId,
      host_id: userId,
      title: title || 'Untitled Meeting',
      description,
      meeting_type: meeting_type || 'instant',
      scheduled_at,
      settings,
    });

    // Add host as participant
    await meetingModel.addParticipant({
      meeting_id: meeting.id,
      user_id: userId,
      role: 'host',
    });

    // Add invited participants
    if (Array.isArray(participants)) {
      for (const p of participants) {
        await meetingModel.addParticipant({
          meeting_id: meeting.id,
          user_id: p.user_id || p.id,
          email: p.email,
          display_name: p.display_name || p.name,
          role: p.role || 'participant',
        });
      }
    }

    const allParticipants = await meetingModel.getParticipants(meeting.id);
    return success(res, { meeting, participants: allParticipants }, 'Meeting created', 201);
  } catch (error) {
    return next(error);
  }
};

// GET /meetings — list org meetings
const getMeetings = async (req, res, next) => {
  try {
    const { orgId } = resolveUser(req);
    const { status: mStatus, limit, offset } = req.query;
    const meetings = await meetingModel.findByOrg(orgId, {
      status: mStatus,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });
    return success(res, { meetings }, 'Meetings retrieved');
  } catch (error) {
    return next(error);
  }
};

// GET /meetings/upcoming — upcoming for current user
const getUpcoming = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const meetings = await meetingModel.findUpcoming(orgId, userId);
    return success(res, { meetings }, 'Upcoming meetings');
  } catch (error) {
    return next(error);
  }
};

// GET /meetings/:id
const getMeeting = async (req, res, next) => {
  try {
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    const participants = await meetingModel.getParticipants(meeting.id);
    return success(res, { meeting, participants }, 'Meeting details');
  } catch (error) {
    return next(error);
  }
};

// GET /meetings/join/:meetingId — join by code
const joinByCode = async (req, res, next) => {
  try {
    const meeting = await meetingModel.findByMeetingId(req.params.meetingId);
    if (!meeting) return failure(res, 'Meeting not found', 404);
    if (meeting.status === 'ended' || meeting.status === 'cancelled') {
      return failure(res, 'Meeting has ended', 410);
    }
    const participants = await meetingModel.getParticipants(meeting.id);
    return success(res, { meeting, participants }, 'Meeting found');
  } catch (error) {
    return next(error);
  }
};

// PATCH /meetings/:id
const updateMeeting = async (req, res, next) => {
  try {
    const { userId } = resolveUser(req);
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    if (Number(meeting.host_id) !== userId) return failure(res, 'Only host can update', 403);
    const updated = await meetingModel.update(meeting.id, req.body);
    return success(res, { meeting: updated }, 'Meeting updated');
  } catch (error) {
    return next(error);
  }
};

// PATCH /meetings/:id/status
const changeMeetingStatus = async (req, res, next) => {
  try {
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    const { status: newStatus } = req.body;
    const extra = {};
    if (newStatus === 'active') extra.started_at = new Date();
    if (newStatus === 'ended') {
      extra.ended_at = new Date();
      if (meeting.started_at) {
        extra.duration_minutes = Math.round((Date.now() - new Date(meeting.started_at).getTime()) / 60000);
      }
    }
    const updated = await meetingModel.updateStatus(meeting.id, newStatus, extra);
    return success(res, { meeting: updated }, 'Status updated');
  } catch (error) {
    return next(error);
  }
};

// DELETE /meetings/:id
const deleteMeeting = async (req, res, next) => {
  try {
    const { userId } = resolveUser(req);
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    if (Number(meeting.host_id) !== userId) return failure(res, 'Only host can delete', 403);
    await meetingModel.remove(meeting.id);
    return success(res, null, 'Meeting deleted');
  } catch (error) {
    return next(error);
  }
};

// POST /meetings/:id/rsvp
const rsvp = async (req, res, next) => {
  try {
    const { userId } = resolveUser(req);
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    const participants = await meetingModel.getParticipants(meeting.id);
    const me = participants.find(p => Number(p.user_id) === userId);
    if (!me) return failure(res, 'Not invited', 403);
    const updated = await meetingModel.updateParticipant(me.id, { rsvp: req.body.rsvp });
    return success(res, { participant: updated }, 'RSVP updated');
  } catch (error) {
    return next(error);
  }
};

// POST /meetings/:id/participants
const addParticipant = async (req, res, next) => {
  try {
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    const participant = await meetingModel.addParticipant({
      meeting_id: meeting.id,
      user_id: req.body.user_id,
      email: req.body.email,
      display_name: req.body.display_name,
      role: req.body.role,
    });
    return success(res, { participant }, 'Participant added', 201);
  } catch (error) {
    return next(error);
  }
};

// GET /meetings/:id/messages
const getMessages = async (req, res, next) => {
  try {
    const messages = await meetingModel.getMessages(Number(req.params.id), {
      limit: Number(req.query.limit) || 100,
      offset: Number(req.query.offset) || 0,
    });
    return success(res, { messages }, 'Messages retrieved');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createMeeting,
  getMeetings,
  getUpcoming,
  getMeeting,
  joinByCode,
  updateMeeting,
  changeMeetingStatus,
  deleteMeeting,
  rsvp,
  addParticipant,
  getMessages,
};
