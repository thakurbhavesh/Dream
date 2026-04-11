const crypto = require('crypto');
const { success } = require('../utils/response');
const db = require('../config/database');
const aiProviderModel = require('../models/aiProviderModel');

/**
 * Resolve active AI provider config from database.
 * Returns { provider: 'gemini'|'openai'|'anthropic', apiKey, model }
 */
const resolveAIProvider = async () => {
  const dbProvider = await aiProviderModel.getActiveProvider();
  if (!dbProvider || !dbProvider.api_key) {
    throw Object.assign(new Error('No active AI provider configured. Go to Owner Dashboard → AI Providers to set up.'), { status: 503 });
  }
  return {
    provider: dbProvider.provider_key,
    apiKey: dbProvider.api_key,
    model: dbProvider.model,
  };
};

/**
 * Translate text using Gemini API (default) or OpenAI API (fallback).
 * Set TRANSLATE_PROVIDER=openai in .env to use OpenAI instead.
 *
 * POST /translate
 * Body: { text, targetLanguage }
 */
const translate = async (req, res, next) => {
  try {
    const { text, targetLanguage = 'English' } = req.body;
    if (!text) {
      const e = new Error('text is required');
      e.status = 400;
      throw e;
    }

    const ai = await resolveAIProvider();
    const provider = ai.provider;
    let translated;

    if (provider === 'openai') {
      translated = await translateWithOpenAI(text, targetLanguage, ai.apiKey, ai.model);
    } else if (provider === 'anthropic') {
      translated = await translateWithAnthropic(text, targetLanguage, ai.apiKey, ai.model);
    } else {
      translated = await translateWithGemini(text, targetLanguage, ai.apiKey, ai.model);
    }

    return success(res, { translated, provider, targetLanguage }, 'Translation completed');
  } catch (err) {
    return next(err);
  }
};

// ─── Gemini ───────────────────────────────────────────────────────────────────
const translateWithGemini = async (text, targetLanguage, apiKeyOverride, modelOverride) => {
  const apiKey = apiKeyOverride;
  if (!apiKey) throw Object.assign(new Error('Gemini API key not configured'), { status: 500 });

  const model = modelOverride || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Translate the following text to ${targetLanguage}. Return ONLY the translated text, nothing else.\n\n${text}`,
        }],
      }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Object.assign(new Error(`Gemini API error: ${response.status} ${body}`), { status: 502 });
  }

  const data = await response.json();
  const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!translated) throw Object.assign(new Error('Empty translation response'), { status: 502 });
  return translated;
};

// ─── OpenAI ───────────────────────────────────────────────────────────────────
const translateWithOpenAI = async (text, targetLanguage, apiKeyOverride, modelOverride) => {
  const apiKey = apiKeyOverride;
  if (!apiKey) throw Object.assign(new Error('OpenAI API key not configured'), { status: 500 });

  const model = modelOverride || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: `You are a translator. Translate the user's text to ${targetLanguage}. Return ONLY the translated text.` },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Object.assign(new Error(`OpenAI API error: ${response.status} ${body}`), { status: 502 });
  }

  const data = await response.json();
  const translated = data?.choices?.[0]?.message?.content?.trim();
  if (!translated) throw Object.assign(new Error('Empty translation response'), { status: 502 });
  return translated;
};

// ─── Anthropic Claude (translate) ─────────────────────────────────────────────
const translateWithAnthropic = async (text, targetLanguage, apiKey, modelOverride) => {
  if (!apiKey) throw Object.assign(new Error('Anthropic API key not configured'), { status: 500 });
  const model = modelOverride || 'claude-sonnet-4-6';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: `You are a translator. Translate the user's text to ${targetLanguage}. Return ONLY the translated text.`,
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const msg = body?.error?.message || `Anthropic API error (${response.status})`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  const data = await response.json();
  const translated = data?.content?.[0]?.text?.trim();
  if (!translated) throw Object.assign(new Error('Empty translation response'), { status: 502 });
  return translated;
};

