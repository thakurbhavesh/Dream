const { success, failure } = require('../utils/response');
const aiProviderModel = require('../models/aiProviderModel');
const assistantModel = require('../models/assistantModel');

/**
 * POST /live-assistant/chat
 * Body: { messages: [{role, content}], systemPrompt: string, workspaceContext: string }
 *
 * Uses the active AI provider from ai_providers table (Gemini/OpenAI/Claude).
 */
const chat = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const userId = Number(req.user?.sub);
    const orgId = Number(req.user?.org) || null;

    // Rate limiting
    const rateCheck = await assistantModel.checkRateLimit(userId, orgId);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        status: 'error',
        message: `Rate limit exceeded. Maximum ${rateCheck.limit} questions per hour.`,
        data: { remaining: 0, limit: rateCheck.limit },
      });
    }

    const { messages, systemPrompt, workspaceContext } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return failure(res, 'messages array is required', 400);
    }

    const valid = messages.every(
      (m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'),
    );
    if (!valid) {
      return failure(res, 'Each message must have role (user|assistant) and content', 400);
    }

    // Resolve active AI provider from DB
    const provider = await aiProviderModel.getActiveProvider();
    if (!provider || !provider.api_key) {
      return failure(res, 'No active AI provider configured. Go to Owner Dashboard → AI Providers to set up.', 503);
    }

    let fullSystem = workspaceContext
      ? `${systemPrompt}\n\n---\n\nCurrent Workspace Data:\n${workspaceContext}`
      : systemPrompt || '';

    // Inject org knowledge base into context
    const knowledge = await assistantModel.getActiveKnowledge(orgId);
    let knowledgeContext = '';
    if (knowledge.length) {
      knowledgeContext = '\n\n--- ORGANIZATION KNOWLEDGE BASE ---\n' +
        knowledge.map(k => `[${k.category}] ${k.title}:\n${k.content}`).join('\n\n') +
        '\n--- END KNOWLEDGE BASE ---\n\nUse the knowledge base above to answer organization-specific questions accurately.';
    }

    // Inject active broadcasts
    const broadcasts = await assistantModel.getActiveBroadcasts(orgId);
    let broadcastContext = '';
    if (broadcasts.length) {
      broadcastContext = '\n\n--- SYSTEM ANNOUNCEMENTS ---\n' +
        broadcasts.map(b => `[${b.priority.toUpperCase()}] ${b.message}`).join('\n') +
        '\n--- END ANNOUNCEMENTS ---\n\nMention active announcements to users when relevant.';
    }

    fullSystem += knowledgeContext + broadcastContext;

    let reply = '';

    if (provider.provider_key === 'gemini') {
      reply = await chatWithGemini(provider, messages, fullSystem);
    } else if (provider.provider_key === 'openai') {
      reply = await chatWithOpenAI(provider, messages, fullSystem);
    } else if (provider.provider_key === 'anthropic') {
      reply = await chatWithAnthropic(provider, messages, fullSystem);
    } else {
      reply = await chatWithGemini(provider, messages, fullSystem);
    }

    const responseMs = Date.now() - startTime;
    // Track usage (non-blocking)
    if (userId) {
      assistantModel.trackUsage({ userId, orgId, responseMs }).catch(() => {});
    }

    res.setHeader('x-ratelimit-remaining', rateCheck.remaining);
    res.setHeader('x-ratelimit-limit', rateCheck.limit);
    return success(res, { reply, responseMs }, 'Assistant responded');
  } catch (err) {
    if (err?.status) {
      return failure(res, err.message || 'AI API error', err.status);
    }
    return next(err);
  }
};

// ─── Gemini ──────────────────────────────────────────────────────────────────
const chatWithGemini = async (provider, messages, systemPrompt) => {
  const model = provider.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.api_key}`;

  // Convert chat history to Gemini format
  const contents = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: `[System Instructions]\n${systemPrompt}\n\n[End System Instructions]\n\nPlease follow the above instructions for all responses.` }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] });
  }
  for (const m of messages) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const msg = body?.error?.message || `Gemini API error (${response.status})`;
    throw Object.assign(new Error(msg), { status: 502 });
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
};

// ─── OpenAI ──────────────────────────────────────────────────────────────────
const chatWithOpenAI = async (provider, messages, systemPrompt) => {
  const model = provider.model || 'gpt-4o-mini';
  const apiMessages = [];
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }
  apiMessages.push(...messages);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key}` },
    body: JSON.stringify({ model, messages: apiMessages, temperature: 0.7, max_tokens: 2048 }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const msg = body?.error?.message || `OpenAI API error (${response.status})`;
    throw Object.assign(new Error(msg), { status: 502 });
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
};

