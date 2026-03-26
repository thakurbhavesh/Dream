const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');

const TENOR_API_KEY = process.env.TENOR_API_KEY || '';
const TENOR_BASE = 'https://tenor.googleapis.com/v2';

/**
 * GET /api/gifs/status — tells frontend if GIF service is configured
 */
router.get('/status', auth, (req, res) => {
  res.json({ available: !!TENOR_API_KEY });
});

/**
 * GET /api/gifs/search?q=funny&limit=20
 */
router.get('/search', auth, async (req, res) => {
  try {
    if (!TENOR_API_KEY) return res.status(503).json({ message: 'GIF service not configured' });
    const { q, limit = 20 } = req.query;
    if (!q) return res.status(400).json({ message: 'Query parameter q is required' });

    const params = new URLSearchParams({
      key: TENOR_API_KEY,
      q,
      limit: String(Math.min(Number(limit) || 20, 50)),
      media_filter: 'gif,tinygif',
      contentfilter: 'medium',
    });

    const response = await fetch(`${TENOR_BASE}/search?${params}`);
    if (!response.ok) throw new Error('Tenor API error');
    const data = await response.json();

    const gifs = (data.results || []).map((r) => ({
      id: r.id,
      title: r.title || '',
      gifUrl: r.media_formats?.gif?.url || '',
      previewUrl: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
      width: r.media_formats?.gif?.dims?.[0] || 0,
      height: r.media_formats?.gif?.dims?.[1] || 0,
    }));

    res.json({ data: { gifs, next: data.next || '' } });
  } catch (err) {
    console.error('[gif] search error:', err.message);
    res.status(500).json({ message: 'GIF search failed' });
  }
});

/**
 * GET /api/gifs/trending?limit=20
 */
router.get('/trending', auth, async (req, res) => {
  try {
    if (!TENOR_API_KEY) return res.status(503).json({ message: 'GIF service not configured' });
    const { limit = 20 } = req.query;

    const params = new URLSearchParams({
      key: TENOR_API_KEY,
      limit: String(Math.min(Number(limit) || 20, 50)),
      media_filter: 'gif,tinygif',
      contentfilter: 'medium',
    });

    const response = await fetch(`${TENOR_BASE}/featured?${params}`);
    if (!response.ok) throw new Error('Tenor API error');
    const data = await response.json();

    const gifs = (data.results || []).map((r) => ({
      id: r.id,
      title: r.title || '',
      gifUrl: r.media_formats?.gif?.url || '',
      previewUrl: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
      width: r.media_formats?.gif?.dims?.[0] || 0,
      height: r.media_formats?.gif?.dims?.[1] || 0,
    }));

    res.json({ data: { gifs, next: data.next || '' } });
  } catch (err) {
    console.error('[gif] trending error:', err.message);
    res.status(500).json({ message: 'GIF fetch failed' });
  }
});

module.exports = router;