// ─── File text extraction ────────────────────────────────────────────────────
const extractFileText = async (fileUrl, fileName, fileType) => {
  if (!fileUrl) return null;
  try {
    console.log('[summarize] fetching file:', fileUrl?.slice(0, 120));
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.warn('[summarize] fetch failed:', response.status, response.statusText);
      return null;
    }
    const contentType = response.headers.get('content-type') || fileType || '';
    const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
    console.log('[summarize] contentType:', contentType, 'ext:', ext);

    // PDF — extract text with pdf-parse
    if (contentType.includes('pdf') || ext === 'pdf') {
      const { PDFParse } = require('pdf-parse');
      const arrayBuf = await response.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuf);
      const parser = new PDFParse(uint8);
      await parser.load();
      const result = await parser.getText();
      // result is { pages: [{ text: "..." }, ...] }
      let text = '';
      if (result && Array.isArray(result.pages)) {
        text = result.pages.map(p => p.text || '').join('\n');
      } else if (typeof result === 'string') {
        text = result;
      }
      return text.trim() || null;
    }

    // Text-based files
    const textTypes = ['text/', 'json', 'xml', 'csv', 'javascript', 'typescript', 'html', 'css', 'markdown'];
    const textExts = ['txt', 'md', 'json', 'xml', 'csv', 'js', 'ts', 'html', 'css', 'yml', 'yaml', 'log', 'env', 'sql', 'py', 'java', 'c', 'cpp', 'h', 'sh', 'bat'];
    if (textTypes.some(t => contentType.includes(t)) || textExts.includes(ext)) {
      const text = await response.text();
      return text.length > 10000 ? text.slice(0, 10000) + '\n\n[...truncated]' : text;
    }

    // Images — return base64 for Gemini vision
    if (contentType.includes('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) {
      const buffer = Buffer.from(await response.arrayBuffer());
      return { type: 'image', mimeType: contentType, base64: buffer.toString('base64') };
    }

    // DOCX — basic text extraction (paragraphs)
    if (ext === 'docx' || contentType.includes('wordprocessingml')) {
      try {
        const AdmZip = require('adm-zip');
        const buffer = Buffer.from(await response.arrayBuffer());
        const zip = new AdmZip(buffer);
        const xml = zip.readAsText('word/document.xml');
        const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return text.length > 10000 ? text.slice(0, 10000) + '\n\n[...truncated]' : text;
      } catch (docxErr) {
        console.warn('[summarize] DOCX extraction failed:', docxErr.message);
        return null;
      }
    }

    // XLSX / XLS — extract text from spreadsheets
    if (ext === 'xlsx' || ext === 'xls' || contentType.includes('spreadsheetml') || contentType.includes('ms-excel')) {
      try {
        const AdmZip = require('adm-zip');
        const buffer = Buffer.from(await response.arrayBuffer());
        const zip = new AdmZip(buffer);
        // Extract shared strings (cell values) from xlsx
        const sharedStrings = zip.getEntry('xl/sharedStrings.xml');
        const sheetEntry = zip.getEntry('xl/worksheets/sheet1.xml');
        let text = '';
        if (sharedStrings) {
          const xml = zip.readAsText(sharedStrings);
          text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        } else if (sheetEntry) {
          const xml = zip.readAsText(sheetEntry);
          text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        return text.length > 10000 ? text.slice(0, 10000) + '\n\n[...truncated]' : (text || null);
      } catch (xlsErr) {
        console.warn('[summarize] XLSX extraction failed:', xlsErr.message);
        return null;
      }
    }

    // For S3 responses with binary/octet-stream, try reading as text anyway
    if (contentType.includes('octet-stream') || contentType.includes('binary')) {
      try {
        const buffer = Buffer.from(await response.arrayBuffer());
        const text = buffer.toString('utf-8');
        // Check if it looks like readable text (at least 80% printable chars)
        const printable = text.replace(/[^\x20-\x7E\n\r\t]/g, '');
        if (printable.length > text.length * 0.8 && text.length > 10) {
          return text.length > 10000 ? text.slice(0, 10000) + '\n\n[...truncated]' : text;
        }
      } catch { /* not text */ }
    }

    console.warn('[summarize] unsupported file type — contentType:', contentType, 'ext:', ext);
    return null;
  } catch (err) {
    console.warn('[summarize] file extraction failed:', err.message);
    return null;
  }
};

// ─── Summarize ───────────────────────────────────────────────────────────────
const summarize = async (req, res, next) => {
  try {
    const { text, fileUrl, fileName, fileType, fileKey, previousSummary } = req.body;
    if (!text && !fileUrl && !fileKey) {
      const e = new Error('text or fileUrl is required');
      e.status = 400;
      throw e;
    }

    // Cache: generate key from content identifier
    // Priority: fileKey (S3 path, unique per file) > fileUrl > text
    // Append fileName to handle different files at similar URLs
    const cacheSource = fileKey || fileUrl || text || '';
    if (!cacheSource) {
      const e = new Error('Unable to generate cache key — no identifiable content');
      e.status = 400;
      throw e;
    }
    const cacheKey = crypto.createHash('sha256').update(cacheSource + (fileName || '')).digest('hex');

    // If not regenerating, check cache first
    if (!previousSummary && cacheKey) {
      try {
        const { rows } = await db.query('SELECT summary, provider FROM summary_cache WHERE cache_key = $1', [cacheKey]);
        if (rows.length) {
          return success(res, { summary: rows[0].summary, provider: rows[0].provider, cached: true }, 'Summary retrieved from cache');
        }
      } catch { /* ignore cache errors */ }
    }

    const ai = await resolveAIProvider();
    const provider = ai.provider;
    let summary;

    // If file — download and extract text first
    // Prefer fileKey (generates fresh presigned URL) over fileUrl (may be stale)
    let resolvedUrl = null;
    if (fileKey) {
      const { getPresignedUrl } = require('../config/s3');
      resolvedUrl = await getPresignedUrl(fileKey);
    }
    if (!resolvedUrl && fileUrl) {
      resolvedUrl = fileUrl;
    }

    let fileContent = null;
    if (resolvedUrl) {
      console.log('[summarize] extracting file text from:', resolvedUrl?.slice(0, 120), 'fileName:', fileName, 'fileType:', fileType);
      fileContent = await extractFileText(resolvedUrl, fileName, fileType);
      console.log('[summarize] extracted content type:', fileContent === null ? 'null' : typeof fileContent === 'object' ? 'image-object' : `string(${fileContent.length} chars)`);
    }

    // Build prompt based on what we have
    const regenInstruction = previousSummary
      ? `\n\nIMPORTANT: A previous summary was already generated. You MUST produce a completely DIFFERENT summary with different wording, structure, and focus points. Do NOT repeat the previous summary.\n\nPrevious summary (do NOT repeat this):\n${previousSummary}\n\n`
      : '';

    let prompt;
    if (fileContent && typeof fileContent === 'object' && fileContent.type === 'image') {
      // Image — use Gemini vision
      prompt = {
        type: 'image',
        mimeType: fileContent.mimeType,
        base64: fileContent.base64,
        textPrompt: `Describe and summarize this image in detail. What does it show? Provide 3-5 key points.${regenInstruction}`,
      };
    } else if (fileContent && typeof fileContent === 'string') {
      prompt = `Summarize the following content from file "${fileName || 'file'}" concisely in 3-5 bullet points. Keep it clear and informative.${regenInstruction}\n\n${fileContent}`;
    } else if (text) {
      prompt = `Summarize the following text concisely in 3-5 bullet points. Keep it clear and informative.${regenInstruction}\n\n${text}`;
    } else {
      // File content could not be extracted — try to get fresh presigned URL and retry
      if (fileKey) {
        console.log('[summarize] retrying with fresh presigned URL for fileKey:', fileKey);
        try {
          const { getPresignedUrl: getFreshUrl } = require('../config/s3');
          const freshUrl = await getFreshUrl(fileKey);
          fileContent = await extractFileText(freshUrl, fileName, fileType);
          console.log('[summarize] retry result:', fileContent === null ? 'null' : typeof fileContent === 'object' ? 'image-object' : `string(${fileContent.length} chars)`);
        } catch (retryErr) {
          console.warn('[summarize] retry failed:', retryErr.message);
        }
      }

      if (fileContent && typeof fileContent === 'object' && fileContent.type === 'image') {
        prompt = {
          type: 'image',
          mimeType: fileContent.mimeType,
          base64: fileContent.base64,
          textPrompt: `Describe and summarize this image in detail. What does it show? Provide 3-5 key points.${regenInstruction}`,
        };
      } else if (fileContent && typeof fileContent === 'string') {
        prompt = `Summarize the following content from file "${fileName || 'file'}" concisely in 3-5 bullet points. Keep it clear and informative.${regenInstruction}\n\n${fileContent}`;
      } else {
        const e = new Error(`Could not extract content from file "${fileName || 'file'}". File type "${fileType || 'unknown'}" may not be supported for summarization.`);
        e.status = 400;
        throw e;
      }
    }

    if (provider === 'openai') {
      summary = await summarizeWithOpenAI(typeof prompt === 'string' ? prompt : prompt.textPrompt, ai.apiKey, ai.model);
    } else if (provider === 'anthropic') {
      summary = await summarizeWithAnthropic(typeof prompt === 'string' ? prompt : prompt.textPrompt, ai.apiKey, ai.model);
    } else {
      summary = await summarizeWithGemini(prompt, ai.apiKey, ai.model);
    }

    // Store in cache (upsert — regenerate overwrites old cache)
    if (cacheKey && summary) {
      db.query(
        `INSERT INTO summary_cache (cache_key, summary, provider) VALUES ($1, $2, $3)
         ON CONFLICT (cache_key) DO UPDATE SET summary = $2, provider = $3, created_at = NOW()`,
        [cacheKey, summary, provider]
      ).catch(() => {});
    }

    return success(res, { summary, provider, fileExtracted: !!fileContent }, 'Summary generated');
  } catch (err) {
    return next(err);
  }
};