// ─── Anthropic Claude ────────────────────────────────────────────────────────
const chatWithAnthropic = async (provider, messages, systemPrompt) => {
  const model = provider.model || 'claude-sonnet-4-6';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.api_key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt || undefined,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const msg = body?.error?.message || `Anthropic API error (${response.status})`;
    throw Object.assign(new Error(msg), { status: 502 });
  }

  const data = await response.json();
  return data?.content?.[0]?.text?.trim() || '';
};

// ─── Feedback ────────────────────────────────────────────────────────────────
const submitFeedback = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub);
    const { messageText, responseText, rating } = req.body;
    if (!rating || !['up', 'down'].includes(rating)) {
      return failure(res, 'rating must be "up" or "down"', 400);
    }
    const saved = await assistantModel.saveFeedback({ userId, messageText, responseText, rating });
    return success(res, { feedback: saved }, 'Feedback saved');
  } catch (err) { return next(err); }
};

// ─── Conversations ──────────────────────────────────────────────────────────
const saveConversation = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub);
    const orgId = Number(req.user?.org) || null;
    const { title, messages } = req.body;
    if (!Array.isArray(messages)) return failure(res, 'messages array required', 400);
    const saved = await assistantModel.saveConversation({ userId, orgId, title, messages });
    return success(res, { conversation: saved }, 'Conversation saved', 201);
  } catch (err) { return next(err); }
};

const updateConversation = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub);
    const id = Number(req.params.id);
    const { title, messages } = req.body;
    const updated = await assistantModel.updateConversation(id, userId, { title, messages });
    if (!updated) return failure(res, 'Not found', 404);
    return success(res, { conversation: updated }, 'Conversation updated');
  } catch (err) { return next(err); }
};

const listConversations = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub);
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const conversations = await assistantModel.getUserConversations(userId, { limit, offset });
    return success(res, { conversations }, 'Conversations retrieved');
  } catch (err) { return next(err); }
};

const getConversation = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub);
    const id = Number(req.params.id);
    const conversation = await assistantModel.getConversation(id, userId);
    if (!conversation) return failure(res, 'Not found', 404);
    return success(res, { conversation }, 'Conversation retrieved');
  } catch (err) { return next(err); }
};

const deleteConversation = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub);
    const id = Number(req.params.id);
    const deleted = await assistantModel.deleteConversation(id, userId);
    if (!deleted) return failure(res, 'Not found', 404);
    return success(res, null, 'Conversation deleted');
  } catch (err) { return next(err); }
};

// ─── Usage Analytics (owner only) ───────────────────────────────────────────
const getUsageStats = async (req, res, next) => {
  try {
    const orgId = Number(req.query.org_id) || null;
    const days = Math.min(Number(req.query.days) || 30, 365);
    const stats = await assistantModel.getUsageStats({ orgId, days });
    return success(res, { stats, days }, 'Usage stats retrieved');
  } catch (err) { return next(err); }
};

// ─── Broadcasts (owner only) ────────────────────────────────────────────────
const getBroadcasts = async (req, res, next) => {
  try {
    const orgId = req.user.org;
    const broadcasts = await assistantModel.getActiveBroadcasts(orgId);
    return success(res, { broadcasts }, 'Broadcasts retrieved');
  } catch (err) { return next(err); }
};

const createBroadcast = async (req, res, next) => {
  try {
    const orgId = req.user.org;
    const userId = req.user.sub;
    const { message, priority, expires_at } = req.body;
    if (!message) { const e = new Error('message is required'); e.status = 400; throw e; }
    const broadcast = await assistantModel.createBroadcast({
      orgId, message, priority, createdBy: userId, expiresAt: expires_at,
    });
    return success(res, { broadcast }, 'Broadcast created', 201);
  } catch (err) { return next(err); }
};

