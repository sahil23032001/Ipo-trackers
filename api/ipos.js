// In-memory cache — persists across requests while the Vercel function stays warm.
// Each unique status+type combo is cached independently for 1 hour.
const cache = new Map(); // key → { data, fetchedAt }
const TTL_MS = 60 * 60 * 1000; // 1 hour

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.IPO_API_KEY || '413b303e8337410c96de60c8bd32a1ec75ba50c2c7199ee635b56f1105429472';
  const { status = 'open', type, page = 1, limit = 50 } = req.query;

  // Cache key — unique per status + type combo
  const cacheKey = `${status}:${type || ''}`;
  const cached   = cache.get(cacheKey);
  const now      = Date.now();

  // Serve from cache if still fresh
  if (cached && now - cached.fetchedAt < TTL_MS) {
    const ageSeconds = Math.floor((now - cached.fetchedAt) / 1000);
    const expiresIn  = Math.ceil((TTL_MS - (now - cached.fetchedAt)) / 1000 / 60);
    res.setHeader('X-Cache',          'HIT');
    res.setHeader('X-Cache-Age',      `${ageSeconds}s`);
    res.setHeader('X-Cache-Expires',  `${expiresIn}m`);
    return res.status(200).json(cached.data);
  }

  // Cache miss — fetch from ipoalerts
  const params = new URLSearchParams({ page, limit });
  if (status) params.set('status', status);
  if (type)   params.set('type', type);

  try {
    const response = await fetch(`https://api.ipoalerts.in/ipos?${params}`, {
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' }
    });
    const data = await response.json();

    // Store in cache
    cache.set(cacheKey, { data, fetchedAt: now });

    res.setHeader('X-Cache',         'MISS');
    res.setHeader('X-Cache-Expires', '60m');
    return res.status(response.status).json(data);
  } catch (err) {
    // If live fetch fails but we have stale cache, return it with a warning
    if (cached) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json({ ...cached.data, _stale: true });
    }
    return res.status(500).json({ error: 'Failed to fetch IPO data', detail: err.message });
  }
}