const summarizeWithGemini = async (prompt, apiKeyOverride, modelOverride) => {
  const apiKey = apiKeyOverride;
  if (!apiKey) throw Object.assign(new Error('Gemini API key not configured'), { status: 500 });

  const model = modelOverride || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build parts — text or image+text (vision)
  let parts;
  if (typeof prompt === 'object' && prompt.type === 'image') {
    parts = [
      { inlineData: { mimeType: prompt.mimeType || 'image/png', data: prompt.base64 } },
      { text: prompt.textPrompt },
    ];
  } else {
    parts = [{ text: typeof prompt === 'string' ? prompt : String(prompt) }];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Object.assign(new Error(`Gemini API error: ${response.status} ${body}`), { status: 502 });
  }

  const data = await response.json();
  const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!summary) throw Object.assign(new Error('Empty summary response'), { status: 502 });
  return summary;
};

const summarizeWithOpenAI = async (prompt, apiKeyOverride, modelOverride) => {
  const apiKey = apiKeyOverride;
  if (!apiKey) throw Object.assign(new Error('OpenAI API key not configured'), { status: 500 });

  const model = modelOverride || modelOverride || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a summarizer. Provide concise summaries in 3-5 bullet points.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Object.assign(new Error(`OpenAI API error: ${response.status} ${body}`), { status: 502 });
  }

  const data = await response.json();
  const summary = data?.choices?.[0]?.message?.content?.trim();
  if (!summary) throw Object.assign(new Error('Empty summary response'), { status: 502 });
  return summary;
};

const summarizeWithAnthropic = async (prompt, apiKey, modelOverride) => {
  if (!apiKey) throw Object.assign(new Error('Anthropic API key not configured'), { status: 500 });
  const model = modelOverride || 'claude-sonnet-4-6';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      system: 'You are a summarizer. Provide concise summaries in 3-5 bullet points.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const msg = body?.error?.message || `Anthropic API error (${response.status})`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  const data = await response.json();
  const summary = data?.content?.[0]?.text?.trim();
  if (!summary) throw Object.assign(new Error('Empty summary response'), { status: 502 });
  return summary;
};

