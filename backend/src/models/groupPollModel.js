const db = require('../config/database');

// Get poll by group_message_id (with options + active votes only)
const getPollByMessageId = async (messageId) => {
  const { rows: pollRows } = await db.query(
    `SELECT * FROM group_polls WHERE group_message_id = $1`,
    [messageId]
  );
  if (!pollRows[0]) return null;
  const poll = pollRows[0];

  const { rows: options } = await db.query(
    `SELECT o.option_id, o.option_text, o.vote_count, o.order_no,
            COALESCE(json_agg(json_build_object('userId', v.user_id, 'votedAt', v.voted_at))
              FILTER (WHERE v.vote_id IS NOT NULL), '[]') AS voters
     FROM group_poll_options o
     LEFT JOIN group_poll_votes v ON v.option_id = o.option_id AND v.status = 'active'
     WHERE o.poll_id = $1
     GROUP BY o.option_id
     ORDER BY o.order_no`,
    [poll.poll_id]
  );

  return { ...poll, options };
};

// Get poll by poll_id
const getPollById = async (pollId) => {
  const { rows } = await db.query(`SELECT * FROM group_polls WHERE poll_id = $1`, [pollId]);
  return rows[0] || null;
};

// Create poll + options (returns poll_id)
const createPoll = async ({ groupMessageId, groupId, question, pollType, showResultsBeforeVote, endsAt, endPermission, createdBy, options }) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: pollRows } = await client.query(
      `INSERT INTO group_polls (group_message_id, group_id, question, poll_type, show_results_before_vote, ends_at, end_permission, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [groupMessageId, groupId, question, pollType || 'single', showResultsBeforeVote || false, endsAt || null, endPermission || 'creator_admin', createdBy]
    );
    const poll = pollRows[0];

    const insertedOptions = [];
    for (let i = 0; i < options.length; i++) {
      const { rows: optRows } = await client.query(
        `INSERT INTO group_poll_options (poll_id, option_text, order_no) VALUES ($1, $2, $3) RETURNING *`,
        [poll.poll_id, options[i].label || options[i].text || `Option ${i + 1}`, i + 1]
      );
      insertedOptions.push(optRows[0]);
    }

    await client.query('COMMIT');
    return { ...poll, options: insertedOptions };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Vote on a poll option (soft delete — never hard delete)
const vote = async ({ pollId, optionId, userId }) => {
  // Check if user has an active vote on this option
  const { rows: existing } = await db.query(
    `SELECT vote_id FROM group_poll_votes WHERE poll_id = $1 AND user_id = $2 AND option_id = $3 AND status = 'active'`,
    [pollId, userId, optionId]
  );
  if (existing.length > 0) {
    // Toggle off — soft delete
    await db.query(
      `UPDATE group_poll_votes SET status = 'removed', updated_at = NOW() WHERE vote_id = $1`,
      [existing[0].vote_id]
    );
    await db.query(`UPDATE group_poll_options SET vote_count = GREATEST(0, vote_count - 1), updated_at = NOW() WHERE option_id = $1`, [optionId]);
    return { action: 'removed' };
  }
  // Add new active vote
  await db.query(
    `INSERT INTO group_poll_votes (poll_id, option_id, user_id, status) VALUES ($1, $2, $3, 'active')`,
    [pollId, optionId, userId]
  );
  await db.query(`UPDATE group_poll_options SET vote_count = vote_count + 1, updated_at = NOW() WHERE option_id = $1`, [optionId]);
  return { action: 'added' };
};

// Remove all active votes by user for a poll (soft delete for single-choice switch)
const removeUserVotes = async (pollId, userId) => {
  const { rows: votes } = await db.query(
    `UPDATE group_poll_votes SET status = 'removed', updated_at = NOW()
     WHERE poll_id = $1 AND user_id = $2 AND status = 'active'
     RETURNING option_id`,
    [pollId, userId]
  );
  for (const v of votes) {
    await db.query(`UPDATE group_poll_options SET vote_count = GREATEST(0, vote_count - 1), updated_at = NOW() WHERE option_id = $1`, [v.option_id]);
  }
  return votes.length;
};

// End a poll
const endPoll = async (pollId, userId) => {
  const { rows } = await db.query(
    `UPDATE group_polls SET status = 'ended', ended_at = NOW(), ended_by = $1, updated_at = NOW()
     WHERE poll_id = $2 RETURNING *`,
    [userId, pollId]
  );
  return rows[0] || null;
};

// Edit poll question/options
const editPoll = async (pollId, { question, options }) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    if (question) {
      await client.query(
        `UPDATE group_polls SET question = $1, updated_at = NOW() WHERE poll_id = $2`,
        [question, pollId]
      );
    }

    if (options && Array.isArray(options)) {
      // Update existing options text
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (opt.option_id) {
          await client.query(
            `UPDATE group_poll_options SET option_text = $1, order_no = $2, updated_at = NOW() WHERE option_id = $3`,
            [opt.label || opt.text || opt.option_text, i + 1, opt.option_id]
          );
        } else {
          // New option
          await client.query(
            `INSERT INTO group_poll_options (poll_id, option_text, order_no) VALUES ($1, $2, $3)`,
            [pollId, opt.label || opt.text || `Option ${i + 1}`, i + 1]
          );
        }
      }
    }

    await client.query('COMMIT');
    return await getPollById(pollId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Delete poll
const deletePoll = async (pollId) => {
  await db.query(`UPDATE group_polls SET status = 'deleted', updated_at = NOW() WHERE poll_id = $1`, [pollId]);
};

// Get all polls for a group
const getGroupPolls = async (groupId, { limit = 20, offset = 0 } = {}) => {
  const { rows } = await db.query(
    `SELECT p.*, u.name AS creator_name,
            (SELECT COUNT(*) FROM group_poll_votes v
             JOIN group_poll_options o ON o.option_id = v.option_id
             WHERE o.poll_id = p.poll_id AND v.status = 'active') AS total_votes
     FROM group_polls p
     JOIN users u ON u.user_id = p.created_by
     WHERE p.group_id = $1 AND p.status != 'deleted'
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [groupId, limit, offset]
  );
  return rows;
};

module.exports = {
  getPollByMessageId,
  getPollById,
  createPoll,
  vote,
  removeUserVotes,
  endPoll,
  editPoll,
  deletePoll,
  getGroupPolls,
};
