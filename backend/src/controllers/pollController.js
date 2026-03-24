const pollModel = require('../models/groupPollModel');
const { success, failure: errorResponse } = require('../utils/response');

// GET /chat/polls/:messageId
const getPoll = async (req, res, next) => {
  try {
    const messageId = Number(req.params.messageId);
    if (!messageId) return errorResponse(res, 'messageId required', 400);

    const poll = await pollModel.getPollByMessageId(messageId);
    if (!poll) return errorResponse(res, 'Poll not found', 404);

    return success(res, poll);
  } catch (err) {
    return next(err);
  }
};

// GET /chat/polls/group/:groupId
const getGroupPolls = async (req, res, next) => {
  try {
    const groupId = Number(req.params.groupId);
    if (!groupId) return errorResponse(res, 'groupId required', 400);

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;

    const polls = await pollModel.getGroupPolls(groupId, { limit, offset });
    return success(res, polls);
  } catch (err) {
    return next(err);
  }
};

// POST /chat/polls/:messageId/vote
const votePoll = async (req, res, next) => {
  try {
    const messageId = Number(req.params.messageId);
    const userId = req.user?.sub;
    const { optionId } = req.body;

    if (!messageId || !optionId) return errorResponse(res, 'messageId and optionId required', 400);

    const poll = await pollModel.getPollByMessageId(messageId);
    if (!poll) return errorResponse(res, 'Poll not found', 404);
    if (poll.status === 'ended') return errorResponse(res, 'Poll has ended', 400);
    if (poll.ends_at && new Date(poll.ends_at) < new Date()) return errorResponse(res, 'Poll has expired', 400);

    // For single-choice, remove existing votes first
    if (poll.poll_type === 'single') {
      await pollModel.removeUserVotes(poll.poll_id, userId);
    }

    const result = await pollModel.vote({
      pollId: poll.poll_id,
      optionId: Number(optionId),
      userId,
    });

    // Return updated poll
    const updated = await pollModel.getPollByMessageId(messageId);
    return success(res, { ...result, poll: updated });
  } catch (err) {
    return next(err);
  }
};

// POST /chat/polls/:messageId/end
const endPoll = async (req, res, next) => {
  try {
    const messageId = Number(req.params.messageId);
    const userId = req.user?.sub;

    if (!messageId) return errorResponse(res, 'messageId required', 400);

    const poll = await pollModel.getPollByMessageId(messageId);
    if (!poll) return errorResponse(res, 'Poll not found', 404);
    if (poll.status === 'ended') return errorResponse(res, 'Poll already ended', 400);

    const ended = await pollModel.endPoll(poll.poll_id, userId);
    return success(res, ended);
  } catch (err) {
    return next(err);
  }
};

// PATCH /chat/polls/:messageId
const editPoll = async (req, res, next) => {
  try {
    const messageId = Number(req.params.messageId);
    const userId = req.user?.sub;
    const { question, options } = req.body;

    if (!messageId) return errorResponse(res, 'messageId required', 400);

    const poll = await pollModel.getPollByMessageId(messageId);
    if (!poll) return errorResponse(res, 'Poll not found', 404);
    if (poll.status === 'ended') return errorResponse(res, 'Cannot edit ended poll', 400);

    // Only creator can edit
    if (poll.created_by !== userId) {
      return errorResponse(res, 'Only poll creator can edit', 403);
    }

    await pollModel.editPoll(poll.poll_id, { question, options });
    const updated = await pollModel.getPollByMessageId(messageId);
    return success(res, updated);
  } catch (err) {
    return next(err);
  }
};

// DELETE /chat/polls/:messageId
const deletePoll = async (req, res, next) => {
  try {
    const messageId = Number(req.params.messageId);
    const userId = req.user?.sub;

    if (!messageId) return errorResponse(res, 'messageId required', 400);

    const poll = await pollModel.getPollByMessageId(messageId);
    if (!poll) return errorResponse(res, 'Poll not found', 404);

    // Only creator can delete
    if (poll.created_by !== userId) {
      return errorResponse(res, 'Only poll creator can delete', 403);
    }

    await pollModel.deletePoll(poll.poll_id);
    return success(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getPoll,
  getGroupPolls,
  votePoll,
  endPoll,
  editPoll,
  deletePoll,
};