// ─── AI Smart Reply Suggestions ──────────────────────────────────────────────
const smartReply = async (req, res, next) => {
  try {
    const { message, context = [], senderName = '' } = req.body;
    if (!message) {
      const e = new Error('message is required');
      e.status = 400;
      throw e;
    }

    const ai = await resolveAIProvider();

    // Build conversation context (last few messages for better suggestions)
    let contextStr = '';
    if (context.length) {
      contextStr = '\n\nRecent conversation:\n' + context.map((m) =>
        `${m.direction === 'outgoing' ? 'You' : (m.senderName || 'Them')}: ${m.text}`
      ).join('\n') + '\n';
    }

    // Detect language server-side before calling AI
    const hindiRomanWords = /\b(kya|hai|karo|karna|mujhe|tujhe|bhai|yaar|nahi|haan|theek|accha|abhi|kaise|kitne|baje|deke|jaane|pehale|aaj|kal|kab|kaun|kaha|wala|wali|raha|rahi|hoga|hogi|bola|boli|dekh|chal|chalo|baat|kaam|kar|krna|krne|krta|krte|krega|krenge|dena|lena|aana|jana|rehna|milna|bolna|sunna|dekhna|samjhe|samajh|matlab|isliye|lekin|aur|ya|toh|bhi|sab|kuch|bahut|thoda|zyada|pata|woh|yeh|uska|uski|mera|meri|tera|teri|apna|apni|sahi|galat|pura|naya|purana)\b/i;
    const devanagariPattern = /[\u0900-\u097F]/;
    let detectedLang = 'english';
    if (devanagariPattern.test(message)) {
      detectedLang = 'hindi_devanagari';
    } else if (hindiRomanWords.test(message)) {
      detectedLang = 'hinglish';
    }

    const langInstructions = {
      hinglish: `LANGUAGE: The message is in HINGLISH (Hindi in Roman script). ALL 3 replies MUST be in Hinglish only — use Hindi words in Roman script. Do NOT reply in pure English. Example: "Sure, main dekh leta hoon", "Theek hai, abhi kar deta hoon", "Noted, main handle kar lunga".`,
      hindi_devanagari: `LANGUAGE: The message is in HINDI (Devanagari). ALL 3 replies MUST be in Hindi Devanagari only. Example: "ठीक है, मैं देख लेता हूँ", "ज़रूर, अभी करता हूँ"`,
      english: `LANGUAGE: The message is in ENGLISH. ALL 3 replies MUST be in pure English only. No Hindi words. Example: "Sure, I'll take a look", "Got it, thanks!", "Noted, will do"`,
    };

    const prompt = `You are a professional colleague replying in a workplace team chat.

Task: Suggest exactly 3 short, professional replies to the message below.

${langInstructions[detectedLang]}

STRICT: Every reply must be in the language specified above. No exceptions.

TONE RULES:
- Professional and polite workplace tone. Respectful and clear.
- Keep each reply 2-12 words. Concise but courteous.
- Do NOT use: "bhai", "yaar", "bro", "dude", slang, or overly casual language.
- DO use: "Sure", "Noted", "Will do", "Thank you", "Please", "I'll handle it", "Let me check".
- Sound like a professional teammate, not a friend hanging out.

CONTEXT: Understand the actual meaning of the message and reply appropriately with a helpful, actionable response.

FORMAT: Return ONLY a raw JSON array of 3 strings. No markdown. No backticks.
${contextStr}
${senderName || 'Colleague'}: "${message}"`;


    let suggestions;
    if (ai.provider === 'openai') {
      suggestions = await smartReplyWithOpenAI(prompt, ai.apiKey, ai.model);
    } else if (ai.provider === 'anthropic') {
      suggestions = await smartReplyWithAnthropic(prompt, ai.apiKey, ai.model);
    } else {
      suggestions = await smartReplyWithGemini(prompt, ai.apiKey, ai.model);
    }

    return success(res, { suggestions }, 'Smart replies generated');
  } catch (err) {
    return next(err);
  }
};

const parseSmartReplies = (text) => {
  try {
    // Extract JSON array from response (handle markdown wrapping)
    const cleaned = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.slice(0, 3).map(String);
  } catch { /* ignore */ }
  // Fallback: split by newlines
  return text.split('\n').filter(Boolean).slice(0, 3).map(s => s.replace(/^[\d\-\.\)]+\s*/, '').replace(/^["']|["']$/g, '').trim());
};

const smartReplyWithGemini = async (prompt, apiKeyOverride, modelOverride) => {
  const apiKey = apiKeyOverride;
  if (!apiKey) throw Object.assign(new Error('Gemini API key not configured'), { status: 500 });

  const model = modelOverride || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Object.assign(new Error(`Gemini API error: ${response.status} ${body}`), { status: 502 });
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw Object.assign(new Error('Empty response'), { status: 502 });
  return parseSmartReplies(text);
};

const smartReplyWithOpenAI = async (prompt, apiKeyOverride, modelOverride) => {
  const apiKey = apiKeyOverride;
  if (!apiKey) throw Object.assign(new Error('OpenAI API key not configured'), { status: 500 });

  const model = modelOverride || modelOverride || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You generate short smart reply suggestions for team chat. Always return a JSON array of exactly 3 strings.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Object.assign(new Error(`OpenAI API error: ${response.status} ${body}`), { status: 502 });
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw Object.assign(new Error('Empty response'), { status: 502 });
  return parseSmartReplies(text);
};

const smartReplyWithAnthropic = async (prompt, apiKey, modelOverride) => {
  if (!apiKey) throw Object.assign(new Error('Anthropic API key not configured'), { status: 500 });
  const model = modelOverride || 'claude-sonnet-4-6';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      system: 'You generate short smart reply suggestions for team chat. Always return a JSON array of exactly 3 strings.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const msg = body?.error?.message || `Anthropic API error (${response.status})`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim();
  if (!text) throw Object.assign(new Error('Empty response'), { status: 502 });
  return parseSmartReplies(text);
};

// ─── Grammar / Autocorrect ───────────────────────────────────────────────────
const grammarCorrect = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 2) {
      return success(res, { corrected: text || '', changed: false }, 'No correction needed');
    }

    const ai = await resolveAIProvider();
    const apiKey = ai.apiKey;
    if (!apiKey) throw Object.assign(new Error('AI API key not configured'), { status: 500 });

    const grammarPrompt = `You are a grammar and spelling correction tool for a workplace chat app.

Fix grammar, spelling, and punctuation errors in the text below. Keep the SAME language (English stays English, Hinglish stays Hinglish, Hindi stays Hindi).

Rules:
- Fix only actual errors (typos, grammar, punctuation)
- Do NOT change the meaning, tone, or style
- Do NOT make it more formal or add words
- Do NOT translate between languages
- If the text is already correct, return it exactly as-is
- Keep it natural — this is chat, not an essay
- Return ONLY the corrected text, nothing else. No quotes, no explanation.

Text: ${text}`;

    let corrected;

    if (ai.provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: ai.model || 'claude-sonnet-4-6',
          max_tokens: 500,
          messages: [{ role: 'user', content: grammarPrompt }],
        }),
      });
      if (!response.ok) {
        return success(res, { corrected: text, changed: false }, 'Correction unavailable');
      }
      const data = await response.json();
      corrected = (data?.content?.[0]?.text || '').trim();
    } else if (ai.provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: ai.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: grammarPrompt }],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });
      if (!response.ok) {
        return success(res, { corrected: text, changed: false }, 'Correction unavailable');
      }
      const data = await response.json();
      corrected = (data?.choices?.[0]?.message?.content || '').trim();
    } else {
      const model = ai.model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: grammarPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
        }),
      });
      if (!response.ok) {
        return success(res, { corrected: text, changed: false }, 'Correction unavailable');
      }
      const data = await response.json();
      corrected = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    }

    if (!corrected || corrected === text.trim()) {
      return success(res, { corrected: text.trim(), changed: false }, 'No correction needed');
    }

    return success(res, { corrected, changed: true, original: text.trim() }, 'Grammar corrected');
  } catch (err) {
    return next(err);
  }
};

