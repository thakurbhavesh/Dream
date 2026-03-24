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

    const model = ai.model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `You are a grammar and spelling correction tool for a workplace chat app.

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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
    });

    if (!response.ok) {
      return success(res, { corrected: text, changed: false }, 'Correction unavailable');
    }

    const data = await response.json();
    const corrected = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    if (!corrected || corrected === text.trim()) {
      return success(res, { corrected: text.trim(), changed: false }, 'No correction needed');
    }

    return success(res, { corrected, changed: true, original: text.trim() }, 'Grammar corrected');
  } catch (err) {
    return next(err);
  }
};

module.exports = { translate, summarize, smartReply, grammarCorrect };
