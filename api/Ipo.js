// Single IPO detail — CommonJS format for Vercel compatibility

const cache  = new Map();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.IPO_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'IPO_API_KEY env variable not set' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const now    = Date.now();
  const cached = cache.get(id);

  if (cached && now - cached.fetchedAt < TTL_MS) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached.data);
  }

  try {
    const response = await fetch(`https://api.ipoalerts.in/ipos/${id}`, {
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    cache.set(id, { data, fetchedAt: now });
    res.setHeader('X-Cache', 'MISS');
    return res.status(response.status).json(data);
  } catch (err) {
    if (cached) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json({ ...cached.data, _stale: true });
    }
    return res.status(500).json({ error: 'Failed to fetch IPO detail', detail: err.message });
  }
};