// ─── AI Tone Adjuster ─────────────────────────────────────────────────────────
// POST /translate/tone-adjust
// Body: { text, tone: 'formal'|'friendly'|'diplomatic'|'professional' }
const TONE_DESCRIPTIONS = {
  formal: 'formal and professional corporate tone',
  friendly: 'warm, friendly, and approachable tone',
  diplomatic: 'diplomatic, tactful, and politically sensitive tone',
  professional: 'clear, concise, and business-professional tone',
};

const toneAdjust = async (req, res, next) => {
  try {
    const { text, tone = 'formal' } = req.body;
    if (!text) {
      const e = new Error('text is required');
      e.status = 400;
      throw e;
    }
    const toneDesc = TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.formal;
    const prompt = `Rewrite the following message in a ${toneDesc}. Keep the same language (if Hindi, keep Hindi; if English, keep English; if Hinglish, keep Hinglish). Return ONLY the rewritten text, nothing else.\n\n${text}`;

    const ai = await resolveAIProvider();
    let adjusted;

    if (ai.provider === 'openai') {
      const model = ai.model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: `You rewrite messages in a ${toneDesc}. Return ONLY the rewritten text.` },
            { role: 'user', content: text },
          ],
          temperature: 0.4,
          max_tokens: 2000,
        }),
      });
      if (!response.ok) throw Object.assign(new Error(`OpenAI API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      adjusted = data?.choices?.[0]?.message?.content?.trim();
    } else if (ai.provider === 'anthropic') {
      const model = ai.model || 'claude-sonnet-4-6';
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ai.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model, max_tokens: 2000,
          system: `You rewrite messages in a ${toneDesc}. Return ONLY the rewritten text.`,
          messages: [{ role: 'user', content: text }],
        }),
      });
      if (!response.ok) throw Object.assign(new Error(`Anthropic API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      adjusted = data?.content?.[0]?.text?.trim();
    } else {
      const model = ai.model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ai.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!response.ok) throw Object.assign(new Error(`Gemini API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      adjusted = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    }

    if (!adjusted) throw Object.assign(new Error('Empty response from AI'), { status: 502 });
    return success(res, { adjusted, original: text, tone, provider: ai.provider }, 'Tone adjusted');
  } catch (err) {
    return next(err);
  }
};

// ─── AI Semantic Search ───────────────────────────────────────────────────────
// POST /translate/semantic-search
// Body: { query, threadId?, limit? }
const semanticSearch = async (req, res, next) => {
  try {
    const { query, threadId, limit = 50 } = req.body;
    if (!query) {
      const e = new Error('query is required');
      e.status = 400;
      throw e;
    }

    const ai = await resolveAIProvider();
    const expandPrompt = `You are a search query expander for a workplace chat application. Given a natural language search query, generate an expanded set of search terms including synonyms, related words, and alternate phrasings that would help find relevant messages.

Return a JSON object with:
- "interpretation": a brief one-line explanation of what the user is looking for
- "keywords": array of 5-10 expanded search terms/phrases
- "messageTypes": array of relevant types if mentioned (from: text, image, video, file, link, code, audio) or empty array
- "dateHint": "today"|"yesterday"|"last7"|"last30"|null

Query: "${query}"

Return ONLY valid JSON, no markdown, no explanation.`;

    let parsed;
    if (ai.provider === 'openai') {
      const model = ai.model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You expand search queries. Return ONLY valid JSON.' },
            { role: 'user', content: expandPrompt },
          ],
          temperature: 0.3, max_tokens: 500,
        }),
      });
      if (!response.ok) throw Object.assign(new Error(`OpenAI API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      const raw = data?.choices?.[0]?.message?.content?.trim() || '{}';
      parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''));
    } else if (ai.provider === 'anthropic') {
      const model = ai.model || 'claude-sonnet-4-6';
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ai.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model, max_tokens: 500,
          system: 'You expand search queries. Return ONLY valid JSON.',
          messages: [{ role: 'user', content: expandPrompt }],
        }),
      });
      if (!response.ok) throw Object.assign(new Error(`Anthropic API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      const raw = data?.content?.[0]?.text?.trim() || '{}';
      parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''));
    } else {
      const model = ai.model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ai.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: expandPrompt }] }] }),
      });
      if (!response.ok) throw Object.assign(new Error(`Gemini API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
      parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''));
    }

    const interpretation = parsed.interpretation || query;
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [query];
    const messageTypes = Array.isArray(parsed.messageTypes) ? parsed.messageTypes : [];
    const dateHint = parsed.dateHint || null;

    // Build date filter
    let dateFilter = null;
    if (dateHint === 'today') dateFilter = new Date(Date.now() - 86400000).toISOString();
    else if (dateHint === 'yesterday') dateFilter = new Date(Date.now() - 2 * 86400000).toISOString();
    else if (dateHint === 'last7') dateFilter = new Date(Date.now() - 7 * 86400000).toISOString();
    else if (dateHint === 'last30') dateFilter = new Date(Date.now() - 30 * 86400000).toISOString();

    // Search DB with expanded keywords (reuse existing search pattern)
    const userId = req.user?.sub;
    const orgId = req.user?.org_id;
    const searchTerms = keywords.join(' | ');

    let sql, params;
    if (threadId && threadId.startsWith('dm-')) {
      const peerId = threadId.replace('dm-', '');
      sql = `SELECT m.message_id AS id, m.message, m.message_type, m.message_metadata, m.send_time AS "createdAt",
                    m.sender_id, m.receiver_id
             FROM messages m
             WHERE m.organization_id = $1
               AND ((m.sender_id = $2 AND m.receiver_id = $3) OR (m.sender_id = $3 AND m.receiver_id = $2))
               AND m.message IS NOT NULL
               ${dateFilter ? `AND m.send_time >= $4` : ''}
             ORDER BY m.send_time DESC LIMIT $${dateFilter ? 5 : 4}`;
      params = dateFilter ? [orgId, userId, peerId, dateFilter, limit] : [orgId, userId, peerId, limit];
    } else if (threadId && threadId.startsWith('group-')) {
      const groupId = threadId.replace('group-', '');
      sql = `SELECT gm.group_message_id AS id, gm.message, gm.message_type, gm.message_metadata, gm.created_at AS "createdAt",
                    gm.sender_id
             FROM group_messages gm
             WHERE gm.group_id = $1 AND gm.message IS NOT NULL
               ${dateFilter ? `AND gm.created_at >= $2` : ''}
             ORDER BY gm.created_at DESC LIMIT $${dateFilter ? 3 : 2}`;
      params = dateFilter ? [groupId, dateFilter, limit] : [groupId, limit];
    } else {
      return success(res, { results: [], interpretation, expandedTerms: keywords, provider: ai.provider }, 'Semantic search complete');
    }

    const { rows } = await db.query(sql, params);

    // Decrypt and filter by keywords
    const { decryptMessage, decryptMetadata } = require('../utils/messageCipher');
    const results = [];
    for (const row of rows) {
      let text = row.message;
      try { text = decryptMessage(row.message) || row.message; } catch {}
      let meta = row.message_metadata;
      try { meta = decryptMetadata(row.message_metadata) || meta; } catch {}
      if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch {}

      // Check if message type matches filter
      if (messageTypes.length && !messageTypes.includes(row.message_type)) continue;

      // Check keyword match (case-insensitive)
      const searchable = [text, meta?.fileName, meta?.caption, meta?.title, meta?.description, meta?.url].filter(Boolean).join(' ').toLowerCase();
      const matched = keywords.some(kw => searchable.includes(kw.toLowerCase()));
      if (!matched && keywords.length) continue;

      results.push({
        id: row.id,
        message: text,
        message_type: row.message_type,
        metadata: meta,
        createdAt: row.createdAt,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
      });

      if (results.length >= limit) break;
    }

    return success(res, { results, interpretation, expandedTerms: keywords, dateHint, provider: ai.provider }, 'Semantic search complete');
  } catch (err) {
    return next(err);
  }
};