const updateBroadcast = async (req, res, next) => {
  try {
    const orgId = req.user.org;
    const broadcastId = req.params.id;
    const broadcast = await assistantModel.updateBroadcast(broadcastId, orgId, req.body);
    if (!broadcast) { const e = new Error('Broadcast not found'); e.status = 404; throw e; }
    return success(res, { broadcast }, 'Broadcast updated');
  } catch (err) { return next(err); }
};

const deleteBroadcast = async (req, res, next) => {
  try {
    const orgId = req.user.org;
    const deleted = await assistantModel.deleteBroadcast(req.params.id, orgId);
    if (!deleted) { const e = new Error('Broadcast not found'); e.status = 404; throw e; }
    return success(res, null, 'Broadcast deleted');
  } catch (err) { return next(err); }
};

// ─── Knowledge Base (owner only) ────────────────────────────────────────────
const getKnowledge = async (req, res, next) => {
  try {
    const orgId = req.user.org;
    const knowledge = await assistantModel.getAllKnowledge(orgId);
    return success(res, { knowledge }, 'Knowledge base retrieved');
  } catch (err) { return next(err); }
};

const createKnowledge = async (req, res, next) => {
  try {
    const orgId = req.user.org;
    const userId = req.user.sub;
    const { title, content, category } = req.body;
    if (!title || !content) { const e = new Error('title and content are required'); e.status = 400; throw e; }
    const entry = await assistantModel.createKnowledge({
      orgId, title, content, category, createdBy: userId,
    });
    return success(res, { knowledge: entry }, 'Knowledge entry created', 201);
  } catch (err) { return next(err); }
};

const updateKnowledge = async (req, res, next) => {
  try {
    const orgId = req.user.org;
    const entry = await assistantModel.updateKnowledge(req.params.id, orgId, req.body);
    if (!entry) { const e = new Error('Knowledge entry not found'); e.status = 404; throw e; }
    return success(res, { knowledge: entry }, 'Knowledge entry updated');
  } catch (err) { return next(err); }
};

const deleteKnowledge = async (req, res, next) => {
  try {
    const orgId = req.user.org;
    const deleted = await assistantModel.deleteKnowledge(req.params.id, orgId);
    if (!deleted) { const e = new Error('Knowledge entry not found'); e.status = 404; throw e; }
    return success(res, null, 'Knowledge entry deleted');
  } catch (err) { return next(err); }
};

// ─── Search Conversations ───────────────────────────────────────────────────
const searchConversations = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const q = req.query.q;
    if (!q) { const e = new Error('q query parameter is required'); e.status = 400; throw e; }
    const conversations = await assistantModel.searchConversations(userId, q, {
      limit: Math.min(Number(req.query.limit) || 20, 50),
      offset: Number(req.query.offset) || 0,
    });
    return success(res, { conversations }, 'Search results');
  } catch (err) { return next(err); }
};

// ─── Export Conversation ────────────────────────────────────────────────────
const exportConversation = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const conv = await assistantModel.getConversationForExport(req.params.id, userId);
    if (!conv) { const e = new Error('Conversation not found'); e.status = 404; throw e; }
    const messages = Array.isArray(conv.messages) ? conv.messages : [];
    const lines = [
      `# ${conv.title || 'AI Assistant Conversation'}`,
      `User: ${conv.user_name || 'Unknown'}`,
      `Organization: ${conv.organization_name || 'N/A'}`,
      `Date: ${new Date(conv.created_at).toLocaleString()}`,
      `Messages: ${conv.message_count || messages.length}`,
      '',
      '---',
      '',
    ];
    for (const msg of messages) {
      const role = msg.role === 'user' ? 'You' : 'AI Assistant';
      lines.push(`**${role}** (${new Date(msg.timestamp || conv.created_at).toLocaleString()}):`);
      lines.push(msg.content || '');
      lines.push('');
    }
    const text = lines.join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="assistant-chat-${req.params.id}.txt"`);
    return res.send(text);
  } catch (err) { return next(err); }
};

module.exports = {
  chat, submitFeedback,
  saveConversation, updateConversation, listConversations, getConversation, deleteConversation,
  getUsageStats,
  getBroadcasts, createBroadcast, updateBroadcast, deleteBroadcast,
  getKnowledge, createKnowledge, updateKnowledge, deleteKnowledge,
  searchConversations, exportConversation,
};