// ─── AI Call Notes ────────────────────────────────────────────────────────────
// POST /translate/call-notes
// Body: { callDuration, participants, chatContext }
const generateCallNotes = async (req, res, next) => {
  try {
    const { callDuration, participants = [], chatContext = [] } = req.body;

    const contextText = chatContext.map(m => `[${m.sender || 'User'}]: ${m.text || ''}`).join('\n');
    const participantNames = participants.join(', ') || 'Unknown participants';
    const durationStr = callDuration ? `${Math.floor(callDuration / 60)}m ${callDuration % 60}s` : 'Unknown duration';

    const prompt = `You are a meeting notes assistant. Based on the following call information and recent chat context, generate structured meeting notes.

Call Duration: ${durationStr}
Participants: ${participantNames}
Recent Chat Context (messages before/during the call):
${contextText || 'No chat context available'}

Generate notes in this exact JSON format:
{
  "summary": "One paragraph summary of likely discussion topics",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "actionItems": ["action 1", "action 2"]
}

If chat context is limited, infer likely topics from participant names and duration. Keep language same as chat context. Return ONLY valid JSON.`;

    const ai = await resolveAIProvider();
    let raw;

    if (ai.provider === 'openai') {
      const model = ai.model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You generate meeting notes. Return ONLY valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4, max_tokens: 1000,
        }),
      });
      if (!response.ok) throw Object.assign(new Error(`OpenAI API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      raw = data?.choices?.[0]?.message?.content?.trim() || '{}';
    } else if (ai.provider === 'anthropic') {
      const model = ai.model || 'claude-sonnet-4-6';
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ai.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model, max_tokens: 1000,
          system: 'You generate meeting notes. Return ONLY valid JSON.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!response.ok) throw Object.assign(new Error(`Anthropic API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      raw = data?.content?.[0]?.text?.trim() || '{}';
    } else {
      const model = ai.model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ai.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!response.ok) throw Object.assign(new Error(`Gemini API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    }

    const notes = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''));

    return success(res, {
      notes: {
        summary: notes.summary || 'Call completed.',
        keyPoints: Array.isArray(notes.keyPoints) ? notes.keyPoints : [],
        actionItems: Array.isArray(notes.actionItems) ? notes.actionItems : [],
      },
      callDuration: durationStr,
      participants: participantNames,
      provider: ai.provider,
    }, 'Call notes generated');
  } catch (err) {
    return next(err);
  }
};

// ─── AI Smart Composer ────────────────────────────────────────────────────────
// POST /translate/smart-compose
// Body: { partialText, context?, threadType? }
const smartCompose = async (req, res, next) => {
  try {
    const { partialText, context = [], threadType = 'dm' } = req.body;
    if (!partialText || partialText.trim().length < 5) {
      return success(res, { completions: [] }, 'Text too short');
    }

    const contextStr = context.slice(-5).map(m => `${m.sender || 'User'}: ${m.text || ''}`).join('\n');
    const prompt = `You are an autocomplete assistant for a workplace chat app. Given the partial message and recent chat context, suggest 3 short completions for the message.

${contextStr ? `Recent chat:\n${contextStr}\n` : ''}
Partial message: "${partialText}"

Rules:
- Complete the sentence naturally (10-30 words each)
- Match the language and tone of the partial text
- Keep it professional but natural
- Return ONLY a JSON array of 3 strings: ["completion1", "completion2", "completion3"]
- Each completion should include the original partial text as prefix
- No markdown, no explanation`;

    const ai = await resolveAIProvider();
    let raw;

    if (ai.provider === 'openai') {
      const model = ai.model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You autocomplete chat messages. Return ONLY a JSON array of 3 strings.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2, max_tokens: 300,
        }),
      });
      if (!response.ok) throw Object.assign(new Error(`OpenAI API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      raw = data?.choices?.[0]?.message?.content?.trim() || '[]';
    } else if (ai.provider === 'anthropic') {
      const model = ai.model || 'claude-sonnet-4-6';
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ai.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model, max_tokens: 300,
          system: 'You autocomplete chat messages. Return ONLY a JSON array of 3 strings.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!response.ok) throw Object.assign(new Error(`Anthropic API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      raw = data?.content?.[0]?.text?.trim() || '[]';
    } else {
      const model = ai.model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ai.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!response.ok) throw Object.assign(new Error(`Gemini API error: ${response.status}`), { status: 502 });
      const data = await response.json();
      raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[]';
    }

    const completions = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''));

    return success(res, {
      completions: Array.isArray(completions) ? completions.slice(0, 3) : [],
      provider: ai.provider,
    }, 'Smart compose complete');
  } catch (err) {
    return next(err);
  }
};

// ─── Transcribe Audio (Voice-to-Text) ─────────────────────────────────────────
const transcribeAudio = async (req, res, next) => {
  try {
    const { fileUrl, fileKey, fileName } = req.body;
    if (!fileUrl && !fileKey) {
      const e = new Error('fileUrl or fileKey is required');
      e.status = 400;
      throw e;
    }

    // Resolve audio URL
    let resolvedUrl = fileUrl;
    if (fileKey && !resolvedUrl) {
      const { getPresignedUrl } = require('../config/s3');
      resolvedUrl = await getPresignedUrl(fileKey);
    }
    if (!resolvedUrl) {
      const e = new Error('Could not resolve audio file URL');
      e.status = 400;
      throw e;
    }

    // Fetch audio as buffer
    const audioResponse = await fetch(resolvedUrl);
    if (!audioResponse.ok) {
      throw Object.assign(new Error(`Failed to fetch audio file: ${audioResponse.status}`), { status: 502 });
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    const contentType = audioResponse.headers.get('content-type') || 'audio/webm';
    const safeName = fileName || 'audio.webm';

    const ai = await resolveAIProvider();

    let transcription;
    if (ai.provider === 'openai') {
      transcription = await transcribeWithOpenAI(audioBuffer, safeName, ai.apiKey);
    } else if (ai.provider === 'anthropic') {
      throw Object.assign(new Error('Audio transcription is not supported with Anthropic. Please switch to OpenAI or Gemini in AI Provider settings.'), { status: 400 });
    } else {
      transcription = await transcribeWithGemini(audioBuffer, contentType, ai.apiKey, ai.model);
    }

    return success(res, { transcription, provider: ai.provider }, 'Audio transcribed');
  } catch (err) {
    return next(err);
  }
};

// OpenAI Whisper transcription
const transcribeWithOpenAI = async (audioBuffer, fileName, apiKey) => {
  // Build multipart form data manually
  const boundary = '----FormBoundary' + Date.now().toString(36);
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || 'webm';
  const mimeMap = { webm: 'audio/webm', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac' };
  const mime = mimeMap[ext] || 'audio/webm';

  const parts = [];
  // model field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1`);
  // file field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName || 'audio.webm'}"\r\nContent-Type: ${mime}\r\n\r\n`);

  const header = Buffer.from(parts.join('\r\n') + '', 'utf-8');
  // We need: header bytes + audio buffer + closing boundary
  const closing = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  // Actually build proper multipart with Buffer.concat
  const preFile = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName || 'audio.webm'}"\r\nContent-Type: ${mime}\r\n\r\n`,
    'utf-8'
  );
  const postFile = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const body = Buffer.concat([preFile, audioBuffer, postFile]);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw Object.assign(new Error(`OpenAI Whisper API error: ${response.status} ${errText}`), { status: 502 });
  }
  const data = await response.json();
  return (data.text || '').trim();
};

// Gemini audio transcription (inline audio data)
const transcribeWithGemini = async (audioBuffer, mimeType, apiKey, modelOverride) => {
  const model = modelOverride || 'gemini-2.0-flash';
  const base64 = audioBuffer.toString('base64');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: 'Transcribe this audio accurately. Return only the transcribed text, clean and well-punctuated. Do not add any prefix or explanation.' },
        ],
      }],
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw Object.assign(new Error(`Gemini API error: ${response.status} ${errText}`), { status: 502 });
  }
  const data = await response.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
};

// ─── AI Help Bot ─────────────────────────────────────────────────────────────
const APP_KNOWLEDGE = `
TeamChatX is a secure, self-hosted business team communication platform (like Slack / MS Teams). Features:

MESSAGING: One-on-one DM, group chat, text formatting (bold/italic), code blocks, emoji, @mentions, message reply (swipe right), edit (5 min limit), unsend (5 min limit), forward, copy, pin (server-side, visible to all), star/bookmark (local, personal), reactions (emoji), voice messages with 1x/1.5x/2x playback, file/image/video/audio/location/contact sharing, GIF picker (Tenor), polls (single/multi choice), link previews, disappearing messages (24h/7d), broadcast to multiple contacts, draft auto-save.

GROUPS: Create group, announcement/airtime mode (only admins post), admin controls (add/remove members, promote/demote admin, delete any message), group timeline (event history), leave group (can only read old messages after leaving).

CALLS: Audio and video calls via WebRTC (requires dev build, not Expo Go).

SEARCH: In-chat search with type filters (text/image/video/file/link/audio/code), global search across all chats.

CONTACTS: People tab (alphabetical, department filter chips), Groups tab (with left/kicked status), online/away/idle/busy/offline status dots, global member orange badge.

CHAT LIST: Filter chips (All/Groups/Unread), long-press to pin to top or archive, unread count badges on app icon.

SETTINGS: Profile info, change password, active devices, linked devices (QR login), appearance (dark/light/system theme), customize (brand color hex, font, font size), app lock (4-digit PIN + biometric, auto-locks after 30s), notifications (DND, tone), permissions toggle, storage manager (clear cache/drafts/downloads), starred messages, broadcast, app guide.

SECURITY: App lock PIN + biometric, QR code login (scan from web to login desktop), disappearing messages, edit/unsend time limits.

MEDIA: Chat wallpaper (per chat, set/remove), full-screen image viewer (double-tap zoom), media/files/links/pinned tabs per chat, chat export as text file.

ROLES: Owner, Admin, Super Admin, User. Admins can manage groups. Global members have orange dot badge.
`;

const appHelp = async (req, res, next) => {
  try {
    const { question, history = [] } = req.body;
    if (!question) {
      const e = new Error('question is required');
      e.status = 400;
      throw e;
    }

    const ai = await resolveAIProvider();

    const systemPrompt = `You are TeamChatX Help Assistant — a friendly, concise AI helper for the TeamChatX business chat app. Answer user questions about app features, how-to guides, and troubleshooting.

${APP_KNOWLEDGE}

RULES:
- Answer in the same language the user asks (Hindi/Hinglish/English)
- Be concise — max 3-4 sentences unless the user asks for detail
- If you don't know, say "I'm not sure about that. Contact support at support@teamchatx.com"
- Use bullet points for step-by-step instructions
- Never make up features that don't exist`;

    const conversationHistory = history.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
    const fullPrompt = `${systemPrompt}\n\n${conversationHistory ? 'Previous conversation:\n' + conversationHistory + '\n\n' : ''}User: ${question}\n\nAssistant:`;

    let answer = '';

    if (ai.provider === 'gemini') {
      const model = ai.model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ai.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 400 },
        }),
      });
      if (!response.ok) throw Object.assign(new Error('AI error'), { status: 502 });
      const data = await response.json();
      answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } else if (ai.provider === 'openai') {
      const model = ai.model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-6).map(m => ({ role: m.role, content: m.text })), { role: 'user', content: question }], temperature: 0.5, max_tokens: 400 }),
      });
      if (!response.ok) throw Object.assign(new Error('AI error'), { status: 502 });
      const data = await response.json();
      answer = data?.choices?.[0]?.message?.content?.trim() || '';
    } else if (ai.provider === 'anthropic') {
      const model = ai.model || 'claude-sonnet-4-6';
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ai.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 400, system: systemPrompt, messages: [...history.slice(-6).map(m => ({ role: m.role, content: m.text })), { role: 'user', content: question }] }),
      });
      if (!response.ok) throw Object.assign(new Error('AI error'), { status: 502 });
      const data = await response.json();
      answer = data?.content?.[0]?.text?.trim() || '';
    }

    if (!answer) answer = "I couldn't process that. Please try again or contact support@teamchatx.com";

    return success(res, { answer }, 'Help response');
  } catch (err) {
    return next(err);
  }
};

module.exports = { translate, summarize, smartReply, grammarCorrect, toneAdjust, semanticSearch, generateCallNotes, smartCompose, transcribeAudio, appHelp };
